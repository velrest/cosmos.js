// The manual test page. Not part of the framework.
import { gazeIntoSelf, initializeCosmos, renderCosmicPlane, onCosmicShift, gazeIntoConstellation, gazeIntoSky, gazeIntoStar, sendEnergyToStar, scanHeavens, channelLocation } from "../src/index.js";
import { mountGlobe } from "./globe.js";

const DEFAULT_PLACE = { lat: 47.37, lon: 8.54 };
const TAIPEI = { lat: 25.03, lon: 121.57 };
const DEMO_SEEDS = {
  Sirius: [{ name: "Ada" }, { name: "Grace" }],
  Polaris: { note: "Always up in the north" },
  Vega: { note: "A summer star" },
  Arcturus: { note: "A spring star" },
  Rigel: { note: "A winter star" },
  Canopus: { note: "Only for southern skies" },
  Acrux: { note: "The Southern Cross" },
};
const LEVELS_BY_ENERGY = [[75, "Connected or Ascended"], [50, "Aware"], [25, "Unconnected"], [10, "Hazed"]];

const element = (id) => document.getElementById(id);

const urlParams = new URLSearchParams(location.search);
const testMode = urlParams.get("test") !== "off";

function placeFromUrl() {
  const params = urlParams;
  if (!testMode || params.has("real")) return undefined;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  return params.has("lat") && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : DEFAULT_PLACE;
}

function travelTo(query) {
  location.search = query;
}

function renderPeople() {
  const people = gazeIntoStar("Sirius");
  const list = element("people");
  if (!Array.isArray(people)) {
    list.replaceChildren();
    element("people-note").textContent = "Sirius is hidden, or doesn't hold a list right now.";
    return;
  }
  element("people-note").textContent = "";
  list.replaceChildren(...people.map((person) => {
    const item = document.createElement("li");
    item.textContent = person?.name ?? JSON.stringify(person);
    return item;
  }));
}

function renderStatus() {
  const energy = gazeIntoSelf();
  element("energy").textContent = energy === undefined ? "hidden from you" : energy;
  const level = LEVELS_BY_ENERGY.find(([floor]) => energy >= floor)?.[1] ?? (energy === undefined ? "Blinded" : "Blinded");
  element("level").textContent = level;
  const sky = gazeIntoSky();
  element("sky").textContent = sky ? JSON.stringify(sky, null, 2) : "You can't see the sky right now.";
}

let cosmosReading = null;

function renderCosmosReading() {
  if (cosmosReading === null) return;
  const data = cosmosReading ? gazeIntoConstellation(cosmosReading) : gazeIntoSky();
  element("cosmos-result").textContent =
    data === undefined
      ? "You can't read this. The constellation may be hidden, unknown, or beyond your level."
      : JSON.stringify(data, null, 2);
}

let shownStars = null;

function formatTravelTime(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const leftover = minutes % 60;
  return leftover ? `${Math.floor(minutes / 60)} h ${leftover} min` : `${minutes / 60} h`;
}

function renderVisibleStars() {
  const stars = scanHeavens() ?? [];
  const fingerprint = stars.map((star) => `${star.name}:${star.readable}:${star.travelMs}`).join();
  if (fingerprint === shownStars) return;
  shownStars = fingerprint;
  const readable = stars.filter((star) => star.readable).length;
  element("visible-count").textContent = stars.length
    ? `${stars.length} stars in your sky, brightest first. Your level can read ${readable}, and the rest are greyed out. Reads are instant, and the time shown is how long a save takes to arrive at your current energy.`
    : "There's no sky to show until a location is known.";
  element("visible-stars").replaceChildren(...stars.map((star) => {
    const item = document.createElement("li");
    item.textContent = `${star.name} (${star.con}, mag ${star.mag}, ${formatTravelTime(star.travelMs)})`;
    if (!star.readable) item.className = "faded";
    return item;
  }));
}

let reading = null;

// A named star is read again each time. A random one stays tied to the star it got.
function renderReading() {
  if (!reading) return;
  const data = reading.name ? gazeIntoStar(reading.name) : reading.held;
  element("read-result").textContent =
    data === undefined
      ? "You can't read this star. It may be hidden, unknown, or beyond your level."
      : JSON.stringify(data, null, 2);
}

