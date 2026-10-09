---
name: Splisto
description: Write a listing once, send it to five marketplaces; every item seated on a velvet tray.
colors:
  velvet-ground: "#0e1c17"
  velvet-ground-hi: "#15291f"
  velvet-tray: "#112219"
  velvet-well: "#08130f"
  velvet-well-hi: "#0b1813"
  brass: "#c8a35a"
  brass-hi: "#e6c886"
  brass-lo: "#8a6a30"
  brass-ink: "#1b1407"
  brass-line: "rgba(200, 163, 90, 0.28)"
  brass-soft: "rgba(200, 163, 90, 0.1)"
  ivory: "#ece3d0"
  sage-muted: "#a3b3a8"
  sage-faint: "#7f9186"
  hairline: "rgba(236, 227, 208, 0.08)"
  hairline-strong: "rgba(236, 227, 208, 0.16)"
  verdigris: "#5cc596"
  verdigris-soft: "rgba(92, 197, 150, 0.12)"
  amber: "#e8b04a"
  amber-soft: "rgba(232, 176, 74, 0.12)"
  vermilion: "#ef6a4f"
  vermilion-soft: "rgba(239, 106, 79, 0.12)"
  idle-moss: "#4f6359"
typography:
  display:
    fontFamily: "Marcellus, 'Times New Roman', serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.01em"
  nameplate:
    fontFamily: "Marcellus, 'Times New Roman', serif"
    fontSize: "1.6rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.3em"
  headline:
    fontFamily: "Marcellus, 'Times New Roman', serif"
    fontSize: "1.4rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.02em"
  title:
    fontFamily: "'Albert Sans Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 650
    lineHeight: 1.5
  body:
    fontFamily: "'Albert Sans Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "'Albert Sans Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 650
    letterSpacing: "0.08em"
  numeral:
    fontFamily: "'Albert Sans Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 650
    lineHeight: 1.2
    fontFeature: "tnum"
rounded:
  tag: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "22px"
  page: "36px 24px 120px"
components:
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.brass-ink}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ivory}"
    rounded: "{rounded.sm}"
    padding: "7px 13px"
  button-secondary-hover:
    backgroundColor: "{colors.brass-soft}"
    textColor: "{colors.brass-hi}"
  input:
    backgroundColor: "{colors.velvet-well}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.sm}"
    padding: "10px 13px"
  tray:
    backgroundColor: "{colors.velvet-tray}"
    rounded: "{rounded.lg}"
    padding: "10px"
  slot:
    backgroundColor: "{colors.velvet-well}"
    rounded: "{rounded.md}"
    padding: "10px 14px 10px 8px"
  thumb:
    backgroundColor: "{colors.velvet-well-hi}"
    rounded: "{rounded.sm}"
    size: "72px"
  tag:
    textColor: "{colors.sage-muted}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  site-toggle:
    backgroundColor: "{colors.velvet-well}"
    rounded: "10px"
    height: "50px"
---

# Design System: Splisto

## Overview

**Creative North Star: "Vetrina di velluto"**

Every listing is an object seated in its own recess on a dark bottle-green velvet tray; the five marketplaces are brass tags along its rail. The ground has nap: a fine, directional noise texture drawn once as an SVG and laid over the html ground, the body, every tray and every well. Depth is physical: trays rise on soft downward shadows, wells and fields sink with a dark top edge.

One dark theme only (`color-scheme: dark`). Density is an operator's: long listing slots at one photo scale, state read at a glance in fixed cells, Italian copy throughout. The system refuses the category default of near-black SaaS panels, one neon accent and glowing card edges.

**Key Characteristics:**
- Velvet ground, tray and well tones, all carrying the nap texture.
- Brass is solid (metal fill) only on what can be pressed; everywhere else it is engraved: brass outline, brass text.
- Ivory text in three tiers; the faintest still clears 4.5:1 on velvet.
- Site state is a mark in a fixed cell, never a free-floating badge.
- Engraved roman headings (Marcellus), one workhorse sans (Albert Sans) for every control and number.

## Colors

Bottle-green velvet, aged brass, bone ivory, and three mineral status hues.

### Primary
- **Brass** (brass): engraved outlines on focus, selection, checked toggles, icons inside secondary buttons, the caret and select chevron.
- **Polished Brass** (brass-hi): prices, nameplate lettering, hover text, focus ring (2px, offset 2px).
- **Brass Metal**: two-stop gradient (`#dcbc78` to `#b9934d`, see sidecar) used only on the primary button and the checked-toggle tick; text on it is Brass Ink.
- **Brass Line / Brass Soft**: hairline rule of every tray and the nameplate; soft wash behind hovered secondary and text buttons.

