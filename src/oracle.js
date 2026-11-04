// The injected energy prompt. It is the framework's only UI.

const ORACLE_CHECK_MS = 1000;
const ORACLE_RESULT_MS = 2000;
const ZODIAC_GLYPHS = { Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍", Libra: "♎",
  Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓" };
const FATE_RESULTS = { right: "Energy rises", bad: "Energy falls hard", neutral: "Energy falls a little" };
const FATE_LABELS = { right: "positive", bad: "negative", neutral: "neutral" };

const ORACLE_STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: Georgia, "Times New Roman", serif; }
  button { font: inherit; cursor: pointer; }
  button:focus-visible { outline: 2px solid #f4d58d; outline-offset: 2px; }
  .opener {
    position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; display: block;
    width: 48px; height: 48px; border-radius: 50%; border: 1px solid #f4d58d; color: #f4d58d;
    background: #0b1026; font-size: 22px; box-shadow: 0 2px 14px #0008;
  }
  .opener:disabled { opacity: 0.45; cursor: not-allowed; }
  .panel {
    position: fixed; right: 16px; bottom: 76px; z-index: 2147483647; width: min(320px, calc(100vw - 32px));
    padding: 16px; border-radius: 12px; border: 1px solid #3a4470; color: #e8e6f0;
    background: #0b1026; box-shadow: 0 6px 28px #000a;
  }
  .heading { display: flex; justify-content: space-between; align-items: center; font-size: 15px; color: #f4d58d; }
  .closer { border: 0; background: none; color: #a9aecb; font-size: 20px; line-height: 1; padding: 2px 6px; }
  .signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
  .sign {
    display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 2px; min-height: 76px;
    border-radius: 8px; border: 1px solid #3a4470; background: #151b3c; color: inherit; font-size: 12px;
  }
  .sign:hover { background: #20285a; }
  .glyph { font-size: 24px; line-height: 1; }
  .sign.right { border: 2px solid #4ade80; }
  .sign.bad { border: 2px solid #f87171; }
  .sign.neutral { border: 2px solid #9ca3af; }
  .fate { font-size: 11px; font-weight: bold; }
  .right .fate { color: #4ade80; }
  .bad .fate { color: #f87171; }
  .neutral .fate { color: #d1d5db; }
  .result { min-height: 20px; margin-top: 10px; font-size: 13px; color: #c8cbe0; text-align: center; }
  [hidden] { display: none !important; }
`;

export function summonOracle(cosmos, { revealFates = false, ascendedPrompts = false } = {}) {
  const host = document.createElement("div");
  host.setAttribute("data-stellar-oracle", "");
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = ORACLE_STYLE;

  const opener = document.createElement("button");
  opener.className = "opener";
  opener.dataset.opener = "";
  opener.textContent = "✦";
  opener.setAttribute("aria-label", "Read the stars");

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Choose a star sign");

  const heading = document.createElement("div");
  heading.className = "heading";
  const title = document.createElement("span");
  title.textContent = "Choose a sign";
  const closer = document.createElement("button");
  closer.className = "closer";
  closer.dataset.closer = "";
  closer.textContent = "×";
  closer.setAttribute("aria-label", "Close");
  heading.append(title, closer);

  const signsBox = document.createElement("div");
  signsBox.className = "signs";
  const result = document.createElement("div");
  result.className = "result";
  result.dataset.result = "";
  result.setAttribute("role", "status");
  panel.append(heading, signsBox, result);
  shadow.append(style, panel, opener);

  let shownSigns = "";
  let resultTimer = null;

  function renderSigns(omen) {
    const key = omen ? omen.signs.join() : "";
    if (key === shownSigns) return;
    shownSigns = key;
    signsBox.replaceChildren();
    if (!omen) return;
    const fates = revealFates ? cosmos.revealedFates() : null;
    for (const sign of omen.signs) {
      const button = document.createElement("button");
      button.className = "sign";
      button.dataset.sign = sign;
      const glyph = document.createElement("span");
      glyph.className = "glyph";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = ZODIAC_GLYPHS[sign];
      button.append(glyph, sign);
      if (fates) {
        button.classList.add(fates[sign]);
        const label = document.createElement("span");
        label.className = "fate";
        label.dataset.fate = "";
        label.textContent = FATE_LABELS[fates[sign]];
        button.append(label);
      }
      button.addEventListener("click", () => choose(sign));
      signsBox.append(button);
    }
  }

  function closePanel() {
    panel.hidden = true;
    result.textContent = "";
    clearTimeout(resultTimer);
    renderSigns(null);
  }

  function refresh() {
    const omen = cosmos.currentOmen();
    const locked = cosmos.level() === "Ascended" && !ascendedPrompts;
    const demanded = Boolean(omen?.deadline);
    opener.disabled = locked || demanded;
    if (demanded) {
      panel.hidden = false;
      closer.hidden = true;
      title.textContent = "The stars demand an answer";
      renderSigns(omen);
    } else if (locked) {
      if (!result.textContent) closePanel();
      else renderSigns(null);
    } else {
      closer.hidden = false;
      title.textContent = "Choose a sign";
      if (!panel.hidden) renderSigns(cosmos.drawOmen());
    }
  }

  function choose(sign) {
    const fate = cosmos.chooseSign(sign);
    if (!fate) return;
    result.textContent = FATE_RESULTS[fate];
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => {
      result.textContent = "";
      refresh();
    }, ORACLE_RESULT_MS);
    refresh();
  }

  opener.addEventListener("click", () => {
    panel.hidden = false;
    refresh();
  });
  closer.addEventListener("click", closePanel);

  const mount = () => {
    document.body.append(host);
    refresh();
    setInterval(() => {
      // Come back if the host page replaced its body, so recovery stays possible.
      if (!host.isConnected && document.body) document.body.append(host);
      refresh();
    }, ORACLE_CHECK_MS);
  };
  if (document.body) mount();
  else addEventListener("DOMContentLoaded", mount, { once: true });
}
