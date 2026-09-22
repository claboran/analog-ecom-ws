import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmCardImports } from '@spartan-ng/helm/card';
import type { Locale, Product } from '@analog-ecom-ws/product-schema';
import { formatPrice } from '../lib/format-price';

// Purely presentational, no local state. Signal inputs (not decorator
// @Input()) are required here, not just a style choice: `computed()` only
// tracks *signal* reads as dependencies - a plain @Input() property
// wouldn't make `price` reactive to input changes at all if this
// component instance is ever reused with different bindings (e.g. list
// reordering).
@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HlmCardImports, HlmBadge],
  template: `
    <a
      hlmCard
      [routerLink]="[product().sku]"
      class="h-full transition-shadow hover:ring-2 hover:ring-primary"
    >
      <img
        [src]="product().images[0]"
        [alt]="product().title"
        class="aspect-square w-full object-cover"
        width="640"
        height="640"
      />
      <div hlmCardContent class="flex flex-col items-start gap-2">
        <span hlmBadge variant="secondary">{{ product().category.split('/')[1] }}</span>
        <h2 hlmCardTitle>{{ product().title }}</h2>
        <p class="text-sm text-muted-foreground">{{ price() }}</p>
      </div>
    </a>
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly locale = input.required<Locale>();

  protected readonly price = computed(() => formatPrice(this.product().price, this.locale()));
}
