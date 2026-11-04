const lines = [];
let failed = false;

export function check(name, condition) {
  if (!condition) failed = true;
  lines.push(`${condition ? "PASS" : "FAIL"} ${name}`);
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function stubGeolocation(answer) {
  const stub = {
    calls: 0,
    watchPosition(success) {
      stub.calls++;
      if (answer) success({ coords: answer });
      return 1;
    },
    clearWatch() {},
  };
  Object.defineProperty(navigator, "geolocation", { value: stub, configurable: true });
  return stub;
}

export async function finish() {
  if (!failed) lines.push("ALL PASS");
  await fetch("/results", { method: "POST", body: lines.join("\n") });
}

export function run(body) {
  body().catch((error) => check(`no unexpected error: ${error.stack}`, false)).finally(finish);
}
