# DESIGN.md — Ashara Mubaraka Signage System

Authoritative design language. Derived from `signage_app_prototype_v2.html` (v6 prototype) and reconciled with the v7 architecture (React + Vite + Tailwind, PostgREST, role-gated UI). Keep hex values stable across the app — they are the contract between code, schema constraints (sign-type colors) and brand identity.

---

## 1. Register & posture

**Register: product.** Design serves the product. This is a planning + production tracker for HODs, signage production, and department users — not a marketing surface. Restraint over spectacle.

**Aesthetic direction: refined editorial — warm, archival, calm.**
- Off-white paper background (not blue-grey SaaS, not pure white).
- Tinted neutrals carry 90% of the surface; ISO-7010 sign-type colors do the meaningful talking.
- Single dominant accent: near-black ink (`#1F1F1D`). Treated as ink-on-paper.
- Generous negative space, tight type, calm interactions. No glassmorphism, no gradient text, no decorative blur.

**Scene sentence (theme):** "An HOD reviewing 200 pending sign requests on a 14-inch laptop in a brightly lit office during event prep, switching contexts between Arabic/LuD names and English approvals." → forces **light theme, warm-paper neutrals, high text contrast, dense data layouts**.

**Anti-references:**
- No Linear/Notion blue-grey neutrals.
- No Stripe-style purple gradients on white.
- No corporate-religious gold + green ornament. The brand is the *event* (per-event accent colors live in DB), the chrome is neutral.

---

## 2. Color tokens

Source of truth. Every color used in the UI must be one of these. Hex values are stable; OKLCH equivalents are listed for any new token introduced later.

### 2.1 Surface (paper neutrals — warm, tinted toward sepia)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAFAF7` | App background. Page canvas. |
| `--card` | `#FFFFFF` | Card / panel surfaces, sidebar, modal. |
| `--surface` | `#F4F2EC` | Subtle fill — group headers, role select bg, chip default, footbar contrast. |
| `--tertiary` | `#EFEDE6` | One step deeper — hovered group head, count pill background, status `cancelled`. |

Rule: never use `#000` or `#fff` directly. The whites here are intentional brand white; the warmth comes from `bg`/`surface`/`tertiary` which are warmed neutrals.

### 2.2 Ink (text)

| Token | Hex | Use |
|---|---|---|
| `--text` | `#1F1F1D` | Primary text. Also primary button bg, active sidebar item bg, role-badge dot. |
| `--muted` | `#6F6E68` | Secondary text, table headers, helper copy, meta lines. |
| `--hint` | `#A3A09A` | Tertiary text, placeholders, section labels, empty-state copy. |
| `--border` | `rgba(0,0,0,0.08)` | Default 1px borders. |
| `--border-strong` | `rgba(0,0,0,0.16)` | Inputs, buttons, active emphasis. |

### 2.3 Semantic / sign-type families

These are **paired triplets** (`fg / bg / border`) so any element can sit on any neutral surface without re-mixing. The `bg`/`border` are always desaturated tints of the `fg`.

| Family | fg | bg | border | Domain meaning |
|---|---|---|---|---|
| Info (blue) | `#185FA5` | `#E6F1FB` | `#B8D4F0` | Mandatory sign type, status `approved`, info banner, dept switcher, HOD role |
| Success (green) | `#3B6D11` | `#EAF3DE` | `#C5DAA8` | Safe-condition sign type, status `ready`, success toast/button |
| Warning (amber) | `#BA7517` | `#FAEEDA` | `#E8C698` | Warning sign type, status `printing`, production role |
| Danger (red) | `#A32D2D` | `#FCEBEB` | `#EFB8B8` | Prohibition sign type, status `rejected`, danger button, admin role |
| Purple | `#534AB7` | `#EEEDFE` | `#C4C0EC` | Place sign type, status `designing`, designer role |
| Teal | `#0F6E56` | `#E1F5EE` | `#A6D8C5` | Direction sign type |

Sign-type-only extras (no full triplet):
- Notice — fg `#444441`, bg `#F4F2EC` (uses surface).

### 2.4 Per-event accent

Each `events` row carries its own brand colors. **Do not bake event colors into the chrome.** Pull from DB at runtime; apply only in:
- Hero banner gradient on HOD dashboard.
- Event-tagged badges.
- The "current event" indicator in sidebar.

Render as inline `style` (the only sanctioned use of inline styles per CLAUDE.md). Never add a Tailwind class for an event color.

### 2.5 Forbidden

- No `bg-gray-*` from default Tailwind palette. Map to the warm neutrals above.
- No purple gradients on white.
- No gradient text (`background-clip: text`).
- No side-stripe colored borders ≥ 2px on cards/rows. Use full borders + tinted bg instead.

---

## 3. Typography

