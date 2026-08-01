import { Client } from "@upstash/qstash";

import type { ReminderJobScheduler } from "@/features/notifications/application/ports";

interface QStashReminderSchedulerOptions {
  readonly token: string | undefined;
  readonly appUrl: string;
}

export class QStashReminderScheduler implements ReminderJobScheduler {
  readonly configured: boolean;
  private readonly client: Client | null;
  private readonly destination: string;

  constructor(options: QStashReminderSchedulerOptions) {
    this.configured = Boolean(options.token);
    this.client = options.token ? new Client({ token: options.token }) : null;
    this.destination = new URL(
      "/api/internal/notifications/tick",
      options.appUrl,
    ).toString();
  }

  async requestTick(): Promise<void> {
    if (!this.client) return;
    await this.client.publishJSON({
      url: this.destination,
      body: { reason: "reminder_changed", schemaVersion: 1 },
      retries: 3,
      timeout: "30s",
      flowControl: { key: "focused-notifications", parallelism: 1 },
    });
  }
}
