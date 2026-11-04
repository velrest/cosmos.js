// Star and constellation lookups over the generated catalog.
import { STAR_ROWS } from "./data/star-chart-data.js";

const BRIGHTEST_MAGNITUDE = 1.5;

const CONSTELLATION_NAMES = {
  And: "Andromeda", Ant: "Antlia", Aps: "Apus", Aql: "Aquila", Aqr: "Aquarius", Ara: "Ara", Ari: "Aries",
  Aur: "Auriga", Boo: "Bootes", CMa: "Canis Major", CMi: "Canis Minor", CVn: "Canes Venatici", Cae: "Caelum",
  Cam: "Camelopardalis", Cap: "Capricornus", Car: "Carina", Cas: "Cassiopeia", Cen: "Centaurus", Cep: "Cepheus",
  Cet: "Cetus", Cha: "Chamaeleon", Cir: "Circinus", Cnc: "Cancer", Col: "Columba", Com: "Coma Berenices",
  CrA: "Corona Australis", CrB: "Corona Borealis", Crt: "Crater", Cru: "Crux", Crv: "Corvus", Cyg: "Cygnus",
  Del: "Delphinus", Dor: "Dorado", Dra: "Draco", Equ: "Equuleus", Eri: "Eridanus", For: "Fornax", Gem: "Gemini",
  Gru: "Grus", Her: "Hercules", Hor: "Horologium", Hya: "Hydra", Hyi: "Hydrus", Ind: "Indus", LMi: "Leo Minor",
  Lac: "Lacerta", Leo: "Leo", Lep: "Lepus", Lib: "Libra", Lup: "Lupus", Lyn: "Lynx", Lyr: "Lyra", Men: "Mensa",
  Mic: "Microscopium", Mon: "Monoceros", Mus: "Musca", Nor: "Norma", Oct: "Octans", Oph: "Ophiuchus", Ori: "Orion",
  Pav: "Pavo", Peg: "Pegasus", Per: "Perseus", Phe: "Phoenix", Pic: "Pictor", PsA: "Piscis Austrinus",
  Psc: "Pisces", Pup: "Puppis", Pyx: "Pyxis", Ret: "Reticulum", Scl: "Sculptor", Sco: "Scorpius", Sct: "Scutum",
  Ser: "Serpens", Sex: "Sextans", Sge: "Sagitta", Sgr: "Sagittarius", Tau: "Taurus", Tel: "Telescopium",
  TrA: "Triangulum Australe", Tri: "Triangulum", Tuc: "Tucana", UMa: "Ursa Major", UMi: "Ursa Minor", Vel: "Vela",
  Vir: "Virgo", Vol: "Volans", Vul: "Vulpecula",
};

const starsByName = new Map();
const constellations = new Map();
const constellationsByKey = new Map();

for (const [code, name] of Object.entries(CONSTELLATION_NAMES)) {
  const constellation = { code, name, stars: [] };
  constellations.set(code, constellation);
  constellationsByKey.set(code.toLowerCase(), constellation);
  constellationsByKey.set(name.toLowerCase(), constellation);
}

export const EVERY_STAR = [];
export const UNNAMED_STARS = [];

for (const [name, ra, dec, mag, ly, con] of STAR_ROWS) {
  const star = { name, ra, dec, mag, ly, con };
  EVERY_STAR.push(star);
  starsByName.set(name.toLowerCase(), star);
  constellations.get(con)?.stars.push(star);
  if (name.startsWith("HYG ")) UNNAMED_STARS.push(star);
}

export function findStar(name) {
  return typeof name === "string" ? starsByName.get(name.toLowerCase()) : undefined;
}

export function findConstellation(nameOrCode) {
  return typeof nameOrCode === "string" ? constellationsByKey.get(nameOrCode.toLowerCase()) : undefined;
}

export function isBrightest(star) {
  return star.mag <= BRIGHTEST_MAGNITUDE;
}
