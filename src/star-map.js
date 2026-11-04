// The admin star map: a sky chart with the zenith in the center and the
// horizon at the edge. Like any sky chart seen from below, east is on the left.

const MAP_RAD = Math.PI / 180;
const MAP_MARGIN_PX = 24;
const MAP_CLICK_REACH_PX = 14;
const MAP_REFRESH_MS = 1000;
const MAP_SUN_BORDER_DEGREES = 15;

const STAR_MAP_STYLE = `
  :host { display: block; }
  * { box-sizing: border-box; font-family: Georgia, "Times New Roman", serif; }
  .map { color: #e8e6f0; }
  .layout { display: grid; gap: 16px; }
  canvas { display: block; width: 100%; aspect-ratio: 1; cursor: pointer; border-radius: 8px; background: #070b1e; }
  button { font: inherit; color: inherit; cursor: pointer; }
  button:focus-visible, canvas:focus-visible { outline: 2px solid #f4d58d; outline-offset: 2px; }
  .side { min-width: 0; }
  .heading { margin: 0 0 6px; color: #f4d58d; font-size: 15px; font-weight: normal; }
  .list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
  .list button { padding: 3px 9px; border: 1px solid #f4d58d; border-radius: 12px; background: #151b3c; font-size: 13px; }
  .list button:hover, .list button[aria-pressed="true"] { background: #38396a; }
  .quiet { margin: 0; color: #a9aecb; font-size: 14px; }
  pre { margin: 4px 0 12px; padding: 8px; max-height: 260px; overflow: auto; border-radius: 6px; background: #070b1e; font: 13px/1.45 ui-monospace, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
  .key { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; color: #a9aecb; font-size: 13px; }
  .key span::before { content: ""; display: inline-block; width: 9px; height: 9px; margin-right: 5px; border-radius: 50%; }
  .key .empty::before { background: #ffffff; }
  .key .data::before { background: #4ade80; }
  .key .moving::before { border: 2px solid #7dd3fc; }
  .key .sun::before { background: #f59e0b; }
  [hidden] { display: none !important; }
`;

export function polarPoint(altitude, azimuth) {
  const distance = (90 - altitude) / 90;
  return {
    x: -distance * Math.sin(azimuth * MAP_RAD),
    y: distance * Math.cos(azimuth * MAP_RAD),
  };
}

// Each magnitude step is a real brightness ratio of about 2.5 times. A screen
// can't show that full range, so opacity follows it on a compressed scale.
export function starGlow(mag) {
  const relativeFlux = 10 ** (-0.4 * mag);
  return {
    radius: Math.max(0.5, 3.4 * relativeFlux ** 0.25),
    alpha: Math.min(1, Math.max(0.12, relativeFlux ** 0.3)),
  };
}

