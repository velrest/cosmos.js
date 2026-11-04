// Low-precision sky math. Angles are in degrees. Ignores refraction, proper
// motion, and precession, which is plenty for deciding if a star is "up".

export const SUN_BORDER_DEGREES = 15;

const RAD = Math.PI / 180;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86_400_000;

const wrap360 = (degrees) => ((degrees % 360) + 360) % 360;
const daysSinceJ2000 = (date) => (date.getTime() - J2000_MS) / DAY_MS;

export function whereIsTheSun(date) {
  const n = daysSinceJ2000(date);
  const meanLongitude = wrap360(280.46 + 0.9856474 * n);
  const meanAnomaly = wrap360(357.528 + 0.9856003 * n) * RAD;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;
  return {
    ra: wrap360(
      Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude)) / RAD,
    ),
    dec: Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude)) / RAD,
  };
}

export function localSiderealDegrees(date, lon) {
  return wrap360(280.46061837 + 360.98564736629 * daysSinceJ2000(date) + lon);
}

export function altitudeDegrees(star, date, location) {
  const hourAngle = (localSiderealDegrees(date, location.lon) - star.ra) * RAD;
  const lat = location.lat * RAD;
  const dec = star.dec * RAD;
  const sine = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  return Math.asin(Math.min(1, Math.max(-1, sine))) / RAD;
}

// Clockwise from north, in 0 to 360.
export function azimuthDegrees(star, date, location) {
  const hourAngle = (localSiderealDegrees(date, location.lon) - star.ra) * RAD;
  const lat = location.lat * RAD;
  const dec = star.dec * RAD;
  const y = -Math.cos(dec) * Math.sin(hourAngle);
  const x = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(hourAngle);
  return wrap360(Math.atan2(y, x) / RAD);
}

export function separationDegrees(a, b) {
  const cosine =
    Math.sin(a.dec * RAD) * Math.sin(b.dec * RAD) +
    Math.cos(a.dec * RAD) * Math.cos(b.dec * RAD) * Math.cos((a.ra - b.ra) * RAD);
  return Math.acos(Math.min(1, Math.max(-1, cosine))) / RAD;
}

export function isStarInSky(star, date, location) {
  if (!location) return false;
  if (altitudeDegrees(star, date, location) <= 0) return false;
  return separationDegrees(star, whereIsTheSun(date)) >= SUN_BORDER_DEGREES;
}
