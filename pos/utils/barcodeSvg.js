// pos/utils/barcodeSvg.js — draws real, scannable barcodes as SVG. No outside library.
// 13 digits with a correct check digit -> EAN-13 (the retail barcode on packaged goods).
// Anything else (PRD-0001, receipt numbers, short numbers) -> Code 128, which every scanner reads.

// ---- Code 128 -------------------------------------------------------------
const C128 = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222",
  "123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321",
  "232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121",
  "313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224",
  "111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113",
  "114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"
];
const START_B = 104, START_C = 105, CODE_C = 99, CODE_B = 100, STOP = 106;

export function code128Values(text) {
  const t = String(text);
  const vals = [];
  if (/^\d{4,}$/.test(t) && t.length % 2 === 0) {          // all digits, even length: pairs (Code C), half the width
    vals.push(START_C);
    for (let i = 0; i < t.length; i += 2) vals.push(Number(t.slice(i, i + 2)));
  } else {
    vals.push(START_B);
    for (const ch of t) vals.push(ch.charCodeAt(0) - 32);
  }
  let sum = vals[0];
  for (let i = 1; i < vals.length; i++) sum += vals[i] * i;
  vals.push(sum % 103, STOP);
  return vals;
}

function code128Modules(text) {
  const bars = [];                                          // alternating bar, space, bar... widths in modules
  for (const v of code128Values(text)) for (const w of C128[v]) bars.push(Number(w));
  return bars;
}

// ---- EAN-13 ---------------------------------------------------------------
const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const R = L.map((s) => s.replace(/[01]/g, (c) => (c === "0" ? "1" : "0")));
const G = R.map((s) => [...s].reverse().join(""));
const PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

export function ean13Check(d12) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(d12[i]) * (i % 2 ? 3 : 1);
  return String((10 - (s % 10)) % 10);
}
export const isEan13 = (t) => /^\d{13}$/.test(t) && ean13Check(t.slice(0, 12)) === t[12];

// A new in-store EAN-13 (prefix 2 is reserved for store use, so it never clashes with a manufacturer's code).
export function generateEan13(seed = Date.now()) {
  const body = "2" + String(Math.floor(Math.random() * 1e6)).padStart(6, "0") + String(seed % 1e5).padStart(5, "0");
  return body + ean13Check(body);
}

function ean13Pattern(t) {
  const par = PARITY[Number(t[0])];
  let bits = "101";
  for (let i = 0; i < 6; i++) bits += (par[i] === "L" ? L : G)[Number(t[i + 1])];
  bits += "01010";
  for (let i = 0; i < 6; i++) bits += R[Number(t[i + 7])];
  return bits + "101";
}

// ---- SVG ------------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function barcodeSvg(text, { height = 60, module = 2, label = true } = {}) {
  const t = String(text);
  const quiet = 10 * module;                                // blank margin scanners need on both sides
  let rects = "", x = quiet, kind;
  if (isEan13(t)) {
    kind = "EAN-13";
    const bits = ean13Pattern(t);
    for (let i = 0; i < bits.length;) {
      let j = i; while (j < bits.length && bits[j] === bits[i]) j++;
      if (bits[i] === "1") rects += `<rect x="${x + i * module}" y="0" width="${(j - i) * module}" height="${height}"/>`;
      i = j;
    }
    x += bits.length * module;
  } else {
    kind = "Code 128";
    code128Modules(t).forEach((w, i) => {
      if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w * module}" height="${height}"/>`;
      x += w * module;
    });
  }
  const width = x + quiet;
  const textH = label ? 16 : 0;
  const caption = label ? `<text x="${width / 2}" y="${height + 13}" text-anchor="middle" font-family="Consolas, 'Courier New', monospace" font-size="13" fill="#000">${esc(t)}</text>` : "";
  return { kind, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + textH}" width="${width}" height="${height + textH}" role="img" aria-label="${esc(kind)} barcode ${esc(t)}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g>${caption}</svg>` };
}

// Text a barcode can carry: printable ASCII, 1 to 40 characters.
export const barcodeText = (v) => (/^[\x20-\x7e]{1,40}$/.test(String(v)) ? String(v) : null);
