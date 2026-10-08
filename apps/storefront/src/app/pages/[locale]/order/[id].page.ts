import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import type { RouteMeta } from '@analogjs/router';
import type { Locale } from '@analog-ecom-ws/product-schema/locales';
import { HlmButton } from '@spartan-ng/helm/button';
import type { OrderView } from '../../../lib/cart-schema';
import { CartItemComponent } from '../../../components/cart-item.component';
import { formatPrice } from '../../../lib/format-price';

export const routeMeta: RouteMeta = {
  title: 'Order confirmation',
  meta: [{ name: 'robots', content: 'noindex' }],
};

// Client-only: fetched after hydration from the session-bound
// /api/orders/:id, so a different browser (or a restarted server) gets
// "not found" rather than someone else's order.
@Component({
  selector: 'app-order-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HlmButton, CartItemComponent],
  template: `
    @if (state() === 'ready' && order(); as order) {
      <h1 class="text-3xl font-semibold tracking-tight">Thank you, {{ order.userName }}!</h1>
      <p class="mt-2 text-sm text-muted-foreground">Order {{ order.id }}</p>
      <ul class="mt-6 divide-y divide-border">
        @for (line of order.lines; track line.sku + line.size + line.color) {
          <li app-cart-item [line]="line" [locale]="locale()"></li>
        }
      </ul>
      <p class="mt-6 text-right text-lg font-semibold">{{ price(order.total) }}</p>
      <a hlmBtn class="mt-6" [routerLink]="['/', locale(), 'products']">Continue shopping</a>
    } @else if (state() === 'missing') {
      <h1 class="text-3xl font-semibold tracking-tight">Order not found</h1>
      <p class="mt-2 text-muted-foreground">Orders are only visible in the session that placed them.</p>
      <a hlmBtn class="mt-6" [routerLink]="['/', locale(), 'products']">Browse products</a>
    } @else {
      <div class="h-24 animate-pulse rounded-lg bg-muted"></div>
    }
  `,
})
export default class OrderPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly locale = toSignal(
    this.route.paramMap.pipe(map((params) => (params.get('locale') as Locale) ?? 'en')),
    { initialValue: 'en' as Locale },
  );

  // Set after hydration, so the request never fires during SSR (the resource
  // stays idle while the request function returns undefined).
  private readonly orderId = signal<string | null>(null);
  private readonly orderResource = httpResource<OrderView>(() => {
    const id = this.orderId();
    return id === null ? undefined : `/api/orders/${encodeURIComponent(id)}`;
  });

  protected readonly order = computed(() => (this.orderResource.hasValue() ? this.orderResource.value() : null));
  protected readonly state = computed<'loading' | 'ready' | 'missing'>(() => {
    if (this.orderResource.error()) return 'missing';
    return this.orderResource.hasValue() ? 'ready' : 'loading';
  });

  constructor() {
    afterNextRender(() => this.orderId.set(this.route.snapshot.paramMap.get('id') ?? ''));
  }

  protected price(amount: number): string {
    return formatPrice(amount, this.locale());
  }
}
