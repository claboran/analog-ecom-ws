import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import type { RouteMeta } from '@analogjs/router';
import type { Locale } from '@analog-ecom-ws/product-schema/locales';
import { HlmButton } from '@spartan-ng/helm/button';
import { CartItemComponent } from '../../components/cart-item.component';
import { formatPrice } from '../../lib/format-price';
import { CartStore } from '../../stores/cart.store';

export const routeMeta: RouteMeta = {
  title: 'Checkout',
  meta: [{ name: 'robots', content: 'noindex' }],
};

// Client-only like the cart page (CartStore is 'idle' during SSR). There's
// no login and no payment: the session user was attached on the first
// add-to-cart, so checkout is just a review and a button.
@Component({
  selector: 'app-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HlmButton, CartItemComponent],
  template: `
    <h1 class="text-3xl font-semibold tracking-tight">Checkout</h1>

    @if (cart.status() === 'ready') {
      @if (cart.lines().length === 0) {
        <p class="mt-6 text-muted-foreground">Your cart is empty.</p>
        <a hlmBtn class="mt-4" [routerLink]="['/', locale(), 'products']">Browse products</a>
      } @else {
        <p class="mt-2 text-sm text-muted-foreground">Ordering as {{ cart.userName() }}</p>
        <ul class="mt-6 divide-y divide-border">
          @for (line of cart.lines(); track line.sku + line.size + line.color) {
            <li app-cart-item [line]="line" [locale]="locale()"></li>
          }
        </ul>
        <p class="mt-6 text-right text-lg font-semibold">{{ price(cart.total()) }}</p>
        <p class="mt-2 text-right text-xs text-muted-foreground">Demo shop: no payment is taken.</p>
        <div class="mt-6 flex items-center justify-end gap-4">
          @if (error(); as message) {
            <p class="text-sm text-destructive" role="alert">{{ message }}</p>
          }
          <button hlmBtn type="button" [disabled]="placing()" (click)="placeOrder()">Place order</button>
        </div>
      }
    } @else if (cart.status() === 'error') {
      <p class="mt-6 text-destructive">The cart could not be loaded.</p>
    } @else {
      <div class="mt-6 h-24 animate-pulse rounded-lg bg-muted"></div>
    }
  `,
})
export default class CheckoutPageComponent {
  protected readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly locale = toSignal(
    this.route.paramMap.pipe(map((params) => (params.get('locale') as Locale) ?? 'en')),
    { initialValue: 'en' as Locale },
  );

  protected readonly placing = signal(false);
  // The server's reason for a 409 (empty cart, not enough stock); null means
  // no error, any other failure falls back to a generic message.
  protected readonly error = signal<string | null>(null);

  protected price(amount: number): string {
    return formatPrice(amount, this.locale());
  }

  protected async placeOrder(): Promise<void> {
    this.placing.set(true);
    this.error.set(null);
    try {
      const order = await this.cart.checkout(this.locale());
      await this.router.navigate(['/', this.locale(), 'order', order.id]);
    } catch (err) {
      const reason = err instanceof HttpErrorResponse && err.status === 409 ? err.error?.statusMessage : null;
      this.error.set(reason ?? 'Could not place the order. Please try again.');
    } finally {
      this.placing.set(false);
    }
  }
}
