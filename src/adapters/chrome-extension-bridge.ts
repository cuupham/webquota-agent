import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config.js';

export interface BridgeJob {
  id: string;
  prompt: string;
  createdAt: number;
}

interface PendingTask {
  job: BridgeJob;
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface PollWaiter {
  resolve: (job: BridgeJob | null) => void;
  timer: NodeJS.Timeout;
}

export class ChromeExtensionBridge {
  private readonly pending = new Map<string, PendingTask>();
  private readonly queue: BridgeJob[] = [];
  private readonly waiters: PollWaiter[] = [];
  private lastPollAt = 0;

  constructor(private readonly config: AppConfig) {}

  async complete(prompt: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Chrome Extension Bridge is not connected. Open Chrome, navigate to chatgpt.com, load the WebQuota extension, and connect its Bridge Panel.');
    }

    const job: BridgeJob = {
      id: randomUUID(),
      prompt,
      createdAt: Date.now(),
    };

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(job.id);
        const queuedIndex = this.queue.findIndex((queued) => queued.id === job.id);
        if (queuedIndex >= 0) this.queue.splice(queuedIndex, 1);
        reject(new Error('Timed out waiting for ChatGPT Web via the Chrome Extension Bridge.'));
      }, this.config.responseTimeoutMs);

      this.pending.set(job.id, { job, resolve, reject, timer });
      this.dispatch(job);
    });
  }

  async nextJob(waitMs = 20_000): Promise<BridgeJob | null> {
    this.lastPollAt = Date.now();
    const queued = this.queue.shift();
    if (queued) return queued;

    return new Promise<BridgeJob | null>((resolve) => {
      const waiter: PollWaiter = {
        resolve,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          resolve(null);
        }, Math.max(0, Math.min(waitMs, 25_000))),
      };
      this.waiters.push(waiter);
    });
  }

  submitResult(id: string, success: boolean, text?: string, error?: string): boolean {
    const task = this.pending.get(id);
    if (!task) return false;

    clearTimeout(task.timer);
    this.pending.delete(id);
    if (success) {
      task.resolve(typeof text === 'string' ? text : '');
    } else {
      task.reject(new Error((error || 'The Chrome extension failed to complete the browser task.').slice(0, 4_000)));
    }
    return true;
  }

  status(): Record<string, unknown> {
    return {
      connected: this.isConnected(),
      lastPollAt: this.lastPollAt ? new Date(this.lastPollAt).toISOString() : null,
      queuedJobs: this.queue.length,
      pendingJobs: this.pending.size,
      note: 'The extension panel must remain open in Chrome and a signed-in ChatGPT tab must be available.',
    };
  }

  async close(): Promise<void> {
    for (const task of this.pending.values()) {
      clearTimeout(task.timer);
      task.reject(new Error('WebQuota Agent is shutting down.'));
    }
    this.pending.clear();
    this.queue.length = 0;
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
  }

  private isConnected(): boolean {
    return this.lastPollAt > 0 && Date.now() - this.lastPollAt < 45_000;
  }

  private dispatch(job: BridgeJob): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(job);
    } else {
      this.queue.push(job);
    }
  }
}
