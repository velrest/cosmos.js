// Runs each test page in headless Chromium. Pages post their results back here.
// No dependencies.
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const CONTENT_TYPES = { ".html": "text/html", ".js": "text/javascript" };
const PAGE_TIMEOUT_MS = 40_000;

let deliverResults = () => {};

const server = createServer((request, response) => {
  if (request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      response.writeHead(204).end();
      deliverResults(body);
    });
    return;
  }
  const path = join(root, normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)));
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": CONTENT_TYPES[extname(path)] ?? "text/plain" });
  createReadStream(path).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

function visit(url) {
  const profile = mkdtempSync(join(tmpdir(), "cosmos-test-"));
  return new Promise((resolve) => {
    const browser = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-data-dir=${profile}`,
      "--enable-logging=stderr", "--remote-debugging-port=0", url]);
    let results = "";
    let log = "";
    browser.stdout.resume();
    browser.stderr.on("data", (chunk) => (log += chunk));
    const guard = setTimeout(() => browser.kill("SIGKILL"), PAGE_TIMEOUT_MS);
    deliverResults = (body) => {
      results = body;
      browser.kill("SIGKILL");
    };
    browser.on("close", () => {
      clearTimeout(guard);
      rmSync(profile, { recursive: true, force: true });
      resolve({ results, log });
    });
  });
}

const wanted = process.argv[2];
const pages = readdirSync(here).filter((file) => file.endsWith(".html") && (!wanted || file.includes(wanted)));
let failed = pages.length === 0 && wanted !== "file";

for (const page of pages) {
  const { results, log } = await visit(`${origin}/tests/browser/${page}`);
  const lines = results.split("\n");
  const uncaught = log.split("\n").filter((line) => line.includes("Uncaught"));
  const ok = lines.includes("ALL PASS") && uncaught.length === 0;
  const passes = lines.filter((line) => line.startsWith("PASS")).length;
  console.log(`${ok ? "ok    " : "FAILED"} ${page} (${passes} checks)`);
  for (const line of lines) if (line.startsWith("FAIL")) console.log(`  ${line}`);
  for (const line of uncaught) console.log(`  ${line.slice(0, 300)}`);
  if (!results) console.log("  the page reported nothing before the timeout");
  failed ||= !ok;
}

server.close();

// Opened straight from disk, the source demo can't load its modules and must say so.
if (!wanted || wanted === "file") {
  const profile = mkdtempSync(join(tmpdir(), "cosmos-test-"));
  const dom = await new Promise((resolve) => {
    const browser = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-data-dir=${profile}`,
      "--virtual-time-budget=3000", "--dump-dom", `file://${join(root, "demo", "index.html")}`]);
    let output = "";
    browser.stdout.on("data", (chunk) => (output += chunk));
    browser.stderr.resume();
    browser.on("close", () => resolve(output));
  });
  rmSync(profile, { recursive: true, force: true });
  const banner = dom.match(/<p id="load-failed"[^>]*>/)?.[0] ?? "";
  const ok = banner !== "" && !banner.includes("hidden");
  console.log(`${ok ? "ok    " : "FAILED"} demo/index.html from file:// explains itself`);
  failed ||= !ok;
}

process.exit(failed ? 1 : 0);
