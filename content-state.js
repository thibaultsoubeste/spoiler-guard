function setupSpoilerGuard(stylesheet, embedSelectors, injectSlider) {
  let styles = [stylesheet, "slider.css"].map(file => {
    let style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = browser.runtime.getURL(file);
    return style;
  });

  if (window !== window.top) {
    let style = document.createElement("style");
    style.textContent = `${embedSelectors} { display: none !important; }`;
    styles.push(style);
  }

  for (let style of styles) {
    style.media = "not all";
    document.documentElement.appendChild(style);
  }

  let observer = new MutationObserver(injectSlider);

  function setEnabled(enabled) {
    observer.disconnect();
    for (let style of styles) style.media = enabled ? "all" : "not all";
    if (enabled) {
      injectSlider();
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
      document.querySelectorAll("#sg-seek-slider, #sg-preview-float").forEach(el => el.remove());
    }
  }

  let changed = false;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) return;
    changed = true;
    setEnabled(changes.enabled.newValue !== false);
  });
  browser.storage.local.get({ enabled: true }).then(({ enabled }) => {
    if (!changed) setEnabled(enabled);
  });
}