### Secondary (status)
- **Verdigris** (verdigris): published / connected / filled.
- **Amber** (amber): incomplete or login needed; the half mark, warning tags.
- **Vermilion** (vermilion): error, disconnected, destructive hover; alert band wash.
- **Idle Moss** (idle-moss): hollow and removed marks.

### Neutral
- **Velvet Ground / Ground Hi**: page ground, with a radial light from above (Ground Hi) on the body.
- **Velvet Tray**: raised panels, cards, sheets, the listing tray, docks.
- **Velvet Well / Well Hi**: recesses: inputs, slots, site cells, icon buttons, thumbnail backing.
- **Ivory / Sage Muted / Sage Faint**: text tiers: content, secondary, metadata and placeholders.
- **Hairline / Hairline Strong**: dividers and field strokes.

### Named Rules
**The Pressable Brass Rule.** Solid brass metal appears only on an element that can be pressed (primary button, checked-toggle tick). Anything informational uses engraved brass: a brass outline or brass text on velvet.

**The Faint Floor Rule.** The faintest text tier (sage-faint) must keep at least 4.5:1 on the velvet ground and wells; never introduce a dimmer text tone.

## Typography

**Display Font:** Marcellus (with Times New Roman, serif)
**Body Font:** Albert Sans Variable (with Segoe UI, system-ui, sans-serif)

**Character:** An engraved Roman capital voice for names and headings, over a clean grotesque that does all the work. Numerals are tabular everywhere (set on `:root`).

### Hierarchy
- **Display** (400, 2rem, 1.1; 2.2rem on the settings page): page titles.
- **Nameplate** (400, 1.6rem, 0.3em tracking, uppercase, Polished Brass): SPLISTO lettering over a hairline brass rule; 1.15rem / 0.24em at 560px and below.
- **Headline** (400, 1.15 to 1.4rem, 0.02em): panel, tray, card and status headings; alert titles, empty-state titles, summary and legend lines also take Marcellus.
- **Title input** (Marcellus, 1.5rem; 1.25rem on mobile): the listing title field is set in the display face.
- **Title** (Albert Sans 650, 1.02rem): listing names in slots, ellipsized on one line.
- **Body** (400, 15px root, 1.5): all UI copy; hints 0.83 to 0.88rem in Sage Muted.
- **Label** (650, 0.78rem, 0.08em, uppercase): form field labels; status pills and count captions use the same uppercase tracking at 0.68 to 0.7rem.
- **Numeral** (650, 1.3rem, tabular): site counts in the rail.

### Named Rules
**The Explicit Body Rule.** Set the body font family and size on `body` itself, not only on `:root`: Chrome injects `body { font-family: system-ui; font-size: 75% }` on extension pages.

**The Two Voices Rule.** Marcellus is for names and headings (plus the title field); every control, label and number is Albert Sans.

## Layout

Single centered column: 800px max for editor and settings, 1140px for the home (`.page.wide`), padding 36px 24px 120px (20px 16px 104px at 560px and below). Trays pad 10px with 10px gaps between slots; panel heads 18px 22px.

The listing tray is a CSS grid (`auto minmax(0,1fr) auto auto`) whose rows are subgrids, so each slot's checkbox, photo/text, five state cells and actions align in shared columns across the tray; the five state cells are a fixed 5 x 54px grid, always in the same site order. At 760px and below the tray falls back to flex and the cells and actions wrap under the photo; at 560px the cells stretch to five equal columns and per-site counts hide.

The site rail is five equal columns, auto-fit at 980px, one column at 560px. The editor's "Pubblica su" dock is sticky at bottom 14px; at 560px and below it becomes static and its two buttons share one row (a lone button spans both). Breakpoints: 980, 760, 560px.

## Elevation & Depth

Hybrid: tonal layering plus directional shadows. Light comes from above; shadows fall down, recesses have a dark top edge. Trays lift, wells sink, and the photo is the only thing that leaves its recess.

### Shadow Vocabulary
- **Recess** (`inset 0 2px 5px rgba(0,0,0,.55), inset 0 -1px 0 rgba(236,227,208,.04)`): wells, inputs, slots, site cells, toggles, icon buttons.
- **Lift** (`0 1px 0 rgba(236,227,208,.05) inset, 0 10px 24px -12px rgba(0,0,0,.7)`): trays, panels, cards, sheets.
- **Lift Large** (`0 1px 0 rgba(236,227,208,.06) inset, 0 24px 48px -18px rgba(0,0,0,.85)`): the sticky bulk bar and publish dock.
- **Seated Photo** (`0 2px 4px rgba(0,0,0,.5)`), lifting to `0 12px 18px -6px rgba(0,0,0,.85)` plus a brass hairline ring.

