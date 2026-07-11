/**
 * Gift-guide product grid: quick-view popup with dynamic variant selection.
 *
 * Each grid tile carries a <script type="application/json"> data island
 * rendered by Liquid (see sections/gift-guide-product-grid.liquid) with the
 * product's title, description, formatted prices and variants. Clicking a
 * tile's "+" hotspot opens the shared native <dialog> and this component
 * builds the option pickers from that data:
 *
 *   - the option named "Color" renders as a segmented radio group
 *     (values side by side, selected value inverted to black/white)
 *   - every other option renders as a "Choose your …" dropdown
 *   - products with only the default variant render no pickers at all and
 *     the sole variant is preselected
 *
 * The layout intentionally never hardcodes option names or counts, so any
 * combination (Color+Size, Size only, three options, none) works.
 */
if (!customElements.get('gift-guide-product-grid')) {
  customElements.define(
    'gift-guide-product-grid',
    class GiftGuideProductGrid extends HTMLElement {
      connectedCallback() {
        this.dialog = this.querySelector('.gift-guide-grid__popup');
        this.refs = {
          image: this.querySelector('[data-popup-image]'),
          title: this.querySelector('[data-popup-title]'),
          price: this.querySelector('[data-popup-price]'),
          description: this.querySelector('[data-popup-description]'),
          options: this.querySelector('[data-popup-options]'),
          status: this.querySelector('[data-popup-status]'),
          addButton: this.querySelector('[data-popup-add]'),
        };

        // One delegated listener covers every hotspot, including blocks
        // added later in the theme editor.
        this.addEventListener('click', this.onClick.bind(this));
        // Clicks on the <dialog> itself (not its children) hit the backdrop.
        this.dialog.addEventListener('click', (event) => {
          if (event.target === this.dialog) this.dialog.close();
        });
        // Fires for the close button, backdrop and Esc alike.
        this.dialog.addEventListener('close', this.resetPopup.bind(this));

        this.refs.addButton.addEventListener('click', this.onAddToCart.bind(this));
      }

      onClick(event) {
        const hotspot = event.target.closest('[data-product-target]');
        if (hotspot && this.contains(hotspot)) {
          const island = document.getElementById(hotspot.dataset.productTarget);
          if (!island) return;
          this.openPopup(JSON.parse(island.textContent));
          return;
        }

        if (event.target.closest('[data-popup-close]')) this.dialog.close();
      }

      openPopup(product) {
        this.product = product;
        // One slot per option; null means "not chosen yet".
        this.selections = product.options.map(() => null);

        this.refs.title.textContent = product.title;
        this.refs.price.textContent = product.priceFormatted;
        this.refs.description.textContent = product.description;
        this.refs.image.src = product.image || '';
        this.refs.image.alt = product.title;
        this.refs.status.textContent = '';
        this.refs.status.classList.remove('is-error');

        this.renderOptions();
        this.updateSelection();
        this.dialog.showModal();
      }

      /** Build the pickers for the open product's options. */
      renderOptions() {
        this.refs.options.innerHTML = '';

        this.product.options.forEach((option, index) => {
          // `values` entries are plain strings on current Liquid, but newer
          // API versions serialize them as objects with a `name`.
          const values = option.values.map((value) => (typeof value === 'string' ? value : value.name));
          const group = document.createElement('div');
          group.className = 'gift-guide-grid__option';

          const isColor = option.name.toLowerCase() === 'color' || option.name.toLowerCase() === 'colour';
          group.appendChild(this.buildOptionName(option.name));
          group.appendChild(
            isColor ? this.buildSwatchGroup(values, index) : this.buildSelect(option.name, values, index)
          );
          this.refs.options.appendChild(group);
        });
      }

      buildOptionName(name) {
        const label = document.createElement('span');
        label.className = 'gift-guide-grid__option-name';
        label.textContent = name;
        return label;
      }

      /** Segmented radio group used for the Color option. */
      buildSwatchGroup(values, optionIndex) {
        const wrapper = document.createElement('div');
        wrapper.className = 'gift-guide-grid__swatches';
        wrapper.setAttribute('role', 'radiogroup');

        values.forEach((value, valueIndex) => {
          const id = `GiftGuideOption-${this.dataset.sectionId}-${optionIndex}-${valueIndex}`;
          const swatch = document.createElement('div');
          swatch.className = 'gift-guide-grid__swatch';

          const input = document.createElement('input');
          input.type = 'radio';
          input.id = id;
          input.name = `GiftGuideOption-${this.dataset.sectionId}-${optionIndex}`;
          input.value = value;
          input.addEventListener('change', () => {
            this.selections[optionIndex] = value;
            this.updateSelection();
          });

          const label = document.createElement('label');
          label.htmlFor = id;
          label.textContent = value;

          swatch.append(input, label);
          wrapper.appendChild(swatch);
        });

        return wrapper;
      }

      /** "Choose your …" dropdown used for Size and any other option. */
      buildSelect(name, values, optionIndex) {
        const wrapper = document.createElement('div');
        wrapper.className = 'gift-guide-grid__select-wrapper';

        const select = document.createElement('select');
        select.className = 'gift-guide-grid__select';
        select.setAttribute('aria-label', name);

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = `Choose your ${name.toLowerCase()}`;
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        values.forEach((value) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.appendChild(option);
        });

        select.addEventListener('change', () => {
          this.selections[optionIndex] = select.value;
          this.updateSelection();
        });

        wrapper.appendChild(select);
        return wrapper;
      }

      /**
       * The selected variant, or null while any option is still unchosen.
       * Variants are matched positionally: selections[i] ↔ option{i+1}.
       */
      findMatchingVariant() {
        if (this.selections.some((value) => value === null)) return null;
        if (this.selections.length === 0) return this.product.variants[0] || null;

        return (
          this.product.variants.find((variant) =>
            this.selections.every((value, index) => variant[`option${index + 1}`] === value)
          ) || null
        );
      }

      /** Sync price, image and ADD TO CART state with the current choices. */
      updateSelection() {
        const variant = this.findMatchingVariant();

        if (variant) {
          this.refs.price.textContent = variant.priceFormatted;
          if (variant.image) this.refs.image.src = variant.image;
        }

        const complete = !this.selections.some((value) => value === null);
        if (complete && !variant) {
          this.refs.status.textContent = window.giftGuideStrings?.unavailable || 'This combination is unavailable';
          this.refs.status.classList.add('is-error');
        } else {
          this.refs.status.textContent = '';
          this.refs.status.classList.remove('is-error');
        }

        this.refs.addButton.disabled = !(variant && variant.available);
      }

      /**
       * Bundle rule from the brief: adding any variant whose Color option is
       * "Black" AND whose Size option is "Medium" must also add the
       * merchant-configured bundle product (Soft Winter Jacket).
       *
       * Both matches are required to come from real options of the product —
       * a product without Color/Size options can never trigger the rule.
       */
      isBundleTrigger() {
        let blackSelected = false;
        let mediumSelected = false;

        this.product.options.forEach((option, index) => {
          const name = option.name.toLowerCase();
          const value = (this.selections[index] || '').toLowerCase();
          if ((name === 'color' || name === 'colour') && value === 'black') blackSelected = true;
          // Stores commonly abbreviate Medium to "M".
          if (name === 'size' && (value === 'medium' || value === 'm')) mediumSelected = true;
        });

        return blackSelected && mediumSelected;
      }

      /**
       * Add the selected variant — plus the bundle product when the
       * Black/Medium rule fires — in a single atomic Cart API request, then
       * notify the rest of the theme so the header cart stays in sync.
       */
      async onAddToCart() {
        const variant = this.findMatchingVariant();
        if (!variant) return;

        const items = [{ id: Number(variant.id), quantity: 1 }];
        const bundleVariantId = Number(this.dataset.bundleVariantId);
        if (this.isBundleTrigger() && bundleVariantId) {
          items.push({ id: bundleVariantId, quantity: 1 });
        }

        this.refs.addButton.disabled = true;
        this.refs.addButton.setAttribute('aria-busy', 'true');
        this.refs.status.classList.remove('is-error');
        this.refs.status.textContent = '';

        try {
          const response = await fetch(`${window.routes.cart_add_url}.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.description || data.message);

          this.refs.status.textContent = window.giftGuideStrings?.addedToCart || 'Added to cart';

          // Dawn's cart components subscribe to this event (pubsub.js and
          // constants.js are loaded globally by layout/theme.liquid).
          if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            publish(PUB_SUB_EVENTS.cartUpdate, { source: 'gift-guide-product-grid', cartData: data });
          }
          this.refreshCartIcon();
        } catch (error) {
          this.refs.status.textContent =
            error.message || window.giftGuideStrings?.addError || "Couldn't add to cart. Please try again.";
          this.refs.status.classList.add('is-error');
        } finally {
          this.refs.addButton.removeAttribute('aria-busy');
          this.updateSelection();
        }
      }

      /**
       * Re-render Dawn's header cart bubble so the item count updates
       * without a page reload. Failing silently is fine — the cart itself
       * is already correct.
       */
      refreshCartIcon() {
        fetch(`${window.routes.cart_url}?section_id=cart-icon-bubble`)
          .then((response) => response.text())
          .then((html) => {
            const bubble = document.getElementById('cart-icon-bubble');
            // section_id responses arrive wrapped in a .shopify-section div,
            // same as Dawn's own cart components expect.
            const fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('.shopify-section');
            if (bubble && fresh) bubble.innerHTML = fresh.querySelector('#cart-icon-bubble')?.innerHTML ?? fresh.innerHTML;
          })
          .catch(() => {});
      }

      /** Clear transient state when the dialog closes (any close path). */
      resetPopup() {
        this.product = null;
        this.selections = [];
        this.refs.options.innerHTML = '';
        this.refs.status.textContent = '';
        this.refs.status.classList.remove('is-error');
        this.refs.addButton.disabled = true;
      }
    }
  );
}
