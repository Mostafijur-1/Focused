import "server-only";

import { getServerEnvironment } from "@/lib/config/server-env";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogAttributes = Readonly<Record<string, unknown>>;

const levelPriority: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const sensitiveKeyPattern =
  /authorization|cookie|password|secret|token|journal|note|prompt|content/i;

function redact(attributes: LogAttributes): LogAttributes {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[REDACTED]" : value,
    ]),
  );
}

function write(
  level: LogLevel,
  message: string,
  attributes: LogAttributes = {},
): void {
  const configuredLevel = getServerEnvironment().LOG_LEVEL;
  if (levelPriority[level] < levelPriority[configuredLevel]) {
    return;
  }

  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(attributes),
  });

  if (level === "error") {
    console.error(entry);
    return;
  }
  if (level === "warn") {
    console.warn(entry);
    return;
  }
  console.log(entry);
}

export const logger = {
  debug: (message: string, attributes?: LogAttributes) =>
    write("debug", message, attributes),
  info: (message: string, attributes?: LogAttributes) =>
    write("info", message, attributes),
  warn: (message: string, attributes?: LogAttributes) =>
    write("warn", message, attributes),
  error: (message: string, attributes?: LogAttributes) =>
    write("error", message, attributes),
} as const;
