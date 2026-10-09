---
name: Splisto
mode: operate
source: src/dashboard/style.css
colors:
  light:
    bg: "#f3f0ea"
    bg-grad: "#ece7de"
    surface: "#fffdf9"
    surface-2: "#f8f5ef"
    sunken: "#efeae2"
    text: "#1c1915"
    muted: "#6b6359"
    faint: "#7a7166"
    border: "#e4ddd1"
    border-strong: "#cfc6b7"
    field: "#fffefb"
    accent: "#ff5a1f"
    accent-hover: "#ff6f3c"
    accent-text: "#1a0d05"
    accent-strong: "#c2410c"
    accent-soft: "rgba(255, 90, 31, 0.1)"
    accent-line: "rgba(255, 90, 31, 0.45)"
    ok: "#15803d"
    ok-soft: "rgba(21, 128, 61, 0.1)"
    warn: "#a35208"
    warn-soft: "rgba(217, 119, 6, 0.12)"
    err: "#c0262d"
    err-soft: "rgba(192, 38, 45, 0.09)"
    idle: "#b3aa9d"
  dark:
    bg: "#121110"
    bg-grad: "#181614"
    surface: "#1b1a18"
    surface-2: "#221f1c"
    sunken: "#151412"
    text: "#f4efe7"
    muted: "#a59d91"
    faint: "#8d8478"
    border: "#2e2a26"
    border-strong: "#423c35"
    field: "#161513"
    accent: "#ff6a2b"
    accent-hover: "#ff8250"
    accent-text: "#1a0d05"
    accent-strong: "#ff8d5c"
    accent-soft: "rgba(255, 106, 43, 0.13)"
    accent-line: "rgba(255, 106, 43, 0.55)"
    ok: "#4ade80"
    ok-soft: "rgba(74, 222, 128, 0.11)"
    warn: "#f5b041"
    warn-soft: "rgba(245, 176, 65, 0.12)"
    err: "#ff6b6f"
    err-soft: "rgba(255, 107, 111, 0.12)"
    idle: "#5a534b"
typography:
  display: "'Bricolage Grotesque Variable' (opsz axis), fallback Segoe UI Variable Display"
  text: "'Hanken Grotesk Variable', fallback Segoe UI Variable Text"
  base: "15px / 1.5"
  scale:
    h1: "2.1rem / 750 / -0.035em / lh 1.05 (1.75rem under 560px)"
    title-input: "1.45rem / 650 / -0.02em (display)"
    pf-num: "1.35rem / 680 / -0.02em (display, tabular)"
    section-h2: "1.3rem / 720 / -0.025em (panel, dup, list heads)"
    card-h2: "1.15-1.2rem (card, bulk, status)"
    price: "1.08rem / 720 / -0.01em (display, tabular)"
    h2: "1.05rem / 700 / -0.015em"
    body: "1rem"
    secondary: "0.86-0.92rem (hint, meta, buttons)"
    label: "0.82rem / 650 / +0.01em, muted"
    micro: "0.72-0.78rem / 600-750 (pill, tag, counts, dt)"
radii:
  lg: 18px
  md: 14px
  sm: 10px
  media: 12px
  pill: 999px
  focus: 6px
shadows:
  light:
    sm: "0 1px 0 rgba(60,45,25,.04), 0 1px 3px rgba(60,45,25,.06)"
    md: "0 1px 0 rgba(60,45,25,.04), 0 10px 30px -14px rgba(60,45,25,.22)"
    lg: "0 2px 4px rgba(60,45,25,.05), 0 24px 48px -18px rgba(60,45,25,.35)"
  dark:
    sm: "0 1px 2px rgba(0,0,0,.3)"
    md: "0 1px 2px rgba(0,0,0,.3), 0 12px 32px -16px rgba(0,0,0,.6)"
    lg: "0 2px 6px rgba(0,0,0,.35), 0 28px 56px -20px rgba(0,0,0,.75)"
motion:
  ease: "cubic-bezier(0.16, 1, 0.3, 1)"
  t: "180ms var(--ease)"
  rise: "280-360ms, translateY(14px) + fade"
  pop: "320ms, scale 0.4 -> 1.15 -> 1"
  pulse: "1-1.2s opacity loop (in-progress states)"
  reduced: "prefers-reduced-motion kills all animation and transition"
layout:
  page: "max 780px; wide 1120px; padding 36px 24px 120px"
  breakpoints: [980px, 760px, 560px]
---

# Splisto: design system

**Market stall (banco del mercato).** Warm paper, ink, price-tag orange. A cross-listing dashboard for second-hand sellers (Vinted, eBay, Subito, Wallapop, Facebook Marketplace). Operate mode: dense, calm, task-first. Light and dark follow `prefers-color-scheme` automatically; there is no manual toggle.

## Color

- **Paper, not white.** Every neutral is warm (brown-tinted). Page `--bg` sits under a soft top radial of `--bg-grad`. Content lives on `--surface`. `--surface-2` is for hover and quiet fills, `--sunken` for wells (tags, empty thumbs, photo add).
- **One accent: price-tag orange.** `--accent` fills (primary button, counts, photo cover badge, tick). Text on orange is always `--accent-text` (near-black), never white. Orange *text* uses `--accent-strong` for contrast. `--accent-soft` is the tint for selected or AI areas, and `--accent-line` is the border for them.
- **Status triad plus idle:** `--ok`, `--warn`, `--err`, `--idle`. Each has a `-soft` background. A status is always a solid color on its own soft tint.
- **Text tiers:** `--text`, `--muted` (labels, secondary), `--faint` (placeholders, timestamps, `dt`). `--faint` is 4.7:1 on `--surface` in both themes, so it is the floor. Nothing lighter carries text.
- **Sold** inverts: `.state-sold` is `--text` on `--bg`.

