let style = document.createElement("link");
style.rel = "stylesheet";
style.href = browser.runtime.getURL("spoiler-guard-youtube.css");
document.documentElement.appendChild(style);

browser.runtime.onMessage.addListener((msg) => {
  style.disabled = !msg.enabled;
  let slider = document.getElementById("sg-seek-slider");
  if (slider) slider.style.display = msg.enabled ? "" : "none";
});

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

  let wrapper = document.createElement("div");
  wrapper.id = "sg-seek-slider";
  wrapper.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:0 10px;height:20px;">
      <span style="color:#aaa;font-size:11px;min-width:40px;text-align:right">-1h</span>
      <input type="range" min="-3600" max="3600" value="0" step="1" id="sg-range"
        style="flex:1;cursor:pointer;accent-color:#FF0000;">
      <span style="color:#aaa;font-size:11px;min-width:40px">+1h</span>
    </div>
    <div style="text-align:center;color:#fff;font-size:12px;height:16px" id="sg-seek-display"></div>
  `;
  wrapper.style.cssText = "position:relative;z-index:100;width:100%;";
  controls.prepend(wrapper);

  let range = document.getElementById("sg-range");
  let display = document.getElementById("sg-seek-display");

  range.addEventListener("input", () => {
    let v = parseInt(range.value);
    display.textContent = v === 0 ? "" : formatDelta(v);
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
  });
}

let obs = new MutationObserver(() => injectSlider());
obs.observe(document.documentElement, { childList: true, subtree: true });
