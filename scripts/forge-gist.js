// Run: node scripts/forge-gist.js
// Builds gist/index.html, one self-contained file, because gists can't hold folders.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const GITHUB_PAGE = read("README.md").match(/^\*\*GitHub page:\*\* (.+)$/m)?.[1] ?? "Not set";

// In dependency order. Top-level names must not collide across these files.
const MODULES = ["src/data/star-chart-data.js", "src/star-chart.js", "src/celestial-mechanics.js", "src/energyspeed.js",
  "src/karma.js", "src/mirage.js", "src/cosmos.js", "src/akashic-records.js", "src/oracle.js", "src/star-map.js", "src/index.js",
  "demo/land.js", "demo/globe.js", "demo/demo.js"];

const BUNDLE_NOTICE = `// cosmos.js, licensed under GPL-3.0-only. Source: https://github.com/velrest/cosmos.js
// Star data is adapted from the HYG Database by David Nash, CC BY-SA 4.0.
// Land outlines are from Natural Earth, public domain.`;

const flatten = (source) =>
  source
    .replace(/^import\s[\s\S]*?\sfrom\s+"[^"]+";\n/gm, "")
    .replace(/^export (?=const|let|function|async function|class)/gm, "");

const bundle = MODULES.map((path) => `// ${path}\n${flatten(read(path))}`).join("\n");
if (bundle.includes("</script")) throw new Error("A module contains a closing script tag");

const page = read("demo/index.html").replace(
  /<script type="module" src="\.\/demo\.js"[^>]*><\/script>/,
  () => `<script type="module">\n${BUNDLE_NOTICE}\n${bundle}</script>`,
);
if (page === read("demo/index.html")) throw new Error("Script tag not found in demo/index.html");

mkdirSync(new URL("gist/", root), { recursive: true });
writeFileSync(new URL("gist/index.html", root), page);
writeFileSync(
  new URL("gist/README.md", root),
  `# cosmos.js demo\n\nA self-contained demo of cosmos.js, a data framework where the real sky controls what you can read. Gists don't serve pages themselves, so open \`index.html\` through a gist viewer such as [githack](https://raw.githack.com/).\n\n**GitHub page:** ${GITHUB_PAGE}\n\nStar data comes from the [HYG Database](https://github.com/astronexus/HYG-Database), CC BY-SA 4.0. Land outlines come from [Natural Earth](https://www.naturalearthdata.com/), public domain.\n\nLicensed under the GNU General Public License v3.0. Source and license: https://github.com/velrest/cosmos.js\n`,
);
console.log(`Wrote gist/index.html, ${Math.round(page.length / 1024)} KB`);
