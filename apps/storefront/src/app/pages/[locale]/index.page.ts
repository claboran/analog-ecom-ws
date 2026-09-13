import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RouteMeta } from '@analogjs/router';

export const routeMeta: RouteMeta = {
  title: 'Analog Goods',
};

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="flex flex-col items-start gap-6">
      <h1 class="max-w-xl text-4xl font-semibold tracking-tight text-balance" i18n="@@home.heading">
        Goods, worn in, not worn out
      </h1>
      <p class="max-w-xl text-lg text-muted-foreground" i18n="@@home.subheading">
        A small catalog of shirts and shoes, in English and German, served as markdown for agents and
        rendered pages for everyone else.
      </p>
      <a
        routerLink="products"
        class="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        i18n="@@home.cta"
      >
        Browse the catalog
      </a>
    </section>

    @defer (on viewport) {
      <section class="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a
          routerLink="products"
          [queryParams]="{ category: 'apparel/shirts' }"
          class="rounded-lg border border-border p-6 transition-colors hover:border-primary"
        >
          <h2 class="text-lg font-medium">Shirts</h2>
        </a>
        <a
          routerLink="products"
          [queryParams]="{ category: 'apparel/shoes' }"
          class="rounded-lg border border-border p-6 transition-colors hover:border-primary"
        >
          <h2 class="text-lg font-medium">Shoes</h2>
        </a>
      </section>
    } @placeholder {
      <div class="mt-16 h-32"></div>
    }
  `,
})
export default class LandingPageComponent {}