## Type

- **Bricolage Grotesque** (variable, optical size on) for headings, numbers, prices, the listing-title input, legends and alert titles. **Hanken Grotesk** for everything else. Both are bundled via `@fontsource-variable`, with no network fetch.
- Headings use tight negative tracking, bigger gets tighter (-0.035em at h1), plus `text-wrap: balance`.
- Every number a seller compares (prices, counts, views/likes, fees) uses `font-variant-numeric: tabular-nums`.
- Weights are variable in-between values (650, 680, 720, 750). Use them, don't round to 600/700.

## Shape and depth

- Radii: 18 for containers (panel, sheet, card, dock, bulk, photos), 14 for rows and status rows, 10 for fields, 12 for images and pf-toggles, 999 for every button, pill, tag and chip.
- Shadows are warm brown in light, pure black in dark. `sm` for resting cards and rows, `md` for panels and row hover, `lg` only for floating sticky bars.
- Hairline dividers are `1px solid var(--border)`. Dashed `1.5px var(--border-strong)` means empty or drop target (empty list, empty photo well).

## Components

- **Buttons:** `.btn-primary` is an orange pill with an inset top highlight and orange glow, press is `translateY(1px) scale(.99)`. `.btn-secondary` is a surface pill with a strong border that hovers to an orange border and `--accent-strong` text (`.small`). `.btn-text` is inline and muted, hovering to an accent-soft bg (`.accent`, `.danger`, `.danger-strong`). `.icon-btn` is a 42/32px circle (`.ghost`, `.danger`).
- **Fields:** `--field` background, strong border, radius sm. Focus gives an accent border plus a 4px `--accent-soft` ring (no outline). Labels are 0.82rem/650 muted above the control (`.field`, `.field-head`). Custom chevron on `select`. Checkboxes use `accent-color`.
- **Status vocabulary (one mapping everywhere):** idle = idle, opening = accent + pulse, filled/published = ok, incomplete/login = warn, error = err, removed = idle.
  - `.dot`: 8px circle, standalone or pinned on a chip.
  - `.state`: a pill with label for the per-site status in the editor.
  - `.pill`: account auth (on/off/unknown/checking) with a built-in `::before` dot, and checking pulses.
  - `.tag`: neutral sunken label (`-warn`, `-danger`, `-accent`) for row meta.
  - `.chip`: per-site logo mark plus dot plus `.stat-pair` (lucide Eye/Heart, en dash when unread).
- **pf-toggle:** a platform checkbox drawn as a 52px tile (`.compact` 42px). The real input is visually hidden. Unchecked is a greyscale logo at 0.4. Checked gets an accent border plus a 1px accent ring plus an orange glow and a `.pf-tick` badge that pops in. Under 560px the wordmark is swapped for the square mark.
- **Sticky bars:** `.dock` (editor, "Pubblica su") and `.bulk` (multi-select edit) stick at `bottom: 14px` (8px on mobile), radius lg, shadow lg. Dock is translucent surface with `backdrop-filter: blur(14px)`. Bulk has an accent-line border, rises in, and scrolls internally (`max-height: min(50vh, 540px)`).
- **Rows:** a surface card, 72px thumb (60 on mobile), title ellipsized. A picked row gets an accent border plus ring plus a 4% orange wash. A sold row is greyscale thumb, muted title and struck price.
- **Platform logos:** official SVGs in `public/logos` via `<Logo p mark?>`. Wordmark (`.logo-word`, per-brand height tuning) or square mark (`.logo-mark`, 18px). Dark variants through `<picture>` where the brand color fails on dark (Vinted). Facebook pairs its mark with a display-face "Marketplace".
- **Icons:** lucide-react only, 13-16px inline, `aria-hidden` when decorative.

## Motion

One curve (`--ease`, expo-out) and one duration (`--t` 180ms) for all state transitions. Entrances use `rise`, confirmations use `pop`, in-progress states use `pulse`, and loading uses `spin`. `prefers-reduced-motion: reduce` disables every animation and transition. Hover-only reveals (photo remove, pf-cell actions) are forced visible under `hover: none`.

## Accessibility

- Global `:focus-visible` is a 2px `--accent` outline with a 2px offset and radius 6. Visually hidden inputs pass it to the wrapper via `:has(input:focus-visible)` (pf-toggle, photo-add).
- `.sr-only` for labels without visible text. Decorative dots and icons use `aria-hidden`, and state is always spelled out in text beside the color.
- Color is never the only signal: pills, states and site-ops carry text or `aria-label`.
- `color-scheme: light dark` so native controls and scrollbars follow the theme. Caret and selection are orange.

## Not canonized (defects the build carries)

- `.site-op` in BulkBar draws its add/remove/keep state with text glyphs (`+`, `−`, `·`). Future surfaces use lucide icons (Plus, Minus) instead.
- The orange glows (`.btn-primary`, `.pf-toggle:checked`, `.brand img`) hard-code `rgba(255, 90, 31, …)` rather than a token, so dark mode keeps the light accent hue. A `--accent-glow` token would fix this.
- `.title-input` relies on `!important` to beat the global field rule.
