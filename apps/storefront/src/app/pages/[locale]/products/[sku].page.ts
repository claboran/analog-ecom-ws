import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { injectLoad } from '@analogjs/router';
import type { RouteMeta } from '@analogjs/router';
import { ProductDetailComponent } from '../../../components/product-detail.component';
import type { load } from './[sku].server';

export const routeMeta: RouteMeta = {
  meta: [
    // Non-image OG/meta fields are native RouteMeta support; the image
    // itself comes from the generated OG route (overall-goals-design.md §11).
    { property: 'og:type', content: 'product' },
  ],
};

// Thin routing shell: loads data and handles "not found" - all rendering
// and structured-data concerns live in ProductDetailComponent.
@Component({
  selector: 'app-product-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductDetailComponent],
  template: `
    @if (product(); as product) {
      <app-product-detail [product]="product" [locale]="data().locale" />
    } @else {
      <p class="text-muted-foreground">Product not found.</p>
    }
  `,
})
export default class ProductDetailPageComponent {
  protected readonly data = toSignal(injectLoad<typeof load>(), {
    initialValue: { locale: 'en' as const, sku: '', product: null },
  });

  protected readonly product = computed(() => this.data().product);
}
