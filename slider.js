// Non-linear mapping: slider value [-1000, 1000] -> seconds [-3600, 3600]
// Cubic curve gives fine control near center, coarse at edges
function sliderToSeconds(v) {
  return Math.sign(v) * Math.pow(Math.abs(v) / 1000, 3) * 3600;
}

function formatDelta(s) {
  let sign = s < 0 ? "-" : "+";
  let abs = Math.round(Math.abs(s));
  if (abs < 60) return sign + abs + "s";
  let m = Math.floor(abs / 60);
  let sec = abs % 60;
  return sign + m + "m" + String(sec).padStart(2, "0") + "s";
}

function createSliderHTML(previewW, previewH) {
  return `
    <div class="sg-track">
      <span class="sg-label">-1h</span>
      <input type="range" min="-1000" max="1000" value="0" step="1" id="sg-range">
      <span class="sg-label">+1h</span>
    </div>
    <div id="sg-seek-display"></div>
  `;
}

function createPreviewHTML(previewW, previewH) {
  return `
    <div id="sg-preview-container">
      <div id="sg-preview-thumb" style="width:${previewW}px;height:${previewH}px;"></div>
      <div id="sg-preview-label"></div>
    </div>
  `;
}

function setupSliderEvents(getPreview) {
  let range = document.getElementById("sg-range");
  let display = document.getElementById("sg-seek-display");
  let previewContainer = document.getElementById("sg-preview-container");
  let previewThumb = document.getElementById("sg-preview-thumb");
  let previewLabel = document.getElementById("sg-preview-label");

  range.addEventListener("input", async () => {
    let raw = parseInt(range.value);
    let secs = Math.round(sliderToSeconds(raw));
    display.textContent = raw === 0 ? "" : formatDelta(secs);

    let video = document.querySelector("video");
    if (!video || raw === 0) {
      if (previewContainer) previewContainer.style.display = "none";
      return;
    }

    if (previewContainer && getPreview) {
      let targetTime = Math.max(0, Math.min(video.duration, video.currentTime + secs));
      let preview = await getPreview(targetTime);
      if (preview) {
        previewThumb.style.backgroundImage = `url(${preview.url})`;
        previewThumb.style.backgroundPosition = `-${preview.x}px -${preview.y}px`;
        previewThumb.style.backgroundSize = `${preview.totalW}px ${preview.totalH}px`;
        previewLabel.textContent = formatDelta(secs);
        previewContainer.style.display = "flex";
      } else {
        previewContainer.style.display = "none";
      }
    }
  });

  range.addEventListener("change", () => {
    let raw = parseInt(range.value);
    let secs = Math.round(sliderToSeconds(raw));
    if (secs !== 0) {
      let video = document.querySelector("video");
      if (video) {
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + secs));
      }
    }
    range.value = 0;
    display.textContent = "";
    if (previewContainer) previewContainer.style.display = "none";
  });
}
