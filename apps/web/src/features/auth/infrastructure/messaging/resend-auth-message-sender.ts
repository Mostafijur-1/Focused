import type {
  AuthMessage,
  AuthMessageSender,
} from "@/features/auth/application/ports";
import { AppError } from "@/lib/errors/app-error";

interface ResendMessageSenderOptions {
  readonly apiKey: string;
  readonly from: string;
}

export class ResendAuthMessageSender implements AuthMessageSender {
  constructor(private readonly options: ResendMessageSenderOptions) {}

  async send(message: AuthMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [message.recipient],
        subject: subjectFor(message),
        text: textFor(message),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new AppError({
        code: "DEPENDENCY_UNAVAILABLE",
        safeMessage:
          "The security message could not be sent. Please try again.",
      });
    }
  }
}

function subjectFor(message: AuthMessage): string {
  if (message.locale === "bn-BD") {
    return message.kind === "verify_email"
      ? "Focused—আপনার email যাচাই করুন"
      : "Focused—নতুন password তৈরি করুন";
  }
  return message.kind === "verify_email"
    ? "Verify your Focused email"
    : "Create a new Focused password";
}

function textFor(message: AuthMessage): string {
  if (message.locale === "bn-BD") {
    return `${message.displayName},\n\nনিরাপদভাবে এগোতে নিচের link খুলুন। Linkটি ${message.expiresInMinutes} মিনিট কার্যকর থাকবে।\n\n${message.actionUrl}\n\nআপনি অনুরোধটি না করে থাকলে messageটি উপেক্ষা করুন।`;
  }
  return `${message.displayName},\n\nOpen the secure link below. It expires in ${message.expiresInMinutes} minutes.\n\n${message.actionUrl}\n\nIgnore this message if you did not request it.`;
}