export function nearestStar(points, x, y, reach) {
  let best;
  let bestDistance = reach;
  for (const point of points) {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

export function arrivalText(ms) {
  if (ms < 1000) return "under a second";
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const leftover = minutes % 60;
  return leftover ? `${Math.floor(minutes / 60)} h ${leftover} min` : `${minutes / 60} h`;
}

export function summonStarMap(cosmos, element) {
  const shadow = element.shadowRoot ?? element.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STAR_MAP_STYLE;

  const root = document.createElement("div");
  root.className = "map";
  const locked = document.createElement("p");
  locked.className = "quiet";
  const layout = document.createElement("div");
  layout.className = "layout";

  const chart = document.createElement("div");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Map of the stars in your sky. Stars holding data are also listed beside it.");
  const key = document.createElement("div");
  key.className = "key";
  for (const [name, text] of [["empty", "No data"], ["data", "Holds data"], ["moving", "Save on its way"], ["sun", "Sun, with its blocked zone"]]) {
    const entry = document.createElement("span");
    entry.className = name;
    entry.textContent = text;
    key.append(entry);
  }
  chart.append(canvas, key);

  const side = document.createElement("div");
  side.className = "side";
  const listHeading = document.createElement("h3");
  listHeading.className = "heading";
  listHeading.textContent = "Stars holding data";
  const list = document.createElement("div");
  list.className = "list";
  const details = document.createElement("div");
  details.dataset.details = "";
  details.setAttribute("role", "status");
  side.append(listHeading, list, details);

  layout.append(chart, side);
  root.append(locked, layout);
  shadow.replaceChildren(style, root);

  let selected = null;
  let points = [];
  let shownList = "";

  function chartMetrics() {
    const size = canvas.clientWidth || 480;
    return { size, center: size / 2, radius: size / 2 - MAP_MARGIN_PX };
  }

  function drawChart(audit) {
    const { size, center, radius } = chartMetrics();
    const scale = devicePixelRatio || 1;
    if (canvas.width !== Math.round(size * scale)) {
      canvas.width = Math.round(size * scale);
      canvas.height = Math.round(size * scale);
    }
    const context = canvas.getContext("2d");
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, size, size);
    const toCanvas = ({ altitude, azimuth }) => {
      const point = polarPoint(altitude, azimuth);
      return { x: center + point.x * radius, y: center - point.y * radius };
    };

    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.fillStyle = "#0d1436";
    context.fill();
    context.strokeStyle = "#3a4470";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = "#a9aecb";
    context.font = "13px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const [label, azimuth] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
      const edge = polarPoint(0, azimuth);
      context.fillText(label, center + edge.x * (radius + 12), center - edge.y * (radius + 12));
    }

    context.strokeStyle = "#232c5c";
    for (const altitude of [30, 60]) {
      context.beginPath();
      context.arc(center, center, (radius * (90 - altitude)) / 90, 0, Math.PI * 2);
      context.stroke();
    }

    points = audit.stars.map((star) => ({ ...toCanvas(star), star }));
    for (const { x, y, star } of points) {
      if (star.holdsData) continue;
      const glow = starGlow(star.mag);
      context.beginPath();
      context.arc(x, y, glow.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(255, 255, 255, ${glow.alpha})`;
      context.fill();
    }
    // Green stars go on top, and stay big enough to find even when faint.
    for (const { x, y, star } of points) {
      if (!star.holdsData) continue;
      const glow = starGlow(star.mag);
      context.beginPath();
      context.arc(x, y, Math.max(2, glow.radius), 0, Math.PI * 2);
      context.fillStyle = `rgba(74, 222, 128, ${Math.max(0.6, glow.alpha)})`;
      context.fill();
    }
    for (const { x, y, star } of points) {
      if (!star.pendingCount && star.name !== selected) continue;
      context.beginPath();
      context.arc(x, y, star.name === selected ? 8 : 5, 0, Math.PI * 2);
      context.strokeStyle = star.name === selected ? "#ffffff" : "#7dd3fc";
      context.lineWidth = star.name === selected ? 2 : 1.5;
      context.stroke();
    }

    // The sun outshines everything, but only while it's above the horizon.
    if (audit.sun.altitude > 0) {
      const sun = toCanvas(audit.sun);
      const zone = (radius * MAP_SUN_BORDER_DEGREES) / 90;
      context.save();
      context.beginPath();
      context.arc(center, center, radius, 0, Math.PI * 2);
      context.clip();
      const glare = context.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, zone);
      glare.addColorStop(0, "rgba(255, 214, 110, 0.75)");
      glare.addColorStop(1, "rgba(255, 214, 110, 0)");
      context.fillStyle = glare;
      context.beginPath();
      context.arc(sun.x, sun.y, zone, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(sun.x, sun.y, zone, 0, Math.PI * 2);
      context.setLineDash([4, 4]);
      context.strokeStyle = "#f59e0b";
      context.lineWidth = 1;
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.arc(sun.x, sun.y, 9, 0, Math.PI * 2);
      context.fillStyle = "#ffe08a";
      context.fill();
      context.restore();
    }
  }

  function renderList(audit) {
    const holders = audit.stars.filter((star) => star.holdsData || star.pendingCount).map((star) => star.name).sort();
    const key = `${holders.join()}|${selected}`;
    if (key === shownList) return;
    shownList = key;
    if (holders.length === 0) {
      const empty = document.createElement("p");
      empty.className = "quiet";
      empty.textContent = "None in your sky right now.";
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...holders.map((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.star = name;
      button.textContent = name;
      button.setAttribute("aria-pressed", String(name === selected));
      button.addEventListener("click", () => select(name));
      return button;
    }));
  }

  function addBlock(heading, value) {
    const title = document.createElement("h3");
    title.className = "heading";
    title.textContent = heading;
    const block = document.createElement("pre");
    block.textContent = JSON.stringify(value, null, 2);
    details.append(title, block);
  }

  function renderDetails() {
    details.replaceChildren();
    const star = selected && cosmos.pierceStarVeil(selected);
    if (!star) {
      const hint = document.createElement("p");
      hint.className = "quiet";
      hint.textContent = selected ? `${selected} has left your sky.` : "Click a star to see what it holds.";
      details.append(hint);
      return;
    }
    const title = document.createElement("h3");
    title.className = "heading";
    title.textContent = `${star.name} (${star.con}, magnitude ${star.mag}, ${star.ly} light years)`;
    details.append(title);
    if (star.data === undefined) {
      const empty = document.createElement("p");
      empty.className = "quiet";
      empty.textContent = "Holds no data.";
      details.append(empty);
    } else {
      const block = document.createElement("pre");
      block.textContent = JSON.stringify(star.data, null, 2);
      details.append(block);
    }
    for (const update of star.pending) addBlock(`On its way, arrives in ${arrivalText(update.arrivesInMs)}`, update.data);
  }

  function render() {
    const audit = cosmos.pierceVeil();
    canvas.hidden = !audit;
    layout.hidden = !audit;
    locked.hidden = Boolean(audit);
    if (!audit) {
      locked.textContent = cosmos.level() === "Ascended"
        ? "The star map needs a location."
        : "Only Ascended users can see the star map.";
      selected = null;
      shownList = "";
      list.replaceChildren();
      details.replaceChildren();
      return;
    }
    drawChart(audit);
    renderList(audit);
    renderDetails();
  }

  function select(name) {
    selected = name;
    render();
  }

  canvas.addEventListener("click", (event) => {
    const box = canvas.getBoundingClientRect();
    const hit = nearestStar(points, event.clientX - box.left, event.clientY - box.top, MAP_CLICK_REACH_PX);
    if (hit) select(hit.star.name);
  });

  const stopShifts = cosmos.onCosmicShift(render);
  const stopLaunches = cosmos.onLaunch(render);
  // Keeps arrival countdowns current.
  const ticker = setInterval(render, MAP_REFRESH_MS);
  return () => {
    stopShifts();
    stopLaunches();
    clearInterval(ticker);
    shadow.replaceChildren();
  };
}
