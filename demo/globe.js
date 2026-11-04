// A small rotating globe on a plain canvas, for picking a location.
import { LAND_RINGS } from "./land.js";

const GLOBE_RAD = Math.PI / 180;
const GLOBE_SPIN_DEGREES_PER_MS = 0.006;
const GLOBE_CLICK_SLOP_PX = 5;
const GLOBE_GRID_DEGREES = 30;

const wrapLongitude = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

// Orthographic projection onto a unit disc, with north up (positive y).
export function project(lat, lon, centerLat, centerLon) {
  const phi = lat * GLOBE_RAD;
  const phi0 = centerLat * GLOBE_RAD;
  const lambda = (lon - centerLon) * GLOBE_RAD;
  return {
    x: Math.cos(phi) * Math.sin(lambda),
    y: Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda),
    visible: Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda) >= 0,
  };
}

export function unproject(x, y, centerLat, centerLon) {
  const rho = Math.hypot(x, y);
  if (rho > 1) return undefined;
  if (rho === 0) return { lat: centerLat, lon: wrapLongitude(centerLon) };
  const c = Math.asin(rho);
  const phi0 = centerLat * GLOBE_RAD;
  const lat = Math.asin(Math.cos(c) * Math.sin(phi0) + (y * Math.sin(c) * Math.cos(phi0)) / rho);
  const lambda = Math.atan2(x * Math.sin(c), rho * Math.cos(c) * Math.cos(phi0) - y * Math.sin(c) * Math.sin(phi0));
  return { lat: lat / GLOBE_RAD, lon: wrapLongitude(centerLon + lambda / GLOBE_RAD) };
}

function traceLine(context, points, view, toCanvas) {
  let drawing = false;
  for (const [lon, lat] of points) {
    const point = project(lat, lon, view.lat, view.lon);
    if (!point.visible) {
      drawing = false;
      continue;
    }
    const [x, y] = toCanvas(point);
    if (drawing) context.lineTo(x, y);
    else context.moveTo(x, y);
    drawing = true;
  }
}

function gridLines() {
  const lines = [];
  for (let lon = -180; lon < 180; lon += GLOBE_GRID_DEGREES) {
    const line = [];
    for (let lat = -90; lat <= 90; lat += 5) line.push([lon, lat]);
    lines.push(line);
  }
  for (let lat = -60; lat <= 60; lat += GLOBE_GRID_DEGREES) {
    const line = [];
    for (let lon = -180; lon <= 180; lon += 5) line.push([lon, lat]);
    lines.push(line);
  }
  return lines;
}

export function mountGlobe(canvas, { picked: firstPicked, onPick }) {
  let picked = firstPicked;
  canvas.style.cursor = onPick ? "crosshair" : "grab";
  const context = canvas.getContext("2d");
  const grid = gridLines();
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const view = { lat: picked ? picked.lat * 0.6 : 20, lon: picked ? picked.lon : 0 };
  let drag = null;
  let lastFrame = performance.now();

  const size = () => canvas.clientWidth || canvas.width;

  function draw() {
    const scale = devicePixelRatio || 1;
    const pixels = size();
    if (canvas.width !== Math.round(pixels * scale)) {
      canvas.width = Math.round(pixels * scale);
      canvas.height = Math.round(pixels * scale);
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, pixels, pixels);
    const radius = pixels / 2 - 2;
    const toCanvas = ({ x, y }) => [pixels / 2 + x * radius, pixels / 2 - y * radius];

    context.beginPath();
    context.arc(pixels / 2, pixels / 2, radius, 0, Math.PI * 2);
    context.fillStyle = "#101a44";
    context.fill();
    context.strokeStyle = "#5564a8";
    context.lineWidth = 1;
    context.stroke();

    context.beginPath();
    for (const line of grid) traceLine(context, line, view, toCanvas);
    context.strokeStyle = "#26336e";
    context.lineWidth = 0.5;
    context.stroke();

    context.beginPath();
    for (const ring of LAND_RINGS) traceLine(context, ring, view, toCanvas);
    context.strokeStyle = "#9db4e8";
    context.lineWidth = 1;
    context.stroke();

    if (picked) {
      const point = project(picked.lat, picked.lon, view.lat, view.lon);
      if (point.visible) {
        const [x, y] = toCanvas(point);
        context.beginPath();
        context.arc(x, y, 4, 0, Math.PI * 2);
        context.fillStyle = "#f4d58d";
        context.fill();
        context.strokeStyle = "#0b1026";
        context.stroke();
      }
    }
  }

  function frame(time) {
    if (!drag && !calm) view.lon = wrapLongitude(view.lon + (time - lastFrame) * GLOBE_SPIN_DEGREES_PER_MS);
    lastFrame = time;
    draw();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", (event) => {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Dragging still works without capture, until the pointer leaves the canvas.
    }
    drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const degreesPerPixel = 180 / size();
    view.lon = wrapLongitude(view.lon - (event.clientX - drag.x) * degreesPerPixel);
    view.lat = Math.min(85, Math.max(-85, view.lat + (event.clientY - drag.y) * degreesPerPixel));
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener("pointerup", (event) => {
    const wasClick =
      drag && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= GLOBE_CLICK_SLOP_PX;
    drag = null;
    if (!wasClick || !onPick) return;
    const box = canvas.getBoundingClientRect();
    const radius = box.width / 2 - 2;
    const place = unproject(
      (event.clientX - box.left - box.width / 2) / radius,
      -(event.clientY - box.top - box.height / 2) / radius,
      view.lat,
      view.lon,
    );
    if (place) onPick(place);
  });
  canvas.addEventListener("pointercancel", () => {
    drag = null;
  });

  draw();
  requestAnimationFrame(frame);

  return {
    showPlace(place) {
      if (picked?.lat !== place.lat || picked?.lon !== place.lon) {
        view.lat = place.lat * 0.6;
        view.lon = place.lon;
      }
      picked = place;
    },
  };
}