System stack (matches prototype, performant on macOS/Windows/Linux):

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

Arabic / LuD names use `font-family: Arial, sans-serif` with `direction: rtl`. Keep this exact pairing — it's what the prototype validated against the actual department names.

### 3.1 Scale

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| H1 (page title) | 24px | 500 | 1.2 | -0.01em |
| H2 (card title) | 18px | 500 | 1.3 | -0.01em |
| H3 (group title) | 15px | 500 | 1.3 | -0.01em |
| Body | 14px | 400 | 1.5 | 0 |
| Body-sm | 13px | 400 | 1.4 | 0 |
| Meta | 12px | 400 | 1.4 | 0 |
| Caption | 11px | 400 | 1.4 | 0 |
| Eyebrow / label | 10–11px | 600 | 1.4 | 0.04–0.08em uppercase |
| Stat number | 26px | 500 | 1.05 | -0.01em |

Body line length cap: **65–75ch**. Apply on long-form copy (modal descriptions, empty states), not on table cells.

### 3.2 Hierarchy rules

- Hierarchy is carried by **size + weight (500 vs 400)**, never by color shifts on body copy. Color shifts are reserved for `muted`/`hint` meta lines.
- Eyebrows / table headers: 10–11px, weight 600, `text-transform: uppercase`, `letter-spacing: 0.04em` (data) or `0.08em` (sidebar sections).
- Numerics in tables (qty, size) are weight 500 in `--text`; the row label they belong to stays weight 400.
- The bilingual sign-name pattern is fixed: English first (weight 400, 13–14px), Arabic/LuD second on its own line (11–12px, `--muted`, `direction: rtl`).

---

## 4. Spacing & layout

### 4.1 Scale (px)

`2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 24 · 32 · 40 · 64`

Map to Tailwind only as needed; do not introduce arbitrary values like `13px` or `17px`. The prototype's spacing rhythm holds — varying 14/16/18 deliberately (rows vs card padding vs group head).

### 4.2 Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Buttons, inputs, chips, kanban cards, toasts |
| `--radius-md` | 10px | Stats, banners, sub-panels, dept switcher |
| `--radius-lg` | 14px | Top-level cards, hero, modals, group containers |

Pills/badges: 10–16px (uses oversize radius, not the scale).

### 4.3 Elevation

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | Sticky role badge, hovered kanban card, library card |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.06)` | Reserved (modals open from this) |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.08)` | Toasts |

Default surfaces are flat (border, no shadow). Shadow is reserved for floating/sticky/elevated affordances. **No drop shadow on static cards.**

### 4.4 App grid

```
sidebar (240px, sticky, full-height) │ main (max-width 1400px, padding 32px 40px 100px)
```

Mobile (`<900px`): single column, sidebar collapses, main padding `20px 16px`. Sticky footer bar reflows.

### 4.5 Density

Dense by default. This is a tool for power users; row height 36–44px, not the airy 56–64px of consumer apps. Don't pad-up tables to look "modern" — that fights the use case.

---

## 5. Component contracts

Every primitive below has a single shared component in `src/components/`. Never re-implement these inline.

### 5.1 Button

- Heights: `sm` 28 / default 34 / `lg` 42.
- Variants: `default` (white, dark border), `primary` (`--text` bg, white fg), `success` (green bg), `danger` (red text + border, fills on hover), `ghost` (transparent until hover).
- Hover: bg darkens 1 step, border goes to `--text`. No shadow on hover.
- Active: `transform: translateY(0.5px)`. That's the entire press feedback.
- Disabled: `opacity: 0.4; cursor: not-allowed`. No greyed bg.

### 5.2 Status pill (`.spill`)

Single component, prop-driven by status enum. Mapping is fixed by schema CHECK — never invent new states.

| Status | bg | fg | Notes |
|---|---|---|---|
| `pending` | `--tertiary` | `#444` | |
| `approved` | info-bg | info-fg | |
| `designing` | purple-bg | purple-fg | |
| `printing` | warn-bg | warn-fg | |
| `ready` | success-bg | success-fg | |
| `rejected` | danger-bg | danger-fg | |
| `cancelled` | `#F4F2EC` | `#888` | `text-decoration: line-through` |

### 5.3 Sign-type badge (`.tbadge`)

7 variants, one per sign type, locked to ISO 7010 + functional types. Includes a 7px colored dot + label. Never recolor these — the colors *are* the regulation.

### 5.4 Role badge (`.role-badge`)

Sticky top-right, 18px circular dot + role name. Dot color identifies the role:
- `super_admin` → red, `signage_hod` → blue, `signage_production` → amber, designer-equivalent → purple, `viewer` → muted, `department_user` → ink.

Translation note: prototype role names (`hod`, `admin`, `designer`, `production`) are obsolete. Map to v7 role names at the component boundary; the visual tokens stay.

