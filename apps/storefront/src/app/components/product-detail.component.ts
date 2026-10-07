import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormField, FormRoot, form, max, min, required } from '@angular/forms/signals';
import { DomSanitizer, Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { injectBaseURL } from '@analogjs/router/tokens';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import type { Locale, Product } from '@analog-ecom-ws/product-schema';
import { JsonLdDirective } from '../directives/json-ld.directive';
import { MAX_QUANTITY, MAX_USER_NAME_LENGTH } from '../lib/cart-constants';
import { formatPrice } from '../lib/format-price';
import { META_DESCRIPTION_MAX_LENGTH, productDescription } from '../lib/product-description';
import { CartStore } from '../stores/cart.store';

type AddToCartModel = {
  size: string;
  color: string;
  quantity: number;
  userName: string;
};

// Purely presentational, same pattern as ProductCardComponent for the
// signal inputs: price/bodyHtml/jsonLd are pure derivations of `product`/
// `locale`, so they stay plain `computed()` - there's nothing to "own"
// between renders, and syncing them into signalState would just be a
// second source of truth with no benefit.
//
// bodyHtml is rendered with `marked` in libs/s3-client, not Analog's own
// <analog-markdown> (@analogjs/content) - that component's `content`
// input looked like a clean fit (independent of the file-based content-
// collection APIs), but it triggers a genuine SSR-breaking incompatibility
// in this project's Vite/Nitro AOT server build (a partially-Ivy-linked
// dependency needing the JIT compiler for PlatformLocation, which gets
// tree-shaken out of the production bundle even with the standard
// `import '@angular/compiler'` workaround). See product-schema.ts for the
// full note.
//
// The add-to-cart form below is different: the user's *selection* is real
// state that must persist independently of `product` until they change it,
// but also has to *reset* whenever `product` changes - Angular Router
// reuses this exact component instance across /:locale/products/:skuA ->
// :skuB navigations (same route config, see JsonLdDirective's comment for
// the same reuse fact), so without an explicit reset a size picked on one
// product would leak into the next. A signal form over a writable model
// signal fits that: the model is the single source of truth, the `effect()`
// below re-derives size/color from the input, and the form's validation and
// submission state come for free. (The toggle groups aren't form controls,
// so they read/write the model directly instead of using [formField].)
//
// userName is only asked for - and only validated - while the server-side
// session (CartStore) has no user yet: the first add-to-cart is what
// attaches a name to the session.
@Component({
  selector: 'app-product-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, JsonLdDirective, HlmButton, HlmBadge, HlmToggleGroupImports, FormRoot, FormField],
  template: `
    <div [appJsonLd]="jsonLd()">
      <a hlmBtn variant="ghost" size="sm" routerLink="..">&larr; Back to products</a>

      <div class="mt-6 grid grid-cols-1 gap-10 md:grid-cols-2">
        <img
          [src]="product().images[0]"
          [alt]="product().title"
          class="w-full rounded-lg"
          width="640"
          height="640"
        />

        <div>
          <span hlmBadge variant="secondary">{{ product().category.split('/')[1] }}</span>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight">{{ product().title }}</h1>
          <p class="mt-3 text-xl">{{ price() }}</p>

          @if (product().stock > 0) {
            <!-- accent = the one-off brand-accent badge color (see styles.css),
                 added as a variant in libs/ui/badge. -->
            <span hlmBadge variant="accent" class="mt-4">In stock</span>
          } @else {
            <span hlmBadge variant="muted" class="mt-4">Out of stock</span>
          }

          <div class="mt-6 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p class="text-muted-foreground">Size</p>
              <hlm-toggle-group
                class="mt-2 flex-wrap"
                type="single"
                variant="outline"
                size="sm"
                aria-label="Size"
                [nullable]="false"
                [value]="model().size"
                (valueChange)="selectSize($event)"
              >
                @for (size of product().sizes; track size) {
                  <button hlmToggleGroupItem [value]="size">{{ size }}</button>
                }
              </hlm-toggle-group>
            </div>
            <div>
              <p class="text-muted-foreground">Color</p>
              <hlm-toggle-group
                class="mt-2 flex-wrap"
                type="single"
                variant="outline"
                size="sm"
                aria-label="Color"
                [nullable]="false"
                [value]="model().color"
                (valueChange)="selectColor($event)"
              >
                @for (color of product().colors; track color) {
                  <button hlmToggleGroupItem [value]="color">{{ color }}</button>
                }
              </hlm-toggle-group>
            </div>
          </div>

          <form [formRoot]="addForm" class="mt-8 flex flex-col gap-4">
            @if (!cart.userName()) {
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-muted-foreground">Your name</span>
                <input
                  type="text"
                  autocomplete="name"
                  class="h-9 rounded-md border border-input bg-background px-2.5"
                  [formField]="addForm.userName"
                />
                @if (addForm.userName().touched() && addForm.userName().invalid()) {
                  <span class="text-destructive" role="alert">Please enter your name.</span>
                }
              </label>
            } @else {
              <p class="text-sm text-muted-foreground">Shopping as {{ cart.userName() }}</p>
            }

            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">Quantity</span>
              <input
                type="number"
                class="h-9 w-24 rounded-md border border-input bg-background px-2.5"
                [formField]="addForm.quantity"
              />
            </label>

            <div class="flex items-center gap-4">
              <button hlmBtn type="submit" [disabled]="product().stock < 1 || addForm().submitting()">
                Add to cart
              </button>
              @if (justAdded()) {
                <a class="text-sm underline" [routerLink]="['/', locale(), 'cart']" role="status">Added - view cart</a>
              }
            </div>
            @for (error of addForm().errors(); track $index) {
              @if (error.kind === 'server') {
                <p class="text-sm text-destructive" role="alert">{{ error.message }}</p>
              }
            }
          </form>

          <div class="prose prose-sm mt-8 max-w-none" [innerHTML]="bodyHtml()"></div>
        </div>
      </div>
    </div>
  `,
})
export class ProductDetailComponent {
  readonly product = input.required<Product>();
  readonly locale = input.required<Locale>();

  private readonly sanitizer = inject(DomSanitizer);
  private readonly meta = inject(Meta);
  private readonly baseUrl = injectBaseURL();

  protected readonly cart = inject(CartStore);

  protected readonly model = signal<AddToCartModel>({ size: '', color: '', quantity: 1, userName: '' });
  protected readonly justAdded = signal(false);

  protected readonly addForm = form(
    this.model,
    (path) => {
      required(path.userName, { when: () => !this.cart.userName() });
      min(path.quantity, 1);
      max(path.quantity, MAX_QUANTITY);
    },
    {
      submission: {
        action: async () => {
          const { size, color, quantity, userName } = this.model();
          try {
            await this.cart.add({
              sku: this.product().sku,
              size,
              color,
              quantity,
              locale: this.locale(),
              ...(this.cart.userName() ? {} : { userName: userName.trim().slice(0, MAX_USER_NAME_LENGTH) }),
            });
          } catch {
            this.justAdded.set(false);
            return { kind: 'server', message: 'Could not add to cart. Please try again.' };
          }
          this.justAdded.set(true);
          return undefined;
        },
      },
    },
  );

  constructor() {
    // Re-derive the default selection (first size/color) whenever the
    // underlying product changes - this is the "sync input into local
    // state" half of the pattern, keeping the picker from carrying a
    // stale or invalid selection across a reused component instance.
    effect(() => {
      const product = this.product();
      this.model.update((model) => ({
        ...model,
        size: product.sizes[0] ?? '',
        color: product.colors[0] ?? '',
        quantity: 1,
      }));
      this.justAdded.set(false);
    });

    // Per-product <meta name="description"> and OG/Twitter image tags.
    // Has to be an effect for the same reason as the picker reset above
    // (and JsonLdDirective): the component instance is reused across
    // [sku] navigations. updateTag replaces an existing tag rather than
    // appending a second.
    effect(() => {
      const product = this.product();
      const description = productDescription(product, META_DESCRIPTION_MAX_LENGTH);
      this.meta.updateTag({ name: 'description', content: description });

      // injectBaseURL() is null in contexts with no request/host to derive
      // it from (e.g. a unit test); og:image needs an absolute URL to mean
      // anything to a crawler, so skip it entirely rather than emit a
      // broken relative one.
      if (this.baseUrl) {
        const ogImageUrl = `${this.baseUrl}/api/og/products/${product.sku}?locale=${this.locale()}`;
        this.meta.updateTag({ property: 'og:title', content: product.title });
        this.meta.updateTag({ property: 'og:description', content: description });
        this.meta.updateTag({ property: 'og:image', content: ogImageUrl });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.meta.updateTag({ name: 'twitter:image', content: ogImageUrl });
      }
    });
  }

  // The "let the user override afterward" half - independent of
  // `product()`, kept until the effect above resets it on the next
  // product change.
  // The toggle group emits an untyped ToggleValue. Both groups are
  // single-select with [nullable]="false" (the brain default is nullable, so
  // re-clicking the selected item would otherwise clear it and leave the UI
  // out of sync with this state); anything but a string is ignored anyway.
  protected selectSize(size: unknown): void {
    if (typeof size === 'string') {
      this.model.update((model) => ({ ...model, size }));
    }
  }

  protected selectColor(color: unknown): void {
    if (typeof color === 'string') {
      this.model.update((model) => ({ ...model, color }));
    }
  }

  protected readonly price = computed(() => formatPrice(this.product().price, this.locale()));

  // The body already comes from our own markdown rendering (not user
  // input); Angular still sanitizes [innerHTML] bindings by default,
  // which is fine defense-in-depth here.
  protected readonly bodyHtml = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.product().bodyHtml));

  // schema.org Product structured data, built from the same validated
  // product the page renders - fed into [appJsonLd] above, which owns the
  // actual DOM writing (overall-goals-design.md §11).
  protected readonly jsonLd = computed(() => {
    const product = this.product();
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      sku: product.sku,
      name: product.title,
      description: productDescription(product),
      image: product.images,
      offers: {
        '@type': 'Offer',
        priceCurrency: product.currency,
        price: product.price,
        availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
    };
  });
}
