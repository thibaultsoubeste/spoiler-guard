let style = document.createElement("link");
style.rel = "stylesheet";
style.href = browser.runtime.getURL("spoiler-guard-youtube.css");
document.documentElement.appendChild(style);

browser.runtime.onMessage.addListener((msg) => {
  style.disabled = !msg.enabled;
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
    // Re-extract on navigation (YouTube SPA)
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

function getPreviewStyle(targetTime) {
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
    w: sbData.width, h: sbData.height,
    totalW: sbData.width * sbData.cols, totalH: sbData.height * sbData.rows
  };
}

function formatDelta(s) {
  let sign = s < 0 ? "-" : "+";
  let abs = Math.abs(s);
  let m = Math.floor(abs / 60);
  let sec = abs % 60;
  return sign + m + "m" + String(sec).padStart(2, "0") + "s";
}

function injectSlider() {
  let controls = document.querySelector(".ytp-chrome-bottom");
  if (!controls || document.getElementById("sg-seek-slider")) return;

  // Place preview above the player
  let player = document.getElementById("movie_player");
  let previewFloat = document.createElement("div");
  previewFloat.id = "sg-preview-float";
  previewFloat.innerHTML = `
    <div id="sg-preview-container" style="position:absolute;bottom:80px;left:50%;transform:translateX(-50%);
      display:none;flex-direction:column;align-items:center;pointer-events:none;z-index:10000;">
      <div id="sg-preview-thumb" style="width:320px;height:180px;
        border:2px solid #FF0000;border-radius:4px;overflow:hidden;"></div>
      <div id="sg-preview-label" style="color:#fff;font-size:12px;margin-top:4px;
        background:rgba(0,0,0,0.8);padding:2px 6px;border-radius:3px;"></div>
    </div>
  `;
  previewFloat.style.cssText = "position:absolute;bottom:0;left:0;right:0;pointer-events:none;z-index:10000;";
  player.appendChild(previewFloat);

  // Replace progress bar area with slider
  let progressBar = controls.querySelector(".ytp-progress-bar-container");
  let wrapper = document.createElement("div");
  wrapper.id = "sg-seek-slider";
  wrapper.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:0 4px;height:16px;">
      <span style="color:#aaa;font-size:10px">-1h</span>
      <input type="range" min="-3600" max="3600" value="0" step="1" id="sg-range"
        style="flex:1;cursor:pointer;accent-color:#FF0000;height:4px;">
      <span style="color:#aaa;font-size:10px">+1h</span>
      <span style="color:#fff;font-size:10px;min-width:50px" id="sg-seek-display"></span>
    </div>
  `;
  wrapper.style.cssText = "width:100%;";
  if (progressBar) {
    progressBar.parentElement.insertBefore(wrapper, progressBar);
  } else {
    controls.prepend(wrapper);
  }

  let range = document.getElementById("sg-range");
  let display = document.getElementById("sg-seek-display");
  let previewContainer = document.getElementById("sg-preview-container");
  let previewThumb = document.getElementById("sg-preview-thumb");
  let previewLabel = document.getElementById("sg-preview-label");

  range.addEventListener("input", () => {
    let v = parseInt(range.value);
    display.textContent = v === 0 ? "" : formatDelta(v);

    if (!sbData) sbData = parseStoryboard();

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
      previewThumb.style.backgroundSize = `${preview.totalW}px ${preview.totalH}px`;
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
