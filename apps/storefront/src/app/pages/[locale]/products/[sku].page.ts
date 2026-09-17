import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { injectLoad } from '@analogjs/router';
import type { RouteMeta } from '@analogjs/router';
import { ProductDetailComponent } from '../../../components/product-detail.component';
import { BreadcrumbStore, type BreadcrumbItem } from '../../../stores/breadcrumb.store';
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
  private readonly breadcrumbStore = inject(BreadcrumbStore);

  protected readonly data = toSignal(injectLoad<typeof load>(), {
    initialValue: { locale: 'en' as const, sku: '', product: null },
  });

  protected readonly product = computed(() => this.data().product);

  constructor() {
    // effect (not a one-time constructor call) because a client-side nav
    // between two [sku] routes reuses this component instance, and the
    // trail needs to follow the newly loaded product.
    effect(() => {
      const { locale, product } = this.data();
      // Reuse the header's @@nav.products translation; product.title is
      // already locale-specific data (loaded per-locale from S3), not UI
      // copy, so it needs no $localize of its own. Omit the trailing crumb
      // entirely while not-found/not-yet-loaded rather than inventing a
      // placeholder string to translate.
      const trail: BreadcrumbItem[] = [
        { label: $localize`:@@nav.products:Products`, link: ['/', locale, 'products'] },
      ];
      if (product) {
        trail.push({ label: product.title, link: null });
      }
      this.breadcrumbStore.setTrail(trail);
    });
  }
}
