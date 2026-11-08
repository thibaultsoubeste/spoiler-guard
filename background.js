async function updateAction(enabled) {
  await Promise.all([
    browser.browserAction.setTitle({ title: enabled ? "Spoiler Guard: ON" : "Spoiler Guard: OFF" }),
    browser.browserAction.setIcon({ path: enabled ? "icon.svg" : "icon-off.svg" })
  ]);
}

let ready = browser.storage.local.get({ enabled: true }).then(({ enabled }) => updateAction(enabled));

browser.browserAction.onClicked.addListener(() => {
  ready = ready.then(async () => {
    let { enabled } = await browser.storage.local.get({ enabled: true });
    await browser.storage.local.set({ enabled: !enabled });
    await updateAction(!enabled);
  });
});
