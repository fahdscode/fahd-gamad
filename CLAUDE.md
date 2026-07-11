# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Shopify theme repository based on **Dawn** (Shopify's official reference theme, currently at v15.5.0 per `config/settings_schema.json`). It is pure Liquid/HTML/CSS/vanilla JS — there is no build step, no `package.json`, and no bundler. Files are deployed to Shopify as-is via Shopify CLI or the Shopify admin theme editor.

## Commands

There is no local build tooling in this repo. Development is done through the Shopify CLI (must be installed globally, not as a project dependency):

- `shopify theme dev` — start a local dev server with live reload, connected to a Shopify store
- `shopify theme check` — run Theme Check (Shopify's Liquid/theme linter) against the codebase
- `shopify theme push` — upload the theme to a store
- `shopify theme pull` — pull theme files down from a store

Since there's no test suite or linter config committed to the repo, verifying changes means running `shopify theme dev`/`theme check` against a connected store, or visually checking rendered output.

## Architecture

Standard Shopify theme structure — each top-level directory has a fixed role in Shopify's rendering pipeline:

- **`layout/`** — Outer page shells. `theme.liquid` is the main wrapper (renders `<head>`, global `<script>`/window globals like `window.routes`, `window.cartStrings`, then `{{ content_for_layout }}`); `password.liquid` is used when the store is password-protected.
- **`templates/`** — One file per resource type (`product.json`, `collection.json`, `index.json`, etc.), defining which sections render on that page and in what order/settings. Most are JSON (composable via the theme editor); `templates/customers/` holds account-related pages; `gift_card.liquid` and `password.json` are special-cased.
- **`sections/`** — Larger, schema-driven Liquid components (e.g. `main-product.liquid`, `image-banner.liquid`, `header.liquid`). Each section that's editable in the theme customizer ends with a `{% schema %} ... {% endschema %}` JSON block defining settings/blocks/presets. `header-group.json` and `footer-group.json` are section groups (persist across templates).
- **`snippets/`** — Small reusable Liquid partials included via `{% render 'snippet-name' %}` (e.g. `card-product.liquid`, `buy-buttons.liquid`, `price.liquid`). Prefer `render` over `include`; snippets should not depend on parent scope variables implicitly — pass params explicitly.
- **`assets/`** — All CSS and JS, flat (no subdirectories). Naming convention: `component-*.css` for scoped component styles, plain names for page/feature-level JS (`cart.js`, `product-form.js`, `facets.js`, etc.). No preprocessor — plain CSS with custom properties, and vanilla JS using native Web Components (`customElements.define(...)`) rather than a framework. Assets are referenced from Liquid via the `asset_url` filter and loaded with `defer`.
- **`config/`** — `settings_schema.json` defines the global theme settings (customizer sidebar); `settings_data.json` stores the current values/presets for those settings plus current section/block layout data for JSON templates.
- **`locales/`** — Translation files. `<lang>.json` = storefront-facing strings, `<lang>.schema.json` = strings used inside `{% schema %}` blocks (settings labels, preset names, etc.) referenced via `t:` prefix. `en.default.json` / `en.default.schema.json` are the source-of-truth defaults; other locales should stay in sync with these keys.

## Working with sections/blocks

- Section schemas drive the theme customizer UI — when adding a setting, add both the schema entry (in the `.liquid` file) and the corresponding locale key (in `en.default.schema.json`, ideally mirrored in other locales) if using `t:` references.
- Blocks within a section are looped and rendered via `{% for block in section.blocks %}` with `{{ block.shopify_attributes }}` on the wrapping element for editor support — follow this pattern when adding new block types.
- JSON templates (`templates/*.json`) reference sections by type and store per-instance `settings`/`blocks`/`block_order` — don't hand-edit these unless mirroring what the theme editor would produce; prefer testing changes through `shopify theme dev` + the customizer.

## JS conventions

- Interactive UI is implemented as native Web Components (custom elements), one per file, matching the asset filename to the component's concern (e.g. `product-form.js`, `quick-add.js`, `media-gallery.js`).
- Cross-component communication uses custom events (e.g. cart update events) rather than direct references — check existing components like `cart.js`/`cart-drawer.js`/`cart-notification.js` for the established event patterns before adding new cross-component behavior.
- Global routes/strings needed by JS are injected once in `layout/theme.liquid` as `window.routes`, `window.cartStrings`, `window.variantStrings`, etc. — extend these objects rather than inlining new Liquid-to-JS bridges elsewhere.
