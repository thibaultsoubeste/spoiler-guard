let enabled = true;

browser.browserAction.onClicked.addListener(async () => {
  enabled = !enabled;
  browser.browserAction.setTitle({ title: enabled ? "Spoiler Guard: ON" : "Spoiler Guard: OFF" });
  browser.browserAction.setIcon({ path: enabled ? "icon.svg" : "icon-off.svg" });
  let tabs = await browser.tabs.query({ url: ["*://*.twitch.tv/*", "*://*.youtube.com/*"] });
  for (let t of tabs) {
    browser.tabs.sendMessage(t.id, { enabled }).catch(() => {});
  }
});
