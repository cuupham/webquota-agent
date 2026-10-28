import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import type { AppConfig } from '../config.js';

export class ChatGPTWebAdapter {
  private context?: BrowserContext;
  private page?: Page;
  private queue: Promise<void> = Promise.resolve();
  private lastError?: string;

  constructor(private readonly config: AppConfig) {}

  async start(): Promise<void> {
    if (this.context) return;
    this.context = await chromium.launchPersistentContext(this.config.browserProfile, {
      headless: this.config.headless,
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: false,
    });
    this.page = this.context.pages()[0] ?? await this.context.newPage();
    await this.page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }

  async status(): Promise<Record<string, unknown>> {
    return {
      browserStarted: Boolean(this.context && this.page && !this.page.isClosed()),
      url: this.page?.url() ?? null,
      title: this.page ? await this.page.title().catch(() => null) : null,
      lastError: this.lastError ?? null,
      note: 'Login is manual. The adapter does not bypass verification or account controls.',
    };
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.page = undefined;
  }

  async complete(prompt: string): Promise<string> {
    const task = this.queue.then(async () => this.completeOnce(prompt));
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }

  private getPage(): Page {
    if (!this.page || this.page.isClosed()) throw new Error('Browser is not started. Restart WebQuota Agent.');
    return this.page;
  }

  private async startNewConversation(page: Page): Promise<void> {
    const candidates = [
      page.locator('[data-testid="create-new-chat-button"]').first(),
      page.getByRole('button', { name: /new chat/i }).first(),
      page.getByRole('link', { name: /new chat/i }).first(),
    ];
    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ timeout: 3_000 }).catch(() => undefined);
        await page.waitForTimeout(500);
        return;
      }
    }
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(800);
  }

  private async findComposer(page: Page): Promise<Locator> {
    const candidates = [
      page.locator('#prompt-textarea').first(),
      page.locator('[contenteditable="true"][data-placeholder]').last(),
      page.locator('[contenteditable="true"]').last(),
      page.locator('textarea').last(),
    ];
    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
    throw new Error('ChatGPT composer was not found. Sign in manually and confirm chatgpt.com is ready.');
  }

  private async completeOnce(prompt: string): Promise<string> {
    const page = this.getPage();
    try {
      if (!page.url().startsWith('https://chatgpt.com/')) {
        await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      }
      await this.startNewConversation(page);
      const composer = await this.findComposer(page);
      await composer.fill(prompt, { timeout: 10_000 });

      const sendButton = page.locator('[data-testid="send-button"]:visible').last();
      if (await sendButton.count().catch(() => 0)) {
        await sendButton.click({ timeout: 10_000 });
      } else {
        await composer.press('Enter', { timeout: 10_000 });
      }

      const startedAt = Date.now();
      let lastText = '';
      let stablePolls = 0;
      while (Date.now() - startedAt < this.config.responseTimeoutMs) {
        await page.waitForTimeout(700);
        const assistantMessages = page.locator('[data-message-author-role="assistant"]');
        if ((await assistantMessages.count().catch(() => 0)) === 0) continue;
        const current = (await assistantMessages.last().innerText().catch(() => '')).trim();
        if (!current) continue;
        const generating = await page.locator('[data-testid="stop-button"], button[aria-label*="Stop generating" i]').isVisible().catch(() => false);
        if (current === lastText && !generating) stablePolls += 1;
        else stablePolls = 0;
        lastText = current;
        if (stablePolls >= 3) {
          this.lastError = undefined;
          return current;
        }
      }
      throw new Error('Timed out waiting for a stable ChatGPT response after ' + this.config.responseTimeoutMs + ' ms.');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      throw new Error(this.lastError);
    }
  }
}
