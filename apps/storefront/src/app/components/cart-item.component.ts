import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Locale } from '@analog-ecom-ws/product-schema/locales';
import type { CartLine } from '../lib/cart-schema';
import { formatPrice } from '../lib/format-price';

// Purely presentational, same pattern as ProductCardComponent: line and
// locale come in as signal inputs, the line total is a pure derivation.
// Attribute selector on <li> so it can sit directly inside a <ul> (a custom
// element wrapper there would be invalid HTML). Shared by the cart,
// checkout and order-confirmation pages, which all render the same line.
// The element-selector lint rule is intentionally bypassed: this renders as
// the <li> itself so it stays valid inside a <ul>.
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'li[app-cart-item]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center justify-between py-4' },
  template: `
    <div>
      <p class="font-medium">{{ line().title }}</p>
      <p class="text-sm text-muted-foreground">{{ line().size }} / {{ line().color }} &times; {{ line().quantity }}</p>
    </div>
    <p>{{ total() }}</p>
  `,
})
export class CartItemComponent {
  readonly line = input.required<CartLine>();
  readonly locale = input.required<Locale>();

  protected readonly total = computed(() => formatPrice(this.line().quantity * this.line().unitPrice, this.locale()));
}
