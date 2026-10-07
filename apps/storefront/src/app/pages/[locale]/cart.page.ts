import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import type { RouteMeta } from '@analogjs/router';
import type { Locale } from '@analog-ecom-ws/product-schema/locales';
import { HlmButton } from '@spartan-ng/helm/button';
import { CartItemComponent } from '../../components/cart-item.component';
import { formatPrice } from '../../lib/format-price';
import { CartStore } from '../../stores/cart.store';

export const routeMeta: RouteMeta = {
  title: 'Cart',
  // Personal, session-bound page: nothing for a crawler to index.
  meta: [{ name: 'robots', content: 'noindex' }],
};

// Client-only by construction: CartStore stays 'idle' during SSR, so the
// server renders just the skeleton branch and the real cart appears after
// hydration.
@Component({
  selector: 'app-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HlmButton, CartItemComponent],
  template: `
    <h1 class="text-3xl font-semibold tracking-tight">Cart</h1>

    @if (cart.status() === 'ready') {
      @if (cart.lines().length === 0) {
        <p class="mt-6 text-muted-foreground">Your cart is empty.</p>
        <a hlmBtn class="mt-4" [routerLink]="['/', locale(), 'products']">Browse products</a>
      } @else {
        <p class="mt-2 text-sm text-muted-foreground">Shopping as {{ cart.userName() }}</p>
        <ul class="mt-6 divide-y divide-border">
          @for (line of cart.lines(); track line.sku + line.size + line.color) {
            <li app-cart-item [line]="line" [locale]="locale()"></li>
          }
        </ul>
        <p class="mt-6 text-right text-lg font-semibold">{{ price(cart.total()) }}</p>
        <div class="mt-6 flex justify-end">
          <a hlmBtn [routerLink]="['/', locale(), 'checkout']">Checkout</a>
        </div>
      }
    } @else if (cart.status() === 'error') {
      <p class="mt-6 text-destructive">The cart could not be loaded.</p>
    } @else {
      <div class="mt-6 h-24 animate-pulse rounded-lg bg-muted"></div>
    }
  `,
})
export default class CartPageComponent {
  protected readonly cart = inject(CartStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly locale = toSignal(
    this.route.paramMap.pipe(map((params) => (params.get('locale') as Locale) ?? 'en')),
    { initialValue: 'en' as Locale },
  );

  protected price(amount: number): string {
    return formatPrice(amount, this.locale());
  }
}
