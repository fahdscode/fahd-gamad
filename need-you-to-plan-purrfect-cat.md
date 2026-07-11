# Gift-Guide Page — Development Plan (Banner + Grid sections)

## Context

Building a pixel-perfect implementation of a Figma design (["Ecom Experts" file](https://www.figma.com/design/R5U90beaTUny18dgjcuNnB/Ecom-Experts), node `3:174`, "Tisso Vison" gift-guide page) as two brand-new Shopify sections in this repo's Dawn theme (v15.5.0). This plan covers **development work in this repository only** — account setup (Time Doctor), store/product provisioning, GitHub repo creation, and deployment are separate manual steps outside the codebase and aren't part of this plan.

**Design reference (captured from Figma, confirmed against dev-mode):**
- **Banner** (desktop node `3:174` → `Frame 1957`, mobile node `3:325`): nav bar ("TISSO VISON" wordmark + announcement text "Find the ideal gift for your loved ones." + yellow "CHOOSE GIFT" button) → hero with line-art illustration background, "The Gift Guide" heading, description paragraph, black "SHOP NOW →" button with arrow-hover animation → thin sub-banner strip "SUSTAINABLE, ETHICALLY MADE CLOTHES IN SIZES XXS TO 6XL". All text pieces are separately editable (heading, description, button labels/links, announcement text, sub-banner text).
- **Grid** ("Tisso vison in the wild" section): heading + a 6-image grid (2 cols × 3 rows on both mobile and desktop, per Figma), each image has a small circular "+" hotspot. Clicking a hotspot opens a **popup**.
- **Popup** (captured from node `3:523` family, e.g. "Frame 1000009749"): close (×) icon top-right; product image (120×140) top-left; name, price, description top-right; below that a **Color** selector rendered as two side-by-side text swatches (e.g. "White" / "Black"); below that a **Size** dropdown ("Choose your size" → XS/S/M/L/XL, from component `3:1036`); full-width black "ADD TO CART →" button at the bottom.
- **Special rule**: adding a product to cart with variant options `Color=Black` + `Size=Medium` must also silently add a configurable "bundle" product/variant (e.g. "Soft Winter Jacket") to the cart in the same flow.

**Codebase conventions confirmed via exploration** (to follow, not to copy wholesale — see Reuse policy):
- Section schema shape, `type: "product"` block picker, `color_scheme` setting, and `t:sections.<name>.settings.<id>.label` locale-key convention — pattern found in `sections/collage.liquid`, `sections/image-banner.liquid`, `locales/en.default.schema.json`.
- CSS/JS are always loaded as external assets (`{{ 'x.css' | asset_url | stylesheet_tag }}`, `<script src="{{ 'x.js' | asset_url }}" defer>`), never inlined via `{% stylesheet %}`/`{% javascript %}` (Dawn's own convention, one exception in `header.liquid`).
- Cart AJAX: `/cart/add.js` accepts a JSON body `{items: [{id, quantity}, ...]}` (multi-line-item add-to-cart is a *platform* API capability, confirmed no theme code currently uses it — this is what makes the "auto-add bundle product" rule a single-request operation instead of two).
- Arrow-hover CTA styling exists as a utility class (`.animate-arrow .icon-arrow` in `assets/base.css`) — informative reference for the "implement the animation on the buttons" requirement, but the new sections define their own button/arrow animation CSS rather than depend on this Dawn class (see Reuse policy).

## Reuse policy ("from scratch" interpretation)

The two new sections must be **fully custom** — new Liquid, new CSS, new JS classes, not extending or rendering Dawn's existing sections/snippets/JS classes (no `card-product.liquid`, no `ModalDialog`/`quick-add-modal`, no `product-variant-picker.liquid`). The **only** shared surface is Shopify's public platform APIs that any theme (Dawn or not) would call the same way:
- Liquid objects/filters: `product`, `product.variants`, `money` filters, `image_url`, etc.
- Cart AJAX endpoints: `/cart/add.js`, `/cart/change.js`, `/cart.js`.
- Native browser APIs: `<dialog>` or a custom element built from scratch, `fetch`, `customElements.define`.

This keeps the two sections self-contained and defensible as "from scratch" work while still behaving correctly inside the theme.

---

## Phase 1 — Page template scaffold

- `templates/page.gift-guide.json`: new JSON template referencing the two sections built below, in order (Banner, then Grid). This is the file a merchant assigns to a Shopify Page in admin once the sections exist — no admin/account action required to create the file itself.

## Phase 2 — Banner section (`sections/custom-banner.liquid`)

- Schema: `settings` for nav announcement text, "Choose Gift" button label/link, heading, description, "Shop Now" button label/link, sub-banner strip text, and a `color_scheme` setting — every text field the brief calls "editable from the customizer" gets its own setting (no blocks needed; this is a fixed single-instance layout per Figma).
- Markup: semantic markup for nav bar / hero / sub-banner strip, background illustration as an `image_picker` setting (so merchants can swap it) defaulting to the Figma artwork exported as an asset.
- CSS: `assets/section-custom-banner.css`, loaded via `stylesheet_tag`. Recreate exact spacing/typography from the Figma capture (yellow `#fff544` button, black button, line-art background).
- JS: `assets/section-custom-banner.js`, only if the button hover/arrow animation needs JS beyond CSS `:hover`/`transition` (likely CSS-only is sufficient; keep JS out unless needed).
- Locale keys: add `sections.custom-banner.*` entries to `locales/en.default.schema.json` for every setting label, following the `t:sections.<name>.settings.<id>.label` path convention.

## Phase 3 — Grid section schema + markup (`sections/custom-product-grid.liquid`)

- Schema: section-level settings include heading text, `color_scheme`, and a **bundle add-on product picker** (`type: "product"`, id `bundle_product`, labeled "Bundle add-on product" — this is where the auto-add product gets selected, kept configurable rather than hardcoded).
- Blocks: one block type `product_block`, `type: "product"` setting per block (mirroring the picker pattern found in `sections/collage.liquid`, but re-implemented independently), `max_blocks: 6`, with a preset containing exactly 6 blocks so the merchant drops it in fully wired.
- Markup: 2×3 responsive grid (CSS grid, `grid-template-columns: repeat(2, 1fr)` — Figma shows 2 columns on both mobile and desktop for this section), each cell = product image + hotspot button (`<button class="grid-hotspot" data-product-handle="{{ block.settings.product.handle }}">`).
- CSS: `assets/section-custom-product-grid.css`.

## Phase 4 — Popup + dynamic variant rendering

- Popup markup: a single reusable `<dialog>`-based (or custom-element-based) popup container rendered once per section instance, populated dynamically by JS per the clicked hotspot — avoids duplicating full product markup 6×.
- Product data (name, price, description, variants with option values + IDs, image) embedded as a `<script type="application/json">` data island per grid block — a from-scratch equivalent of a "selected variant JSON" pattern (just the general technique of embedding structured data for JS to consume, not copied from Dawn's implementation).
- JS (`assets/section-custom-product-grid.js`, a single custom element e.g. `<product-grid-popup>`): reads the clicked block's product JSON, builds the Color swatch row and Size dropdown from `product.options`/`product.variants`, tracks the current selection, resolves the selected option combination to a variant ID via a client-side lookup table (no server round-trip needed), and enables/disables Add to Cart based on a valid variant being selected.
- Locale keys: `sections.custom-product-grid.*` in `locales/en.default.schema.json`.

## Phase 5 — Cart & bundle logic (lives inside Phase 4's JS)

- On Add to Cart click: resolve `variantId` from the current Color+Size selection.
- Build `items` array: always `[{id: variantId, quantity: 1}]`; if the selected variant's option values are exactly `Color=Black` and `Size=Medium`, also look up the bundle product's first/default variant ID (from the section's `bundle_product` setting, rendered into the same JSON data island) and push `{id: bundleVariantId, quantity: 1}` into the same array.
- Single `fetch('/cart/add.js', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({items})})` — one request handles both the base add and the bundle rule.
- On success: dispatch a custom event + minimal cart-count UI bump, and show a success message in the popup. On failure: inline error message in the popup, no silent failure.
- Comment the "why" of the bundling branch clearly (business rule, not obvious from code).

## Phase 6 — Mobile responsive pass

- Verify both sections against the Figma mobile frame (captured above) at common breakpoints, following Dawn's existing CSS custom-property breakpoint conventions (`@media screen and (max-width: 749px)`) for consistency even though the CSS itself is new.

## Phase 7 — Local verification

Use `shopify theme dev` (connected to any dev store) to check the built sections end to end before considering the code done:

- [ ] Banner: every text field editable in customizer; Shop Now button shows arrow-hover animation.
- [ ] Grid: exactly 6 blocks, each bound to a real product via customizer, hotspots visible on each image.
- [ ] Popup: opens on hotspot click, shows correct name/price/description/image for that product; Color and Size reflect that product's real variants (not hardcoded).
- [ ] Add to Cart works for a normal variant (cart count updates, no console errors).
- [ ] Selecting Color=Black + Size=Medium and adding to cart also adds the configured bundle product — verify via `/cart.js` showing 2 line items after one click.
- [ ] Mobile viewport (375px–428px) matches Figma mobile frame for both sections and the popup.
- [ ] No jQuery anywhere in new files: `grep -ri jquery assets/section-custom-*.js` returns nothing.
- [ ] Code has purposeful comments (why, not what) on the schema choices and the bundling logic specifically.
