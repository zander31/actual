// WCAG contrast checker for the palette's text steps.
//
//   node tools/contrast.mjs                     # check the documented pairs
//   node tools/contrast.mjs '#00810A' '#ffffff' # check one pair
//
// The palette's whole discipline is that the saturated brand steps are fills
// and the deep steps are the only ones allowed to carry text. This is what
// proves it, and what DESIGN.md's measured numbers come from.

const luminance = hex => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// surfaces text actually lands on in the light theme
const SURFACES = { white: '#ffffff', canvas: '#f7f9fb', sunken: '#f1f4f8' };

// every step the system permits as a text colour, and the brand fills that are
// listed here only to show why they are not allowed to be one
const TEXT = {
  ink: '#1c1e21',
  'ink secondary': '#585e66',
  'ink subdued': '#697079',
  'green (text)': '#187A27',
  'red (text)': '#BF4118',
  'amber (text)': '#7c5b11',
  'green FILL — not for text': '#41C74F',
  'red FILL — not for text': '#E8562A',
};

if (process.argv[2] && process.argv[3]) {
  const ratio = contrast(process.argv[2], process.argv[3]);
  console.log(`${ratio.toFixed(2)}:1  ${ratio >= 4.5 ? 'AA' : 'FAILS AA'}`);
} else {
  let failures = 0;
  for (const [name, fg] of Object.entries(TEXT)) {
    const isFill = name.includes('FILL');
    const cells = Object.entries(SURFACES).map(([sn, bg]) => {
      const ratio = contrast(fg, bg);
      if (!isFill && ratio < 4.5) failures++;
      return `${sn} ${ratio.toFixed(2)}${!isFill && ratio < 4.5 ? ' ✗' : ''}`;
    });
    console.log(`${name.padEnd(28)} ${fg}  ${cells.join('   ')}`);
  }
  console.log(
    failures
      ? `\n${failures} text colour(s) below 4.5:1`
      : '\nevery permitted text colour clears 4.5:1',
  );
  process.exit(failures ? 1 : 0);
}
