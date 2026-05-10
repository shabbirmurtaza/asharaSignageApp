# Product

## Register

product

## Users

Three primary roles, distinct contexts, distinct stress profiles:

- **Department user** (primary design driver) — non-technical staff from one of 32 departments (Mawaid, Karama, Tazyeen, …). Submits a sign request usage-group once or twice per event. Unfamiliar with the app. Likely on a laptop in shared office space, possibly under deadline pressure from their HOD. **Pain: didn't know what fields meant, picked wrong size/quantity, request bounced.** Their experience dictates clarity, previews, progressive disclosure.
- **Signage HOD** — reviews/approves pending submissions across an entire event. Power user. Throughput-driven. Returns daily during event prep. Needs density, bulk actions, keyboard reachability. Should not slow down to accommodate the department-user persona.
- **Signage production team** — designers + printers. Live in the kanban. Move signs through `approved → designing → printing → ready`. Want status visibility and a clean queue.

Plus **super admin** (event/venue config, signup approval) and **viewer** (read-only stakeholders). Lower frequency, design follows the three above.

Ambient context: brightly lit office, 14-inch laptop class, mixed bilingual content (English + Arabic/LuD), event-deadline pressure. Not a phone-first product; mobile is supportive, not primary.

## Product Purpose

Track every physical sign needed at an Ashara Mubaraka event from request → approved → designed → printed → ready, across multiple events, venues, zones, and 32 departments. Replace spreadsheets and group chats with a single source of truth that respects the role boundaries (RLS-enforced) and the production status machine.

Success looks like:
- A department user submits a clean usage-group on first try without HOD coaching.
- An HOD clears a 200-row approval queue without hunting for a row.
- The production team always knows what's next and what's stuck.
- Nothing important goes missing between request and event day.

## Brand Personality

**Calm · precise · archival.** Three words, then the texture:

- *Voice*: economical, factual, bilingual-aware. Reads like a printer's ledger or a museum register, not a SaaS app.
- *Tone*: respectful of the religious context without leaning on ornament. Dignity through restraint, not through decoration.
- *Emotional goal*: trust. The user should feel the system is keeping count for them — they're not the last line of defense against a missed sign.

The product does not joke, does not cheerlead, does not animate when it could just update.

## Anti-references

- **Linear/Notion blue-grey neutrals.** Not the right warmth for an event-craft context.
- **Stripe-style purple gradients on white.** Generic SaaS reflex.
- **Religious-corporate gold + emerald ornament.** First-order category trap. The chrome stays neutral; per-event accent colors come from the database.
- **Shopify Polaris dashboards / hero-metric templates.** Big-number-tiny-label widgets imply analytics; this is operational tracking.
- **Material 3 chips and elevation soup.** Over-componentized, over-shadowed, over-rounded.
- **Toast-driven UX.** Toasts confirm, they don't carry meaning. Banners and inline state belong inline.
- **AI-illustration empty states.** No abstract gradient blob characters. Quiet typographic empty states only.

## Design Principles

1. **The schema is the spec.** Sign-type colors, status enums, role names, and naming patterns come from `schema_v7.sql`. Never invent a synonym, never skip a constraint client-side. If a screen needs data the schema can't expose cleanly, add a view or RPC — don't reshape it in JS.
2. **Two readers, one row.** Every sign-name surface is bilingual (English + Arabic/LuD). Mixed-direction text is the default case, not an edge case. If a layout breaks when the LuD line wraps, the layout is wrong.
3. **Restraint over spectacle.** Density beats decoration. Borders over shadows. Color swap over animation. A well-spaced table is the right answer more often than a card grid.
4. **Trust the boundary, polish the surface.** RLS in Postgres is the security boundary; client-side gating is UX only. Don't double-enforce, don't over-message — show users what they can act on, hide what they can't, never throw a 403 toast as a teaching tool.
5. **The newcomer pays for the expert.** Department users pay a one-time clarity tax (labels, previews, helper copy). HODs and production never pay for that clarity — their surfaces stay dense. The two postures coexist; they don't average.

## Accessibility & Inclusion

**WCAG 2.1 AA across all surfaces, plus first-class bilingual RTL polish.**

- Contrast: AA on body and pills/badges (verified against the DESIGN.md token pairs). AA-large on captions where applicable.
- Keyboard: every interactive element reachable; visible 3px focus ring on all focusables. Approval queue and kanban must be operable without a mouse for HOD and production roles.
- Screen reader: every icon-only button has `sr-only` label; every Arabic/LuD line carries `dir="rtl"` and `lang="ar"`; status changes are announced in plain English (the pill color is decoration, not the message).
- Bilingual / RTL: mixed-direction grids must not jitter when LuD content wraps to two lines. Numerals stay LTR; sign names alternate. Validate against the actual department names, not lorem.
- Reduced motion: honor `prefers-reduced-motion`. Replace slide/fade with instant state swaps; no exceptions.
- Color independence: every status pill carries a text label, never color alone. Sign-type badges include the dot AND the type name.
- Hit targets: minimum 32×32px on touch, 28×28px on dense desktop tables. Approval action buttons stay at default 34px height regardless of density.

Out of scope for now: AAA contrast everywhere, full localization beyond English + Arabic/LuD names, dark mode (the scene doesn't demand it).
