---
name: Actual Budget (fork)
description: Local-first personal finance, built around envelope budgeting
# All colour values are the light-theme palette mapping; dark and midnight
# remap the same semantic roles via `theme.*` tokens (see The Semantic Token Rule).
colors:
  brand-green: '#41C74F'
  brand-green-press: '#5ACF68'
  green-text: '#187A27'
  brand-red: '#E8562A'
  red-text: '#BF4118'
  amber-fill: '#F5A100'
  amber-text: '#7c5b11'
  ink: '#1c1e21'
  ink-secondary: '#585e66'
  ink-subdued: '#697079'
  canvas: '#f7f9fb'
  surface-white: '#ffffff'
  surface-sunken: '#f1f4f8'
  rule: '#e3e7ec'
  rule-strong: '#c6cace'
  # the primary action is high-contrast neutral, never the accent
  action-ink: '#000000'
  # the highlight chip — offers, streaks, anything celebratory
  lime: '#ccff00'
  # tonal step used as the text-selection wash and its pre-hydration fallback
  green-wash: '#bdf4c3'
typography:
  # the app's root size; every rem-relative measure descends from it
  root:
    fontFamily: 'Instrument Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '13px'
    fontWeight: 400
  hero:
    fontFamily: 'Instrument Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '52px'
    fontWeight: 550
    letterSpacing: '-0.042em'
  balance:
    fontFamily: 'Instrument Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '34px'
    fontWeight: 560
    letterSpacing: '-0.035em'
  display:
    fontFamily: 'Instrument Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '30px'
    fontWeight: 560
    letterSpacing: '-0.032em'
  headline:
    fontFamily: 'Instrument Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '21px'
    fontWeight: 600
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'Instrument Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '15px'
    fontWeight: 500
  body:
    fontFamily: 'Instrument Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '16px'
    fontWeight: 400
    fontFeature: 'tnum, ss01, ss04'
  label:
    fontFamily: 'Instrument Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    fontSize: '15px'
    fontWeight: 600
    letterSpacing: '-0.014em'
rounded:
  xs: '6px'
  sm: '4px'
  md: '10px'
  lg: '16px'
  pill: '999px'
spacing:
  xs: '5px'
  sm: '10px'
  md: '16px'
  lg: '20px'
  xl: '26px'
components:
  button-primary:
    backgroundColor: '{colors.action-ink}'
    textColor: '{colors.surface-white}'
    rounded: '{rounded.pill}'
    padding: '6px 14px'
  button-primary-hover:
    backgroundColor: '#35383d'
    textColor: '{colors.surface-white}'
  button-normal:
    backgroundColor: '{colors.surface-white}'
    textColor: '{colors.ink}'
    rounded: '{rounded.pill}'
    padding: '6px 14px'
  input:
    backgroundColor: '{colors.surface-white}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '5px'
---

# Design System: Actual Budget (fork)

## 1. Overview

**Creative North Star: Robinhood's light theme.**

A white canvas, structure by hairline, and one saturated green doing every
interactive job. The figures are scaled up until they are unmistakably the
content, and everything else is small, quiet and grey. Nothing is decorated;
on most screens the only colour is a number that went the wrong way.

This is a deliberate, user-directed replacement of the fork's previous world
(warm parchment, iron ink, verdigris, a display serif). That world is now an
anti-reference: do not reintroduce warm neutrals, serif display type, or
ruled-paper metaphors.

Product truth underneath is unchanged. Density in Actual's tables stays
moderate-to-high, the semantic token discipline is intact, and every rule
about money, contrast and colour below is carried forward.

**Key Characteristics:**

- White canvas; a faint grey page behind white surfaces so they read without borders
- The number first, at a size nothing else competes with; the explanation small underneath
- One accent — brand green — for primary action, selection, active nav, focus, and gains
- Capsule controls that press in, never lift on a shadow
- One face throughout; hierarchy is size, weight and tracking
- Semantic colour tokens only; components never hardcode hex values

## 2. Colours

The palette is generated: every ramp keeps upstream's OKLCH lightness ladder
exactly and only hue and chroma are retargeted, so all contrast roles carry
over. The brand steps are then pinned to exact values.
Regenerate with `node tools/palette.mjs <upstream palette.css>`.

### The split that governs everything

**The saturated brand steps are FILLS. They never carry text.**

