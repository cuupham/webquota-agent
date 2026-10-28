chrome.action.onClicked.addListener(async () => {
  const panelUrl = chrome.runtime.getURL('panel.html');
  const existing = await chrome.tabs.query({ url: panelUrl });
  if (existing.length > 0 && existing[0].id !== undefined) {
    await chrome.tabs.update(existing[0].id, { active: true });
    return;
  }
  await chrome.tabs.create({ url: panelUrl, active: true });
});
