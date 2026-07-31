import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = process.cwd();
const standaloneRoot = resolve(appRoot, ".next", "standalone", "apps", "web");

if (!existsSync(resolve(standaloneRoot, "server.js"))) {
  throw new Error(
    "Standalone server was not generated. Ensure next.config.ts sets output to 'standalone'.",
  );
}

const assets = [
  {
    source: resolve(appRoot, ".next", "static"),
    destination: resolve(standaloneRoot, ".next", "static"),
    required: true,
  },
  {
    source: resolve(appRoot, "public"),
    destination: resolve(standaloneRoot, "public"),
    required: false,
  },
];

for (const asset of assets) {
  if (!existsSync(asset.source)) {
    if (asset.required) {
      throw new Error(`Required standalone asset is missing: ${asset.source}`);
    }

    continue;
  }

  mkdirSync(asset.destination, { recursive: true });
  cpSync(asset.source, asset.destination, { recursive: true, force: true });
}
