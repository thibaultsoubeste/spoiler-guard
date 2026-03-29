let enabled = true;

browser.browserAction.onClicked.addListener(async () => {
  enabled = !enabled;
  browser.browserAction.setTitle({ title: enabled ? "Spoiler Guard: ON" : "Spoiler Guard: OFF" });
  browser.browserAction.setBadgeText({ text: enabled ? "" : "OFF" });
  browser.browserAction.setBadgeBackgroundColor({ color: "#FF4444" });
  let tabs = await browser.tabs.query({ url: "*://*.twitch.tv/*" });
  for (let t of tabs) {
    browser.tabs.sendMessage(t.id, { enabled }).catch(() => {});
  }
});
