let style = document.createElement("link");
style.rel = "stylesheet";
style.href = browser.runtime.getURL("spoiler-guard.css");
document.documentElement.appendChild(style);

browser.runtime.onMessage.addListener((msg) => {
  style.disabled = !msg.enabled;
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

function getPreviewStyle(targetTime) {
  if (!storyboardData) return null;
  let idx = Math.floor(targetTime / storyboardData.interval);
  let perImage = storyboardData.cols * storyboardData.rows;
  let imgIdx = Math.floor(idx / perImage);
  let posInImg = idx % perImage;
  let col = posInImg % storyboardData.cols;
  let row = Math.floor(posInImg / storyboardData.cols);
  if (imgIdx >= storyboardData.images.length) return null;
  let url = storyboardBase + storyboardData.images[imgIdx];
  let x = col * storyboardData.width;
  let y = row * storyboardData.height;
  return { url, x, y, w: storyboardData.width, h: storyboardData.height };
}

function formatDelta(s) {
  let sign = s < 0 ? "-" : "+";
  let abs = Math.abs(s);
  let m = Math.floor(abs / 60);
  let sec = abs % 60;
  return sign + m + "m" + String(sec).padStart(2, "0") + "s";
}

function injectSlider() {
  let seekbar = document.querySelector("[data-a-target='player-seekbar']");
  if (!seekbar || document.getElementById("sg-seek-slider")) return;

  let container = seekbar.parentElement;

  let wrapper = document.createElement("div");
  wrapper.id = "sg-seek-slider";
  wrapper.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;gap:8px;padding:0 10px;height:20px;">
      <span style="color:#aaa;font-size:11px;min-width:40px;text-align:right">-1h</span>
      <input type="range" min="-3600" max="3600" value="0" step="1" id="sg-range"
        style="flex:1;cursor:pointer;accent-color:#9146FF;">
      <span style="color:#aaa;font-size:11px;min-width:40px">+1h</span>
    </div>
    <div id="sg-preview-container" style="position:absolute;bottom:60px;left:50%;transform:translateX(-50%);
      display:none;flex-direction:column;align-items:center;pointer-events:none;z-index:100;">
      <div id="sg-preview-thumb" style="width:220px;height:124px;
        border:2px solid #9146FF;border-radius:4px;overflow:hidden;"></div>
      <div id="sg-preview-label" style="color:#fff;font-size:12px;margin-top:4px;
        background:rgba(0,0,0,0.8);padding:2px 6px;border-radius:3px;"></div>
    </div>
    <div style="text-align:center;color:#fff;font-size:12px;height:16px" id="sg-seek-display"></div>
  `;
  wrapper.style.cssText = "position:relative;z-index:10;width:100%;";
  container.appendChild(wrapper);

  let range = document.getElementById("sg-range");
  let display = document.getElementById("sg-seek-display");
  let previewContainer = document.getElementById("sg-preview-container");
  let previewThumb = document.getElementById("sg-preview-thumb");
  let previewLabel = document.getElementById("sg-preview-label");

  range.addEventListener("input", async () => {
    let v = parseInt(range.value);
    display.textContent = v === 0 ? "" : formatDelta(v);

    if (!storyboardData) await loadStoryboard();

    let video = document.querySelector("video");
    if (!video || v === 0) {
      previewContainer.style.display = "none";
      return;
    }

    let targetTime = Math.max(0, Math.min(video.duration, video.currentTime + v));
    let preview = getPreviewStyle(targetTime);
    if (preview) {
      previewThumb.style.backgroundImage = `url(${preview.url})`;
      previewThumb.style.backgroundPosition = `-${preview.x}px -${preview.y}px`;
      previewThumb.style.backgroundSize = `${preview.w * storyboardData.cols}px ${preview.h * storyboardData.rows}px`;
      previewLabel.textContent = formatDelta(v);
      previewContainer.style.display = "flex";
    } else {
      previewContainer.style.display = "none";
    }
  });

  range.addEventListener("change", () => {
    let v = parseInt(range.value);
    if (v !== 0) {
      let video = document.querySelector("video");
      if (video) {
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + v));
      }
    }
    range.value = 0;
    display.textContent = "";
    previewContainer.style.display = "none";
  });
}

let obs = new MutationObserver(() => injectSlider());
obs.observe(document.documentElement, { childList: true, subtree: true });
