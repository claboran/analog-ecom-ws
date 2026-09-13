import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { injectLoad } from '@analogjs/router';
import type { RouteMeta } from '@analogjs/router';
import type { Category } from '@analog-ecom-ws/product-schema';
import { ProductCardComponent } from '../../../components/product-card.component';
import type { load } from './index.server';

export const routeMeta: RouteMeta = {
  title: 'Products',
};

// Not a search feature (cut from v1 scope, see overall-goals-design.md
// §8) - just following the two static category links from the landing
// page. No free-text input, no debounce, no store.
@Component({
  selector: 'app-product-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductCardComponent],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight" i18n="@@nav.products">Products</h1>

    <div class="mt-4 flex gap-2 text-sm">
      <a
        routerLink="."
        [queryParams]="{}"
        class="rounded-full border border-border px-3 py-1"
        [class.bg-primary]="!activeCategory()"
        [class.text-primary-foreground]="!activeCategory()"
      >
        All
      </a>
      @for (category of categories; track category) {
        <a
          routerLink="."
          [queryParams]="{ category }"
          class="rounded-full border border-border px-3 py-1"
          [class.bg-primary]="activeCategory() === category"
          [class.text-primary-foreground]="activeCategory() === category"
        >
          {{ category.split('/')[1] }}
        </a>
      }
    </div>

    <ul class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      @for (product of filteredProducts(); track product.sku) {
        <li>
          <app-product-card [product]="product" [locale]="data().locale" />
        </li>
      } @empty {
        <li class="col-span-full text-muted-foreground">No products found.</li>
      }
    </ul>
  `,
})
export default class ProductListPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly data = toSignal(injectLoad<typeof load>(), {
    initialValue: { locale: 'en' as const, products: [] },
  });

  protected readonly categories: Category[] = ['apparel/shirts', 'apparel/shoes'];

  protected readonly activeCategory = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('category') as Category | null)),
    { initialValue: null },
  );

  protected readonly filteredProducts = computed(() => {
    const products = this.data().products;
    const category = this.activeCategory();
    return category ? products.filter((product) => product.category === category) : products;
  });
}