function explainDrop(name) {
  const energy = gazeIntoSelf();
  if (energy === undefined) return "You're Blinded, so you can't save anything. Use the ✦ button to gain energy.";
  if (energy < 50) return `Your energy is ${energy}. Saving needs 50 or more for the brightest stars, and 75 or more for the rest. Use the ✦ button to gain energy.`;
  if (!name) return `No unnamed star you can edit is in your sky. With energy ${energy}, saving to faint stars needs 75 or more.`;
  const star = scanHeavens()?.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
  if (!star) return `${name} isn't in your sky right now, or doesn't exist.`;
  if (energy < 75 && star.mag > 1.5) return `Your energy is ${energy}, and ${star.name} is too faint to edit below 75.`;
  return "The data must be a JSON object or array.";
}

function report(result, name) {
  if (!result) {
    element("save-note").textContent = `Dropped. ${explainDrop(name)}`;
    return;
  }
  const star = name && scanHeavens()?.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
  element("save-note").textContent = star
    ? `Sent to ${star.name}. It arrives in about ${formatTravelTime(star.travelMs)}.`
    : "Sent to a random unnamed star. It may take up to a few hours to arrive.";
  element("people-note").textContent = name === "Sirius" ? element("save-note").textContent : element("people-note").textContent;
}

function wireForms() {
  element("add-person").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = element("person-name");
    const people = gazeIntoStar("Sirius");
    const list = Array.isArray(people) ? [...people] : [];
    report(sendEnergyToStar("Sirius", [...list, { name: input.value }]), "Sirius");
    input.value = "";
  });

  element("read-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = element("read-star").value.trim();
    reading = name ? { name } : { held: gazeIntoStar() };
    renderReading();
  });

  element("cosmos-form").addEventListener("submit", (event) => {
    event.preventDefault();
    cosmosReading = element("cosmos-name").value.trim();
    renderCosmosReading();
  });

  element("save-form").addEventListener("submit", (event) => {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(element("save-data").value);
    } catch {
      element("save-note").textContent = "That isn't valid JSON.";
      return;
    }
    const name = element("save-star").value.trim();
    report(name ? sendEnergyToStar(name, data) : sendEnergyToStar(data), name);
  });
}

async function beginDemo() {
  const place = placeFromUrl();
  element("place").textContent = place
    ? `Simulated: ${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}`
    : "Your real location";
  const toggle = element("test-mode");
  toggle.checked = testMode;
  toggle.addEventListener("change", () => {
    if (toggle.checked) urlParams.delete("test");
    else urlParams.set("test", "off");
    travelTo(urlParams.toString());
  });

  element("use-real").hidden = !testMode;
  element("use-real").addEventListener("click", () => travelTo("?real=1"));
  element("globe").setAttribute(
    "aria-label",
    testMode ? "Globe. Drag to rotate, click to pick a location." : "Globe showing your location. Drag to rotate.",
  );
  const globe = mountGlobe(element("globe"), {
    picked: place,
    onPick: testMode ? ({ lat, lon }) => travelTo(`?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`) : undefined,
  });
  let cosmosAwake = false;
  let locationProblem = null;
  const coordinates = ({ lat, lon }) => `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  const renderPlace = () => {
    if (!cosmosAwake) return;
    const here = channelLocation();
    if (!here) return;
    globe.showPlace(here);
    const unavailable = locationProblem && `Your real location isn't available: ${locationProblem}.`;
    if (here.source === "simulated") element("place").textContent = `Simulated: ${coordinates(here)}`;
    else if (here.source === "real") {
      element("place").textContent = unavailable
        ? `${unavailable} Using the last known one: ${coordinates(here)}`
        : `Your real location: ${coordinates(here)}`;
    } else {
      element("place").textContent = unavailable
        ? `${unavailable} Showing the sky over Taipei instead.`
        : "Your real location isn't known yet. Showing the sky over Taipei for now.";
    }
  };
  if (!place) {
    if (!navigator.geolocation) locationProblem = "this browser has no location support";
    navigator.geolocation?.watchPosition(
      () => {
        locationProblem = null;
        renderPlace();
      },
      (error) => {
        locationProblem = error.message || "the browser gave no reason";
        renderPlace();
      },
      { timeout: 15_000 },
    );
  }
  wireForms();

  await initializeCosmos(DEMO_SEEDS, {
    revealFates: testMode,
    ascendedPrompts: testMode,
    ...(place ? { simulatedLocation: place } : { fallbackLocation: TAIPEI }),
  });
  cosmosAwake = true;
  onCosmicShift(() => {
    renderPlace();
    renderPeople();
    renderStatus();
    renderVisibleStars();
    renderReading();
    renderCosmosReading();
  });
  renderCosmicPlane(element("star-map"));
  document.body.setAttribute("data-demo-ready", "");
}

beginDemo();
