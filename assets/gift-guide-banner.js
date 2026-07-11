/**
 * Gift-guide banner behavior.
 *
 * The only interactive part of the banner is the mobile hamburger, which
 * toggles the panel holding the announcement text and the CHOOSE GIFT
 * button (matching the Figma prototype, where the hamburger flips to an
 * "×" and the panel expands below the nav bar). Desktop shows the panel
 * inline, so the toggle is display:none there and this code is inert.
 */
if (!customElements.get('gift-guide-banner')) {
  customElements.define(
    'gift-guide-banner',
    class GiftGuideBanner extends HTMLElement {
      connectedCallback() {
        this.toggle = this.querySelector('.gift-guide-banner__menu-toggle');
        this.panel = this.querySelector('.gift-guide-banner__nav-panel');
        if (!this.toggle || !this.panel) return;

        this.toggle.addEventListener('click', this.onToggleClick.bind(this));
      }

      onToggleClick() {
        const expanded = this.toggle.getAttribute('aria-expanded') === 'true';
        this.toggle.setAttribute('aria-expanded', String(!expanded));
        this.panel.classList.toggle('is-open', !expanded);
      }
    }
  );
}