### 5.5 Card (`.card`)

`bg: --card`, `border: 1px solid --border`, `radius: --radius-lg`, `padding: 20px`, `margin-bottom: 16px`. **No nested cards.** If you reach for one, the answer is a sub-section with a heading and a divider, not another `<Card>`.

### 5.6 Group (`.group`) — collapsible container

Used on HOD dashboard for venue/zone groups. Header is `--surface` bg, body is `--card`. Click toggles `.hidden`. Each subgroup has a sticky-feel header strip (`--bg`) with bulk action buttons aligned right.

### 5.7 Kanban column (`.kcol`)

5 fixed columns matching the status machine: `pending → approved → designing → printing → ready`. Column bg `--surface`, cards inside are flat `--card` with hover shadow-sm. Min-height 480px, body scroll at 600px.

### 5.8 Banner / inline alert

Four tones (`default → info`, `success`, `warn`, danger via danger-bg). Always horizontal: `[icon] [message] [actions →]`. **Never use as a substitute for a toast** (banners persist, toasts auto-dismiss).

### 5.9 Toast

Top-right, max-width 360px. Stacks vertical, gap 8px. Slide-in from right (`slideInR` 0.2s). Tones: default (ink), success (green), error (red), info (blue). All white text. Auto-dismiss 4s; close button bottom-aligned right.

### 5.10 Modal

Backdrop `rgba(20,20,20,0.4)`, fade-in 0.15s. Modal slide-up 0.2s from +8px. Max-width 640px, max-height 90vh, internal scroll. **First-thought modals are forbidden** (per CLAUDE.md). Reserve for: sign history, full-detail sign edit, signup-request review. Inline progressive disclosure (the queue-row expand pattern) is preferred.

### 5.11 Sign row (`.signrow`)

The data primitive of HOD dashboard.

```
[checkbox 24] [name + LuD 1fr] [size 80] [qty 80] [side 80] [status 110] [actions 70]
```

Mobile collapses size + side columns. Selected state uses `#FAFCEC` (faint warm yellow) — **not** the brand accent. This is intentional: selection is a tool state, not a brand moment.

### 5.12 Empty state

Center-aligned, 64px vertical padding. Light icon (42px, opacity 0.4), 17px heading, 13px copy capped at 380px width, primary action button below. One per page maximum.

---

## 6. Motion

Restrained. Motion communicates state change, never decorates.

### 6.1 Tokens

```css
--transition: all 0.15s ease;
```

Standard hover/focus duration. Use ease (CSS default) for symmetric micro-interactions; switch to `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-quint) for entrance animations.

### 6.2 Sanctioned animations

| Where | Animation | Duration |
|---|---|---|
| Modal backdrop | `fadeIn` (opacity 0→1) | 150ms |
| Modal panel | `slideUp` (translateY 8px→0, opacity 0→1) | 200ms |
| Toast | `slideInR` (translateX 20px→0) | 200ms |
| Queue row expand | `slideDown` (translateY -4px→0) | 150ms |
| Library card hover | `translateY(-1px)` + shadow-sm | 150ms |
| Button press | `translateY(0.5px)` | instant |

### 6.3 Bans

- No animating `width`/`height`/`top`/`left` (layout properties).
- No bounce, no elastic, no spring overshoot.
- No infinite loops anywhere in the chrome (loading spinners only inside button/inline contexts).
- Status changes: do not animate the pill morph. Just swap. Color change carries the meaning.

---

## 7. Iconography

**Glyph-based, monoline, 16px default.** No filled illustrations, no duotone, no animated icons. Match the editorial calm.

Recommended set: **Lucide React** at `stroke-width: 1.5`. Consistent across sidebar, buttons, badges. Sidebar icons render at 16×16 inside a 16×16 box — no padding, no background.

Sign-type badges use a dot, not an icon — keeps sign-type semantics distinct from UI icons.

---

## 8. Accessibility

- Body contrast: `--text` on `--bg` is ~17:1 (well past AAA). Maintain this; never lighten body text below `#3a3a36` on `--bg`.
- `--muted` on `--card` ≈ 4.7:1 — passes AA for normal text. Don't put muted text on `--surface` or `--tertiary` — fails.
- Status pills: every pair listed in §5.2 passes AA at 11px / weight 500. Re-test if you change any value.
- All interactive elements: 3px focus ring (`box-shadow: 0 0 0 3px rgba(0,0,0,0.05)`). Visible on every input, button, and pill that's keyboard-reachable.
- Bilingual rows: Arabic/LuD lines must have `dir="rtl"` and `lang="ar"` for screen readers. The mixed-direction grid stays LTR.
- `sr-only` utility from prototype is preserved; use for icon-only buttons.