- **Brand Green** (#41C74F) — 2.2:1 on white. Bars, chart strokes, indicators,
  selection, the active-nav mark.
- **Brand Red** (#E8562A) — 3.6:1 on white. A red-orange, not a pure red. The
  losing half of a curve, error fills, the crossing dot.

**The deep steps are the only ones figures and labels may use.**

- **Green Text** (#187A27) — 5.5:1. Gains, positive amounts, links, caret.
- **Red Text** (#BF4118) — 5.3:1. Losses, negative amounts, errors.
- **Amber Text** (#7c5b11) — 6.3:1. Warnings, pending, underfunded.

Getting this backwards is the single most likely way to break the system, and
it is the failure this fork inherited from upstream. `node tools/contrast.mjs`
proves it and exits non-zero if a permitted text colour drops below 4.5:1.

### Neutral

- **Ink** (#1c1e21): Body text, headings, the sidebar's budget name.
- **Ink Secondary** (#585e66) / **Ink Subdued** (#697079): Secondary and
  tertiary text. Both clear 4.5:1 on every surface in the system.
- **Canvas** (#f7f9fb): The page. Exists only so white surfaces read against
  it without needing a border.
- **Surface White** (#ffffff): Tables, cards, menus, modals.
- **Surface Sunken** (#f1f4f8): Chart tiles, bar tracks, explanatory panels,
  round icon buttons. `theme.surfaceSunken`. A chart does not sit on white —
  it sits in a recess, and that is most of why the reference reads as built.
- **Rule** (#e3e7ec) / **Rule Strong** (#c6cace): Dividers and input borders.

**Constants with no upstream counterpart** (`--palette-ink`, `--palette-lime`)
are emitted by `tools/palette.mjs`, never hand-added to the generated file. A
hand-added entry is silently lost the next time the palette is regenerated, and
it takes every primary button in the app with it.

**The neutrals carry a slight blue cast.** They are not dead grey. It is a
small thing that accounts for a surprising amount of why the chrome reads as a
finance product rather than a generic admin panel.

### Named Rules

**The Semantic Token Rule.** Components never use raw palette values or hex
codes. Every colour goes through the `theme.*` semantic layer (`--color-*`
custom properties) so all three themes stay correct. A hardcoded hex in a
component is a bug. `color-mix(in oklab, …)` over two tokens is allowed; the
inputs are always tokens.

**The One Accent Rule.** Brand green appears on well under 10% of any screen:
primary action, current selection, active nav, focus, and gains. It never
decorates. It is also the gain colour — these are deliberately the same green.

**The Never-Colour-Alone Rule.** Positive/negative state is conveyed by sign,
position and context as well as colour. The Calendar's day bars exist so the
month's shape survives without colour at all.

**The Contrast Floor.** Body and placeholder text clears 4.5:1 against the
surface it sits on; large text clears 3:1. Measure against the real surface,
not against white by assumption. Disabled text is exempt.

## 3. Typography

**Face:** Instrument Sans Variable (self-hosted; SIL OFL), one face throughout.

**Character:** A tight modern grotesque standing in for Robinhood's Capsule
Sans. There is no second face and no pairing: hierarchy is size, weight and
tracking only.

**Tracking tightens as size grows.** A 44px figure at default tracking reads
loose and unconfident. The scale below encodes this; do not set a large figure
without it.

### Hierarchy

- **Hero** (550, 52px, -0.042em): The one number a page exists to report.
  `styles.heroNumber`. At most one per screen.
- **Balance** (560, 34px, -0.035em): A secondary figure. `styles.balanceNumber`.
- **Display** (560, 30px, -0.032em): Large balances. `styles.veryLargeText`.
- **Headline** (600, 21px, -0.025em): Section titles. `styles.displayText`.
- **Title** (500, 15px): Emphasised in-table and card text.
- **Body** (400, 16px): Default text.
- **Section label** (600, 15px, -0.014em): Sentence case. `sectionLabel`.
- **Column label** (500, 13px): The smallest tier. `columnLabel`.

### Named Rules

**The Tabular Number Rule.** Every standalone financial figure renders with
tabular figures (via `FinancialText`, `styles.tnum`, or the display styles
which carry it) so digits align in columns. `body` carries
`font-variant-numeric: tabular-nums` as a floor.

**The Figure-First Rule.** A page that answers a numeric question opens with
that figure at hero size and a single delta line beneath it. Nothing sits above
the figure. Not a stat tile: no supporting-metric row, no eyebrow, no card
around it.

**The Sentence-Case Rule.** Labels are sentence case, semibold, subdued — a
brokerage labels a number the way it would say it aloud. Spaced capitals are an
editorial idiom and read as a different product; they are banned above the
smallest column-head tier.

**The Delta Rule.** A change is set as: drawn triangle, then amount and
percentage carrying the colour, then the period in plain neutral text — all at
one size. The colour and the mark do the work, never a size jump.

## 4. Elevation

Flat. Structure comes from hairlines and from white surfaces sitting on the
faint grey canvas. A persistent surface that needs an edge takes
`box-shadow: inset 0 0 0 1px {rule}` — a hairline that costs no layout — never
a cast shadow. Shadows lift only **transient** surfaces: menus, tooltips,
popovers, modals.

Buttons do not lift. A capsule that gains a shadow on hover looks pasted on;
the press state is `transform: scale(0.97)` and the hover state is a colour
change.

### Named Rules

**The Transient-Only Rule.** If a surface stays on screen, it gets a rule. If
it appears on interaction and disappears, it may cast a shadow.

**The Single Signal Rule.** Declare an edge once. A 1px rule under a soft
shadow is the ghost card; pick one.

## 5. Components

### Buttons

- **Shape:** full capsule (999px), padding `6px 14px`, `5px 8px` for bare
- **Round icon button:** 36px circle on the sunken surface (30px in dense
  chrome), ink icon, darkening on hover and scaling to 0.94 on press.
  `RoundButton`. This is the reference's back/step control and the right shape
  for any icon-only action.
- **Primary:** **near-black fill, white label.** The primary action is
  high-contrast neutral, not the accent — spending green on every button
  flattens it and it stops meaning "gain". Dark theme inverts to white-on-black.
  Press scales to 0.97; hover shifts the fill.
- **Normal:** white fill, ink text, 1px rule-strong border, same capsule
- **Bare:** transparent; background tint on hover/press

### Inputs / Fields

- White background, 1px rule-strong border, 4px radius, 5px padding
- **Focus:** border switches to brand green; the keyboard ring is
  `2px solid {green-text}` at `outline-offset: 2px`, on `:focus-visible` only
- **Big variant:** 12px padding, 48px minimum height on mobile

### Cards / Containers

- **Radius:** 16px for page-level surfaces, 10px for small tiles, 6px for data marks (bar caps, swatches), 4px for controls
- **Background:** white on the grey canvas
- **Edge:** the canvas contrast does the work; add an inset hairline only where
  two white surfaces meet
- **Internal padding:** 16–20px

### Navigation

Navigation lives at the **top**, as large text tabs. Weight and colour carry the
state: active is ink at 650, inactive is subdued — no pill, no underline, no
icon. The rail scrolls horizontally and fades at its right edge so a clipped
tab reads as scrollable rather than broken.

`components/custom/TopNav.tsx` is the wide-layout shell: the budget name on a
quiet first line, the section tabs beneath it, and the **all-accounts figure
pinned right** so the net position is never more than a glance away. One
hairline closes it. The sidebar is retired on wide layouts; narrow layouts keep
their own header and nav untouched.

**Balances moved with it.** A rail two words wide was the only reason those
figures were set at 13px; on `/balances` they get the room to be read — the net
position as the page's hero, then each account as a ruled row with its balance
right-aligned. Group headers carry their own subtotal. This is the reference's
list rhythm, and it is where any new balance belongs.

Pages do not repeat the tab's name: `Page header` is passed `null` on wide
layouts and the real title only on narrow, where there is no tab to carry it.

### Glyphs

Direction marks are **drawn SVG triangles**, not unicode arrows — a unicode
glyph shifts its optical size and baseline between faces and sits wrong beside
tabular figures. `Direction` and `Delta` in `components/custom/primitives.tsx`.

### Signature Component: The Summary Tile Row

The budget month opens with a row of tiles — one per figure, each a hairline
rect with the label small and quiet above the figure in the money tier. They
wrap two-up in a narrow card and four-across where there is room
(`minmax(150px, 1fr)`; a smaller minimum strands one tile on its own row).

Beneath them sits the single figure the surface exists to report — *Left to
assign* — at hero scale, left-aligned on the same edge as the heading and the
tiles. Everything in the card shares one left edge; a figure that sits 14px off
the tiles above it reads as a mistake even when nobody can say why.

### Signature Component: The Month Strip

Actual's month range selector is the direct analogue of the reference's
`1D 1W 1M 3M YTD` control. The selected run is one capsule — pill radii on its
two ends, square between — filled with the primary ink and set in white.
Unselected months are secondary ink at 14px; the current month is full ink
without a fill. Stepping controls are 30px circles on the sunken surface.

### Signature Component: The Month Grid

The Calendar is a bar chart laid out on a calendar, not a table of numbers.
Every day is a column: the date small at the top, the projected balance in the
money tier beneath it, then a **gradient bar standing on the row's baseline**
inside a visible track. The track matters — without it a short bar reads as
floating between rows instead of sitting low in its own column.

Bars scale across **the month's own range, not from zero**. The page answers
"how low does it get", and a zero baseline flattens a month swinging between
$400 and $1,100 into near-identical bars. The floor keeps the lowest day
visible at 12% rather than collapsing it to nothing.

Bars use the _fill_ steps (`balanceFill`), figures use the _ink_ steps
(`balanceInk`). The three fills — green, amber, red — are weighted to read as
one family; an amber that washes out beside them is a bug, not a softer state.

### Signature Component: The Money Table

Rows are **38px** (`ROW_HEIGHT`). 32px is a spreadsheet; the reference's lists
breathe. White rows ruled in 1px, no alternate-row banding — the hairline carries the
eye. Raised on hover, green-bordered selection, sticky header with
ink-subdued 13px text, amounts right-aligned in tabular figures coloured by the
semantic money tokens.

### Signature Component: The Hero Answer

Both fork pages open the same way: a small uppercase label, the figure at hero
size coloured by what it means, then one plain sentence and — where a second
fact earns a glance — a single capsule chip. Nothing else competes.

## 6. Charts

The line is the subject. Axes are hairlines, gridlines horizontal only, ticks
unboxed.

**A curve that crosses zero changes colour at zero**, via an SVG gradient with
two stops at the same offset — green above, brand red below. Do not shade a
region instead; a filled block dominates the plot and buries the line. Recharts
v3 drops raw `<defs>` children, so gradients are defined in a zero-size `<svg>`
next to the chart and referenced by id.

**Gridlines are dotted** (`strokeDasharray="1 5"`), horizontal only, at 35%
opacity. **Every marked point carries a halo**: a second dot at `r={12}` and
18% opacity behind the solid `r={5}` one. A bare dot looks unfinished, and the
halo is what makes a crossing or an end-of-series point read as _the_ moment.

**Legends are sentences, not keys**: swatch, then the figure in ink, then what
it means in grey — `LegendRow` with `Swatch` or `DashSwatch`.

Anything with an intrinsic height inside a `Page` needs `flexShrink: 0`, or the
flex column crushes it and the SVG spills its axes onto the next section.

## 7. Browser Surfaces

Set once in `packages/desktop-client/index.html`: text selection (green wash),
caret, custom scrollbars (rule-coloured thumb on a transparent track), the
`:focus-visible` ring, and link underline offset.

## 8. Do's and Don'ts

### Do:

- **Do** route every colour through `theme.*` semantic tokens; test light, dark, and midnight.
- **Do** run `node tools/contrast.mjs` before shipping a new text colour.
- **Do** wrap standalone financial numbers in `FinancialText` or apply `styles.tnum`.
- **Do** lead a numeric page with its figure at hero size.
- **Do** reuse the existing component library (`@actual-app/components`) before writing new UI.
- **Do** respect the breakpoints: 512px (small), 730px (medium), 1100px (wide); mobile touch targets are at least 44px tall.

### Don't:

- **Don't** use the brand green or brand red as a text colour. They are fills.
- **Don't** reintroduce the previous world: warm neutrals, serif display type, parchment, ruled-paper metaphor.
- **Don't** hardcode hex values or raw `--palette-*` colours in components.
- **Don't** rely on colour alone for positive/negative amounts.
- **Don't** put shadows on persistent surfaces, or on buttons at all.
- **Don't** use `border-left`/`border-right` thicker than 1px as a coloured accent stripe.
- **Don't** animate layout properties. Transitions are for colour, opacity, shadow and transform — a bar that grows uses `scaleX`, never `width` — and every transition is dropped under `prefers-reduced-motion`.
- **Don't** use emoji or unicode glyphs as icons. Icons are drawn SVG at a consistent stroke weight.
- **Don't** add a second typeface.