### Named Rules
**The Nap Everywhere Rule.** Any new velvet surface (ground, tray, well) layers `var(--nap)` over its tone; a flat green fill reads as plastic.

**The Down-Light Rule.** Shadows only fall downward; no glows, no colored halos except the 3px brass focus wash on fields and the verdigris halo on the published mark.

## Shapes

Softly rounded rectangles in three steps: trays 16px, slots and cells 12px, buttons and fields 8px; photo tiles and site toggles 10px; tags, pills and badges a near-square 4px. Borders are 1px hairlines; brass at 0.28 alpha on trays, full brass on selection and on the sticky bars. State marks are 10px circles.

## Components

### Buttons
- **Primary:** brass metal fill, Brass Ink text 700, 8px radius, 10px 18px (12px 22px in the dock), inset highlight top and shadow below; hover brightens 8%, active presses 1px down; disabled at 35% opacity, desaturated.
- **Secondary:** transparent, brass-line outline, ivory 600 text at 0.88rem, brass icon; hover gets full brass border, brass-soft wash, Polished Brass text.
- **Text:** Sage Muted, no chrome; hover ivory on brass-soft. Accent variant in Polished Brass; danger turns vermilion.
- **Icon button:** 40px (30px small) recessed well with hairline stroke; ghost variant has no chrome.

### Status marks
Fixed-size 10px marks: **published** filled verdigris with a soft verdigris halo; **filled** verdigris ring with a centre dot; **incomplete / login** amber ring, left half filled; **error** vermilion ring struck through at -45deg; **idle** hollow moss ring; **removed** moss ring with a horizontal dash; **opening** solid brass pulsing (1.2s). Marks are `aria-hidden`; the cell's title or the adjacent state pill carries the words.

### Pills and tags
Engraved, never filled: 4px radius, 1px currentColor or tinted outline, uppercase 0.7rem tracked text for state pills (with a leading 7px dot); tags are 0.74rem sentence case with a soft tinted wash for warn, danger and accent.

### Trays and slots
Tray: nap over Velvet Tray, brass-line border, 16px radius, Lift. Slot: nap over Velvet Well, 12px radius, Recess, transparent border that turns brass-line on hover and solid brass (plus 1px ring) when picked. Sold slots grey the photo and strike the price.

### Inputs / Fields
Recessed wells with Hairline Strong stroke, 8px radius, 10px 13px; hover brass-line; focus solid brass border plus a 3px brass wash, no outline. Placeholders in Sage Faint. Selects carry a brass chevron. Checkboxes take `accent-color: brass`.

### Site toggles
50px recessed wells holding the site's dark-ground logo, greyed at 35% when off; checked gets brass border and ring, full-color logo, and a brass-metal tick badge that pops in (320ms). Logos always come from the dark-ground variants in `public/logos`; at 560px wordmarks swap to marks.

### Signature: the lifting photo
The 72px thumbnail (60px on mobile) sits in its recess; on hover or keyboard focus of the slot link it rises 3px over 220ms (ease-out `cubic-bezier(0.16,1,0.3,1)`), its shadow deepening and a brass hairline ring appearing.

### App icon
`public/icons/icon.svg`: a tilted brass tag with a ring hole on a bottle-green velvet tile with a faint brass border; PNGs are rendered from it.

## Do's and Don'ts

### Do:
- **Do** layer the nap texture on every velvet surface and keep wells darker than the ground.
- **Do** reserve brass metal for pressables; use brass outlines and brass text everywhere else.
- **Do** show site state as a mark in its fixed cell, in fixed site order, with the words in a title or pill.
- **Do** keep every photo at one scale and on the same well ground.
- **Do** honor reduced motion: transitions and animations collapse to 1ms and the photo stops lifting, but color and border state changes stay visible.

### Don't:
- **Don't** add a light theme or any surface outside the velvet tones.
- **Don't** fill informational elements (pills, tags, headings, badges) with solid brass.
- **Don't** add glows, neon accents or glowing card edges.
- **Don't** use light-ground logo variants.
- **Don't** set UI controls or numbers in Marcellus, or let body text fall back to the extension's system-ui default.