---

## 9. Tailwind theme mapping

Add to `tailwind.config.ts` under `theme.extend`:

```ts
colors: {
  bg:        '#FAFAF7',
  card:      '#FFFFFF',
  surface:   '#F4F2EC',
  tertiary:  '#EFEDE6',
  ink:       '#1F1F1D',
  muted:     '#6F6E68',
  hint:      '#A3A09A',
  info:      { DEFAULT: '#185FA5', bg: '#E6F1FB', border: '#B8D4F0' },
  success:   { DEFAULT: '#3B6D11', bg: '#EAF3DE', border: '#C5DAA8' },
  warn:      { DEFAULT: '#BA7517', bg: '#FAEEDA', border: '#E8C698' },
  danger:    { DEFAULT: '#A32D2D', bg: '#FCEBEB', border: '#EFB8B8' },
  purple:    { DEFAULT: '#534AB7', bg: '#EEEDFE', border: '#C4C0EC' },
  teal:      { DEFAULT: '#0F6E56', bg: '#E1F5EE', border: '#A6D8C5' },
},
borderColor: {
  DEFAULT: 'rgba(0,0,0,0.08)',
  strong:  'rgba(0,0,0,0.16)',
},
borderRadius: { sm: '6px', md: '10px', lg: '14px' },
boxShadow: {
  sm: '0 1px 2px rgba(0,0,0,0.04)',
  md: '0 2px 8px rgba(0,0,0,0.06)',
  lg: '0 8px 24px rgba(0,0,0,0.08)',
},
fontSize: {
  caption: ['11px', { lineHeight: '1.4' }],
  meta:    ['12px', { lineHeight: '1.4' }],
  'body-sm': ['13px', { lineHeight: '1.4' }],
  body:    ['14px', { lineHeight: '1.5' }],
  h3:      ['15px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '500' }],
  h2:      ['18px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '500' }],
  h1:      ['24px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '500' }],
  stat:    ['26px', { lineHeight: '1.05', letterSpacing: '-0.01em', fontWeight: '500' }],
},
```

Default Tailwind grays/zincs are not used. Background utilities resolve only against the tokens above.

---

## 10. Page-level patterns

### 10.1 HOD Dashboard
Hero banner (per-event accent gradient) → stats strip (4 stats, one accent ink card) → grouped sign list (venue → zone → signs) with sticky footer batch-action bar.

### 10.2 Approval Queue (signage_hod / super_admin)
Single dense table, expand-in-place per row to reveal approve/reject form with notes textarea. No modal.

### 10.3 Production Pipeline
5-column kanban locked to status enum. Drag intent, but actual transitions are RPC calls (status machine is server-enforced). Card content: name (en + LuD), qty, dept tag, days-in-state.

### 10.4 Sign Library
Responsive grid (`auto-fill, minmax(280px, 1fr)`). Each card: name, LuD, type badge, footer with usage count + last-used date. Click → modal with `sign_history` view data.

### 10.5 Print Run Summary
Grouped by sign template; variants collapse under parent with dashed-divider sub-rows. Read-only export view.

### 10.6 Event Config (super_admin)
Color-pickers for per-event accent. The two swatches (primary + secondary) live next to a hex input + native `<input type="color">`. Inline preview of how the hero banner will look with the chosen pair.

### 10.7 Signup Request review
Modal-based on first encounter (it's a one-off action). Form mirrors RPC `approve_signup_request` payload exactly.

---

## 11. What to never do

- Reach for default Tailwind `gray-50..900`.
- Add a new shadow scale step.
- Use a card grid with identical icon-heading-text tiles (the bans list — repeated cards = AI slop).
- Hero metric template (huge number + tiny label + gradient) for stats. Use the flat `.stat` instead.
- Animate a status change. The color swap is the change.
- Add an em dash to UI copy. Use a comma, colon, or period.
- Translate prototype `D027` / `SG0184` IDs by hand (per CLAUDE.md).

---

## 12. Open questions (for the team)

- Per-event accent: schema gives one or two colors? Hero gradient assumes two; needs confirmation against `events` row.
- Dark mode: not in scope. The scene sentence forces light. Revisit only if production users request it for late-night print runs.
- Density toggle: not planned. Default density is dense; if a viewer role complains, add it then.
- Arabic/LuD font: currently Arial. If brand provides a licensed Naskh face, swap site-wide via the bilingual class only.

---

## 13. Source

- Visual source: `signage_app_prototype_v2.html` (v6 prototype).
- Domain source: `schema_v7.sql`, `signage_app_v7_spec.md`.
- Architecture rules: `CLAUDE.md` (root).

When prototype and spec disagree on naming, **spec wins** (it tracks the schema). When they disagree on visuals, **prototype wins** (this document is the codification).
