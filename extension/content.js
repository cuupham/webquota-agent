(() => {
  if (window.__webQuotaBridgeInstalled) return;
  window.__webQuotaBridgeInstalled = true;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };

  function findNewChatButton() {
    const selectors = [
      '[data-testid="create-new-chat-button"]',
      'button[aria-label*="new chat" i]',
      'a[aria-label*="new chat" i]',
      'button[title*="new chat" i]'
    ];
    for (const selector of selectors) {
      const found = [...document.querySelectorAll(selector)].find(isVisible);
      if (found) return found;
    }
    return [...document.querySelectorAll('button, a')].find((element) =>
      isVisible(element) && /^new chat$/i.test((element.getAttribute('aria-label') || element.textContent || '').trim())
    ) || null;
  }

  async function startNewChat() {
    const button = findNewChatButton();
    if (!button) {
      throw new Error('Could not find the New chat control. Reload chatgpt.com and ensure the left navigation is available.');
    }
    button.click();
    await sleep(700);
  }

  function findComposer() {
    const selectors = [
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      '[contenteditable="true"][data-placeholder]',
      '[contenteditable="true"]',
      'textarea'
    ];
    for (const selector of selectors) {
      const list = [...document.querySelectorAll(selector)];
      const found = list.reverse().find(isVisible);
      if (found) return found;
    }
    return null;
  }

  async function waitForComposer(timeoutMs = 12000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const composer = findComposer();
      if (composer) return composer;
      await sleep(250);
    }
    throw new Error('ChatGPT message composer was not found. Confirm the tab is signed in and ready.');
  }

  function fillComposer(element, value) {
    element.focus();
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) setter.call(element, value);
      else element.value = value;
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, value);
    if ((element.innerText || '').trim() !== value.trim()) {
      element.textContent = value;
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    }
  }

  function findSendButton() {
    const selectors = [
      '[data-testid="send-button"]',
      'button[aria-label*="send prompt" i]',
      'button[aria-label*="send message" i]',
      'button[aria-label="send" i]'
    ];
    for (const selector of selectors) {
      const found = [...document.querySelectorAll(selector)].find((element) => isVisible(element) && !element.disabled);
      if (found) return found;
    }
    return null;
  }

  function assistantMessages() {
    return [...document.querySelectorAll('[data-message-author-role="assistant"]')];
  }

  async function submitPrompt(prompt) {
    await startNewChat();
    const composer = await waitForComposer();
    fillComposer(composer, prompt);
    await sleep(150);

    const send = findSendButton();
    if (send) {
      send.click();
    } else {
      throw new Error('ChatGPT Send button was not found. The page UI may have changed.');
    }

    const startedAt = Date.now();
    let lastText = '';
    let stablePolls = 0;
    let sawResponse = false;

    while (Date.now() - startedAt < 180000) {
      await sleep(700);
      const messages = assistantMessages();
      if (messages.length === 0) continue;
      const current = (messages[messages.length - 1].innerText || '').trim();
      if (!current) continue;
      sawResponse = true;
      const stop = document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop generating" i]');
      const generating = Boolean(stop && isVisible(stop));
      if (current === lastText && !generating) stablePolls += 1;
      else stablePolls = 0;
      lastText = current;
      if (sawResponse && stablePolls >= 3) return current;
    }

    throw new Error('Timed out waiting for a stable ChatGPT response.');
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'WEBQUOTA_RUN' || typeof message.prompt !== 'string') return false;
    submitPrompt(message.prompt)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  });
})();
