let inIframe = window !== window.top;

let style = document.createElement("link");
style.rel = "stylesheet";
style.href = browser.runtime.getURL("spoiler-guard.css");
document.documentElement.appendChild(style);

let sliderStyle = document.createElement("link");
sliderStyle.rel = "stylesheet";
sliderStyle.href = browser.runtime.getURL("slider.css");
document.documentElement.appendChild(sliderStyle);

if (inIframe) {
  let embedStyle = document.createElement("style");
  embedStyle.textContent = `
    /* Hide stream title/info in embeds */
    .top-bar,
    .channel-info-content,
    [data-a-target="stream-title"],
    [data-a-target="player-info-title"],
    .metadata-layout__support,
    .stream-info-card {
      display: none !important;
    }
  `;
  embedStyle.id = "sg-embed-style";
  document.documentElement.appendChild(embedStyle);
}

browser.runtime.onMessage.addListener((msg) => {
  style.disabled = !msg.enabled;
  sliderStyle.disabled = !msg.enabled;
  let slider = document.getElementById("sg-seek-slider");
  if (slider) slider.style.display = msg.enabled ? "" : "none";
});

let storyboardData = null;
let storyboardBase = null;
let storyboardLoading = false;

async function loadStoryboard() {
  if (storyboardData || storyboardLoading) return;
  storyboardLoading = true;
  let perf = performance.getEntriesByType("resource");
  let info = perf.find(e => e.name.includes("storyboards") && e.name.endsWith("-info.json"));
  if (!info) {
    storyboardLoading = false;
    return;
  }
  storyboardBase = info.name.replace(/[^/]+$/, "");
  try {
    let res = await fetch(info.name);
    let data = await res.json();
    storyboardData = data.find(d => d.quality === "high") || data[0];
  } catch (e) {}
  storyboardLoading = false;
}

async function getPreview(targetTime) {
  if (!storyboardData) await loadStoryboard();
  if (!storyboardData) return null;
  let idx = Math.floor(targetTime / storyboardData.interval);
  let perImage = storyboardData.cols * storyboardData.rows;
  let imgIdx = Math.floor(idx / perImage);
  let posInImg = idx % perImage;
  let col = posInImg % storyboardData.cols;
  let row = Math.floor(posInImg / storyboardData.cols);
  if (imgIdx >= storyboardData.images.length) return null;
  let url = storyboardBase + storyboardData.images[imgIdx];
  return {
    url, x: col * storyboardData.width, y: row * storyboardData.height,
    totalW: storyboardData.width * storyboardData.cols,
    totalH: storyboardData.height * storyboardData.rows
  };
}

function injectSlider() {
  let seekbar = document.querySelector("[data-a-target='player-seekbar']");
  if (!seekbar || document.getElementById("sg-seek-slider")) return;

  let container = seekbar.parentElement;

  let wrapper = document.createElement("div");
  wrapper.id = "sg-seek-slider";
  wrapper.style.setProperty("--sg-accent", "#9146FF");
  wrapper.innerHTML = createSliderHTML();
  container.appendChild(wrapper);

  let previewFloat = document.createElement("div");
  previewFloat.innerHTML = createPreviewHTML(220, 124);
  previewFloat.style.cssText = "position:absolute;bottom:60px;left:0;right:0;pointer-events:none;z-index:10000;";
  wrapper.appendChild(previewFloat);
  document.getElementById("sg-preview-container").style.bottom = "0";

  setupSliderEvents(getPreview);
}

let obs = new MutationObserver(() => injectSlider());
obs.observe(document.documentElement, { childList: true, subtree: true });
