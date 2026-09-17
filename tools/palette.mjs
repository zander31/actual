// Generate the fork's palette from upstream's, preserving each step's OKLCH
// lightness so every semantic token keeps its contrast role, then pinning the
// brand steps to their exact values.
//
//   node tools/palette.mjs <upstream palette.css> > packages/component-library/src/Themes/palette.css
import { readFileSync } from 'node:fs';

const srgbToLin = c =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const linToSrgb = c =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function hexToOklch(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v =>
    srgbToLin(v / 255),
  );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}

function oklchToRgb({ L, C, h }) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b2 = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b2) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b2) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b2) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(linToSrgb);
}

const inGamut = rgb => rgb.every(v => v >= -0.001 && v <= 1.001);

/** Binary-search chroma down until the colour fits sRGB — hue and lightness hold. */
function toHex({ L, C, h }) {
  let lo = 0;
  let hi = C;
  if (!inGamut(oklchToRgb({ L, C, h }))) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToRgb({ L, C: mid, h }))) lo = mid;
      else hi = mid;
    }
    C = lo;
  }
  const rgb = oklchToRgb({ L, C, h }).map(v =>
    Math.round(Math.min(255, Math.max(0, v * 255))),
  );
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
}

// Neutrals go genuinely neutral; the accent and both money ramps get pushed
// toward the brand hues and saturated hard, then gamut-mapped.
const PLAN = {
  // neutrals carry a slight blue cast — the reference's greys are cool, not
  // dead neutral, and it is most of why the chrome reads as a finance product
  gray: { h: 250, mul: 0.25, min: 0.004, max: 0.016 },
  navy: { h: 250, mul: 0.25, min: 0.004, max: 0.018 },
  blue: { h: 252, mul: 0.85, min: 0.02, max: 0.14 },
  green: { h: 145, mul: 2.2, min: 0.03, max: 0.3 },
  purple: { h: 145, mul: 2.2, min: 0.03, max: 0.3 },
  red: { h: 40, mul: 1.7, min: 0.03, max: 0.24 },
  orange: { h: 78, mul: 1.0, min: 0.02, max: 0.16 },
};

// Exact brand values. The split is the whole system: the saturated brand steps
// are FILLS (buttons, chart strokes, indicators) and never carry text; the deep
// steps are the ones figures and labels are allowed to use, and they clear
// 4.5:1 on white. Measured in tools/contrast.mjs.
const PINS = {
  // accent — primary action lives on ink, so this is selection, nav and gains
  purple100: '#F0FBF1',
  purple125: '#E8F8EA',
  purple150: '#DCF5DF',
  purple200: '#B4E9BA',
  purple300: '#5ACF68', // hover fill
  purple400: '#4BCB58',
  purple500: '#41C74F', // ← the fill
  purple600: '#187A27', // ← text-safe, 5.5:1 on white
  purple700: '#146B22',
  purple800: '#0E4E18',
  purple900: '#0A3B12',
  // gains
  green100: '#F0FBF1',
  green150: '#DCF5DF',
  green200: '#B4E9BA',
  green300: '#7FD98A',
  green400: '#5ACF68',
  green500: '#41C74F',
  green600: '#2AAE39',
  green700: '#187A27', // numberPositive
  green800: '#146B22',
  green900: '#0E4E18',
  // losses — the reference's down colour is a red-orange, not a pure red
  red100: '#FDEDE8',
  red150: '#FBD8CC',
  red200: '#F7B6A0',
  red300: '#F08A66',
  red400: '#EC6E42',
  red500: '#E8562A', // ← the fill
  red600: '#D14A21',
  red700: '#BF4118', // text-safe, 5.3:1 on white
  red800: '#9A3210',
  red900: '#75260C',
  // attention — weighted to match the green and the red as a fill
  orange400: '#FFC24D',
  orange500: '#F5A100',
  orange600: '#D98A00',
};

/**
 * Constants that have no upstream counterpart, so the ramp rewrite above cannot
 * produce them. They are emitted here rather than hand-added to the output —
 * hand-added entries are silently lost the next time this script runs, which
 * takes every primary button with them.
 */
const EXTRA = `
  /* the primary action is high-contrast neutral, never the accent */
  --palette-ink: #000000;
  --palette-ink900: #1c1e21;
  --palette-ink700: #35383d;
  /* the highlight chip — offers, streaks, anything celebratory */
  --palette-lime: #ccff00;
  --palette-lime600: #a8d400;
`;

const css = readFileSync(process.argv[2], 'utf8');
process.stdout.write(
  css.replace(
    /--palette-([a-z]+)(\d+):\s*(#[0-9a-fA-F]{6})/g,
    (m, name, step, hex) => {
      const key = `${name}${step}`;
      if (PINS[key]) return `--palette-${key}: ${PINS[key]}`;
      const p = PLAN[name];
      if (!p) return m;
      const { L, C } = hexToOklch(hex);
      const chroma = Math.min(p.max, Math.max(p.min, C * p.mul));
      return `--palette-${key}: ${toHex({ L, C: chroma, h: p.h })}`;
    },
  ).replace(/\n}\s*$/, `\n${EXTRA}}\n`),
);
