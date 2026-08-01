import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const appRoot = process.cwd();
const baseUrl = "http://127.0.0.1:3000";
const serverPath = resolve(
  appRoot,
  ".next",
  "standalone",
  "apps",
  "web",
  "server.js",
);
const playwrightCli = require.resolve("@playwright/test/cli");
const requestedTests = process.argv
  .slice(2)
  .filter((argument) => argument !== "--");
const childEnvironment = {
  ...process.env,
  HOSTNAME: "127.0.0.1",
  PORT: "3000",
};

let testProcess;

const server = spawn(process.execPath, [serverPath], {
  cwd: appRoot,
  env: childEnvironment,
  stdio: "inherit",
});

async function waitForHealth() {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `Standalone server exited before becoming healthy (${server.exitCode}).`,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(2_000),
      });

      if (response.ok) return;
    } catch {
      // The server may still be starting; retry until the bounded deadline.
    }

    await delay(250);
  }

  throw new Error(
    "Standalone server did not become healthy within 60 seconds.",
  );
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;

  const gracefulExit = once(child, "exit");
  child.kill("SIGTERM");
  await Promise.race([gracefulExit, delay(5_000)]);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    child.unref();
  }
}

const handleTermination = () => {
  void stopChild(testProcess);
  void stopChild(server);
};

process.once("SIGINT", handleTermination);
process.once("SIGTERM", handleTermination);

try {
  await waitForHealth();

  testProcess = spawn(
    process.execPath,
    [playwrightCli, "test", ...requestedTests],
    {
      cwd: appRoot,
      env: childEnvironment,
      stdio: "inherit",
    },
  );

  const [exitCode, signal] = await once(testProcess, "exit");

  if (exitCode !== 0) {
    throw new Error(
      signal
        ? `Playwright was terminated by ${signal}.`
        : `Playwright exited with code ${exitCode ?? "unknown"}.`,
    );
  }
} finally {
  process.removeListener("SIGINT", handleTermination);
  process.removeListener("SIGTERM", handleTermination);
  await stopChild(testProcess);
  await stopChild(server);
}
