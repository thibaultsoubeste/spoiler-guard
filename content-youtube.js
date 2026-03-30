let inIframe = window !== window.top;

let style = document.createElement("link");
style.rel = "stylesheet";
style.href = browser.runtime.getURL("spoiler-guard-youtube.css");
document.documentElement.appendChild(style);

let sliderStyle = document.createElement("link");
sliderStyle.rel = "stylesheet";
sliderStyle.href = browser.runtime.getURL("slider.css");
document.documentElement.appendChild(sliderStyle);

if (inIframe) {
  let embedStyle = document.createElement("style");
  embedStyle.textContent = `
    /* Hide video title in embeds */
    .ytp-title,
    .ytp-title-text,
    .ytp-chrome-top {
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

// Inject page-context script to extract storyboard data
let extractor = document.createElement("script");
extractor.textContent = `
  (function() {
    function extract() {
      let player = document.getElementById("movie_player");
      if (!player || !player.getPlayerResponse) return false;
      let resp = player.getPlayerResponse();
      let spec = resp?.storyboards?.playerStoryboardSpecRenderer?.spec;
      if (!spec) return false;
      document.documentElement.setAttribute("data-sg-storyboard", spec);
      return true;
    }
    if (!extract()) {
      let iv = setInterval(() => { if (extract()) clearInterval(iv); }, 1000);
      setTimeout(() => clearInterval(iv), 15000);
    }
    let oldHref = location.href;
    new MutationObserver(() => {
      if (location.href !== oldHref) {
        oldHref = location.href;
        document.documentElement.removeAttribute("data-sg-storyboard");
        let iv = setInterval(() => { if (extract()) clearInterval(iv); }, 1000);
        setTimeout(() => clearInterval(iv), 15000);
      }
    }).observe(document.body, { childList: true, subtree: true });
  })();
`;
document.documentElement.appendChild(extractor);

let sbData = null;

function parseStoryboard() {
  let spec = document.documentElement.getAttribute("data-sg-storyboard");
  if (!spec) return null;
  let parts = spec.split("|");
  let base = parts[0];
  let levels = parts.slice(1).map((p, i) => {
    let f = p.split("#");
    return {
      width: parseInt(f[0]), height: parseInt(f[1]), count: parseInt(f[2]),
      cols: parseInt(f[3]), rows: parseInt(f[4]), interval: parseInt(f[5]),
      name: f[6], sigh: f[7], level: i
    };
  });
  let best = levels[levels.length - 1];
  let baseUrl = base.replace("$L", best.level);
  return { baseUrl, sigh: best.sigh, ...best };
}

function getStoryboardUrl(pageIdx) {
  if (!sbData) return null;
  let name = sbData.name.replace(/M\$M/g, "M" + pageIdx);
  return sbData.baseUrl.replace("$N", name) + "&sigh=" + sbData.sigh;
}

async function getPreview(targetTime) {
  if (!sbData) sbData = parseStoryboard();
  if (!sbData || sbData.interval === 0) return null;
  let intervalSec = sbData.interval / 1000;
  let idx = Math.floor(targetTime / intervalSec);
  let perPage = sbData.cols * sbData.rows;
  let pageIdx = Math.floor(idx / perPage);
  let posInPage = idx % perPage;
  let col = posInPage % sbData.cols;
  let row = Math.floor(posInPage / sbData.cols);
  let url = getStoryboardUrl(pageIdx);
  if (!url) return null;
  return {
    url, x: col * sbData.width, y: row * sbData.height,
    totalW: sbData.width * sbData.cols, totalH: sbData.height * sbData.rows
  };
}

function injectSlider() {
  let controls = document.querySelector(".ytp-chrome-bottom");
  if (!controls || document.getElementById("sg-seek-slider")) return;

  let player = document.getElementById("movie_player");

  // Preview floats above player
  let previewFloat = document.createElement("div");
  previewFloat.id = "sg-preview-float";
  previewFloat.innerHTML = createPreviewHTML(320, 180);
  previewFloat.style.cssText = "position:absolute;bottom:0;left:0;right:0;pointer-events:none;z-index:10000;";
  player.appendChild(previewFloat);
  document.getElementById("sg-preview-container").style.bottom = "80px";

  // Slider replaces progress bar
  let progressBar = controls.querySelector(".ytp-progress-bar-container");
  let wrapper = document.createElement("div");
  wrapper.id = "sg-seek-slider";
  wrapper.style.setProperty("--sg-accent", "#FF0000");
  wrapper.innerHTML = createSliderHTML();
  if (progressBar) {
    progressBar.parentElement.insertBefore(wrapper, progressBar);
  } else {
    controls.prepend(wrapper);
  }

  setupSliderEvents(getPreview);
}

let obs = new MutationObserver(() => injectSlider());
obs.observe(document.documentElement, { childList: true, subtree: true });
