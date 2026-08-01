import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_BUILD_DIRECTORY = "apps/web/.next";
const DEFAULT_BUDGET_FILE = "config/performance-budgets.json";
const DEFAULT_OUTPUT_FILE = "apps/web/.next/optimization-report.json";

export async function analyzeBuild({ buildDirectory, budgetFile }) {
  const budgets = parseBudgets(JSON.parse(await readFile(budgetFile, "utf8")));
  const manifestRoot = path.join(buildDirectory, "server", "app", "[locale]");
  const manifests = (await findFiles(manifestRoot)).filter((file) =>
    file.endsWith("page_client-reference-manifest.js"),
  );
  if (manifests.length === 0) {
    throw new Error(`No locale page manifests found under ${manifestRoot}.`);
  }

  const routes = [];
  for (const manifestFile of manifests) {
    const manifest = parseClientReferenceManifest(
      await readFile(manifestFile, "utf8"),
    );
    const route = routeFromManifestFile(manifestRoot, manifestFile);
    const javascript = unique(
      Object.values(manifest.clientModules).flatMap((module) => module.chunks),
    ).filter(isStaticJavaScript);
    const stylesheets = unique(
      Object.values(manifest.entryCSSFiles).flatMap((entries) =>
        entries.map((entry) => entry.path),
      ),
    );
    const loadingEntries = Object.entries(manifest.entryJSFiles)
      .filter(
        ([entry]) =>
          entry.endsWith("/[locale]/layout") ||
          entry.endsWith(`/${routeSegment(route)}/loading`),
      )
      .flatMap(([, chunks]) => chunks);

    routes.push({
      route,
      javascript: await measureFiles(buildDirectory, javascript),
      stylesheets: await measureFiles(buildDirectory, stylesheets),
      loadingJavaScript: await measureFiles(
        buildDirectory,
        unique(loadingEntries),
      ),
    });
  }

  routes.sort((left, right) => left.route.localeCompare(right.route));
  const serviceWorker = await measureFile(
    path.resolve(buildDirectory, "..", "public", "sw.js"),
  );
  const violations = [];
  for (const route of routes) {
    enforce(
      violations,
      `${route.route} JavaScript`,
      route.javascript.gzipBytes,
      budgets.routeJavaScriptGzipBytes,
    );
    enforce(
      violations,
      `${route.route} stylesheet`,
      route.stylesheets.gzipBytes,
      budgets.routeStylesheetGzipBytes,
    );
    enforce(
      violations,
      `${route.route} loading JavaScript`,
      route.loadingJavaScript.gzipBytes,
      budgets.loadingJavaScriptGzipBytes,
    );
  }
  enforce(
    violations,
    "service worker",
    serviceWorker.rawBytes,
    budgets.serviceWorkerBytes,
  );

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    budgets,
    summary: {
      passed: violations.length === 0,
      routeCount: routes.length,
      violations,
    },
    routes,
    serviceWorker,
  };
}

export function parseBudgets(candidate) {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Performance budgets must be a JSON object.");
  }
  if (candidate.schemaVersion !== 1) {
    throw new Error("Unsupported performance budget schema version.");
  }
  for (const key of [
    "routeJavaScriptGzipBytes",
    "routeStylesheetGzipBytes",
    "loadingJavaScriptGzipBytes",
    "serviceWorkerBytes",
  ]) {
    if (!Number.isSafeInteger(candidate[key]) || candidate[key] <= 0) {
      throw new Error(`${key} must be a positive safe integer.`);
    }
  }
  return candidate;
}

export function parseClientReferenceManifest(source) {
  const assignment = source.indexOf(" = ", source.indexOf("__RSC_MANIFEST["));
  if (assignment < 0) throw new Error("Invalid client reference manifest.");
  return JSON.parse(
    source
      .slice(assignment + 3)
      .trim()
      .replace(/;$/u, ""),
  );
}

async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? findFiles(target) : [target];
    }),
  );
  return nested.flat();
}

function routeFromManifestFile(root, file) {
  const relative = path
    .relative(root, file)
    .replaceAll(path.sep, "/")
    .replace(/(^|\/)page_client-reference-manifest\.js$/u, "");
  const segments = relative
    .split("/")
    .filter((segment) => segment && !segment.startsWith("("));
  return `/[locale]${segments.length > 0 ? `/${segments.join("/")}` : ""}`;
}

function routeSegment(route) {
  return route.replace(/^\/\[locale\]\/?/u, "");
}

function isStaticJavaScript(file) {
  return file.startsWith("/_next/static/") || file.startsWith("static/");
}

function normalizeBuildPath(file) {
  return file.replace(/^\/_next\//u, "");
}

async function measureFiles(buildDirectory, files) {
  const buffers = await Promise.all(
    files.map((file) =>
      readFile(path.join(buildDirectory, normalizeBuildPath(file))),
    ),
  );
  return {
    fileCount: buffers.length,
    rawBytes: buffers.reduce((total, buffer) => total + buffer.byteLength, 0),
    gzipBytes: buffers.reduce(
      (total, buffer) => total + gzipSync(buffer).byteLength,
      0,
    ),
  };
}

async function measureFile(file) {
  const buffer = await readFile(file);
  return {
    fileCount: 1,
    rawBytes: buffer.byteLength,
    gzipBytes: gzipSync(buffer).byteLength,
  };
}

function unique(items) {
  return [...new Set(items)];
}

function enforce(violations, label, actual, limit) {
  if (actual > limit) violations.push({ label, actual, limit });
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback;
}

async function main() {
  const report = await analyzeBuild({
    buildDirectory: path.resolve(
      option("--build-dir", DEFAULT_BUILD_DIRECTORY),
    ),
    budgetFile: path.resolve(option("--budget", DEFAULT_BUDGET_FILE)),
  });
  const output = path.resolve(option("--output", DEFAULT_OUTPUT_FILE));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const largestRoute = [...report.routes].sort(
    (left, right) => right.javascript.gzipBytes - left.javascript.gzipBytes,
  )[0];
  console.log(
    `Optimization budgets: ${report.summary.passed ? "PASS" : "FAIL"}; ` +
      `${report.summary.routeCount} routes; largest route ${largestRoute.route} ` +
      `${largestRoute.javascript.gzipBytes} B gzip.`,
  );
  if (!report.summary.passed) {
    for (const violation of report.summary.violations) {
      console.error(
        `${violation.label}: ${violation.actual} B exceeds ${violation.limit} B.`,
      );
    }
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
