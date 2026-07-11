/**
 * <product-grid-popup> — self-contained grid + quick-view popup.
 *
 * Each grid hotspot embeds its product/variant data as a JSON script tag
 * at build time (see custom-product-grid.liquid), so opening the popup and
 * switching variants never needs a network round-trip. Only "Add to cart"
 * talks to the server, via the Cart AJAX API.
 */
if (!customElements.get('product-grid-popup')) {
  class ProductGridPopup extends HTMLElement {
    connectedCallback() {
      this.popup = this.closest('.custom-grid').querySelector('.custom-grid__popup');
      this.bundleVariantId = this.dataset.bundleVariantId || null;

      this.popupImage = this.popup.querySelector('.custom-grid__popup-image');
      this.popupTitle = this.popup.querySelector('.custom-grid__popup-title');
      this.popupPrice = this.popup.querySelector('.custom-grid__popup-price');
      this.popupDescription = this.popup.querySelector('.custom-grid__popup-description');
      this.popupOptions = this.popup.querySelector('.custom-grid__popup-options');
      this.popupMessage = this.popup.querySelector('.custom-grid__popup-message');
      this.addToCartButton = this.popup.querySelector('.custom-grid__popup-add-to-cart');

      this.addEventListener('click', this.onGridClick.bind(this));
      this.popup.querySelector('.custom-grid__popup-close').addEventListener('click', () => this.popup.close());
      this.addToCartButton.addEventListener('click', this.onAddToCart.bind(this));

      // Clicking the ::backdrop fires a click on the <dialog> itself (not its
      // content), which is how native <dialog> exposes "click outside to close".
      this.popup.addEventListener('click', (event) => {
        if (event.target === this.popup) this.popup.close();
      });

      this.popup.addEventListener('close', () => this.resetPopup());
    }

    onGridClick(event) {
      const trigger = event.target.closest('.custom-grid__hotspot-trigger');
      if (!trigger) return;

      const dataElement = this.querySelector(`#${trigger.dataset.productJsonTarget}`);
      const product = JSON.parse(dataElement.textContent);
      this.openPopup(product);
    }

    openPopup(product) {
      this.currentProduct = product;
      // selections[i] holds the chosen value for product.options[i] (option1/2/3).
      this.selections = product.options.map(() => null);

      this.popupImage.src = product.image || '';
      this.popupImage.alt = product.title;
      this.popupTitle.textContent = product.title;
      this.popupPrice.textContent = product.priceFormatted;
      this.popupDescription.textContent = product.description;

      this.renderOptions();
      this.updateSelection();

      this.popup.showModal();
    }

    resetPopup() {
      this.currentProduct = null;
      this.popupMessage.textContent = '';
      this.popupMessage.removeAttribute('data-state');
    }

    renderOptions() {
      this.popupOptions.innerHTML = '';

      this.currentProduct.options.forEach((option, index) => {
        const wrapper = document.createElement('div');
        const label = document.createElement('span');
        label.className = 'custom-grid__option-label';
        label.textContent = option.name;
        wrapper.appendChild(label);

        // Figma always renders "Color" as inline text swatches and every
        // other option (Size, etc.) as a dropdown — this mirrors that split
        // while still pulling the actual values from live product data.
        if (option.name.toLowerCase() === 'color') {
          wrapper.appendChild(this.buildSwatchRow(option, index));
        } else {
          wrapper.appendChild(this.buildSelect(option, index));
        }

        this.popupOptions.appendChild(wrapper);
      });
    }

    buildSwatchRow(option, optionIndex) {
      const row = document.createElement('div');
      row.className = 'custom-grid__swatch-row';

      option.values.forEach((value) => {
        const id = `Swatch-${this.currentProduct.title}-${optionIndex}-${value}`.replace(/\s+/g, '-');

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `custom-grid-option-${optionIndex}`;
        input.id = id;
        input.value = value;
        input.className = 'custom-grid__swatch-input';
        input.addEventListener('change', () => this.onOptionChange(optionIndex, value));

        const swatchLabel = document.createElement('label');
        swatchLabel.setAttribute('for', id);
        swatchLabel.className = 'custom-grid__swatch-label';
        swatchLabel.textContent = value;

        row.append(input, swatchLabel);
      });

      return row;
    }

    buildSelect(option, optionIndex) {
      const select = document.createElement('select');
      select.className = 'custom-grid__select';

      const placeholder = document.createElement('option');
      placeholder.textContent = `Choose your ${option.name.toLowerCase()}`;
      placeholder.value = '';
      select.appendChild(placeholder);

      option.values.forEach((value) => {
        const optionElement = document.createElement('option');
        optionElement.value = value;
        optionElement.textContent = value;
        select.appendChild(optionElement);
      });

      select.addEventListener('change', () => this.onOptionChange(optionIndex, select.value || null));

      return select;
    }

    onOptionChange(optionIndex, value) {
      this.selections[optionIndex] = value;
      this.updateSelection();
    }

    findMatchingVariant() {
      if (this.selections.some((value) => value === null)) return null;

      return this.currentProduct.variants.find((variant) =>
        this.selections.every((value, index) => variant[`option${index + 1}`] === value)
      );
    }

    updateSelection() {
      const variant = this.findMatchingVariant();
      this.currentVariant = variant;

      if (variant) {
        this.popupPrice.textContent = variant.priceFormatted;
      }

      const canAddToCart = Boolean(variant && variant.available);
      this.addToCartButton.disabled = !canAddToCart;
      this.popupMessage.textContent = '';
      this.popupMessage.removeAttribute('data-state');
    }

    // The brief's bundling rule is keyed on option *names* (Color/Size), not
    // position, so a product with options in a different order still works.
    // "Medium" covers both spelled-out values and the common "M" abbreviation
    // real catalogs use (this store's own demo products use "M").
    isBlackMediumBundleTrigger() {
      return this.currentProduct.options.every((option, index) => {
        const name = option.name.toLowerCase();
        const value = (this.selections[index] || '').toLowerCase();
        if (name === 'color') return value === 'black';
        if (name === 'size') return value === 'medium' || value === 'm';
        return true;
      });
    }

    async onAddToCart() {
      if (!this.currentVariant) return;

      const items = [{ id: this.currentVariant.id, quantity: 1 }];

      // Business rule: Color=Black + Size=Medium silently bundles the
      // merchant-configured add-on product into the same cart request.
      if (this.bundleVariantId && this.isBlackMediumBundleTrigger()) {
        items.push({ id: Number(this.bundleVariantId), quantity: 1 });
      }

      this.addToCartButton.disabled = true;

      try {
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.description || data.message || 'Unable to add to cart.');
        }

        this.popupMessage.textContent = 'Added to cart.';
        this.popupMessage.dataset.state = 'success';
        document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: data }));
      } catch (error) {
        this.popupMessage.textContent = error.message;
        this.popupMessage.dataset.state = 'error';
      } finally {
        this.addToCartButton.disabled = !(this.currentVariant && this.currentVariant.available);
      }
    }
  }

  customElements.define('product-grid-popup', ProductGridPopup);
}
