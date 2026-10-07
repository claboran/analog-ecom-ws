import { ChangeDetectionStrategy, Component, afterNextRender, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { injectSwitchLocale } from '@analogjs/router/i18n';
import { LOCALES, type Locale } from '@analog-ecom-ws/product-schema/locales';
import { CartStore } from '../stores/cart.store';
import { SessionStore } from '../stores/session.store';
import { HeaderComponent } from '../components/header.component';
import { FooterComponent } from '../components/footer.component';
import { BreadcrumbComponent } from '../components/breadcrumb.component';

// Single shared shell for every /:locale route - header + <router-outlet>
// + footer. `locale` here is derived from the route (via toSignal), not
// owned local state - it stays a plain computed/signal rather than
// signalState, since signalState is for state a component actually owns
// and mutates, not a read-only projection of the router's own state
// (overall-goals-design.md §8).
@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, BreadcrumbComponent],
  template: `
    <div class="flex min-h-full flex-col bg-background text-foreground">
      <app-header [locale]="locale()" [locales]="locales" [cartCount]="cart.count()"
        [userName]="session.userName()"
        (signIn)="session.ensureSignedIn()"
        (signOut)="session.signOut()"
        (localeChange)="switchLocale($event)" />

      <main class="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <app-breadcrumb [locale]="locale()" />
        <router-outlet />
      </main>

      <app-footer />
    </div>
  `,
})
export class AppLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly switchLang = injectSwitchLocale();

  protected readonly cart = inject(CartStore);
  protected readonly session = inject(SessionStore);
  protected readonly locales = LOCALES;
  protected readonly locale = toSignal(
    this.route.paramMap.pipe(map((params) => (params.get('locale') as Locale) ?? 'en')),
    { initialValue: 'en' as Locale },
  );

  constructor() {
    // Client-only: the session cart is fetched after hydration, never during
    // SSR, so server-rendered pages stay identical for every visitor.
    afterNextRender(() => {
      void this.session.load();
      void this.cart.load(this.locale());
    });

    // Titles and prices are locale-specific and this layout (like the
    // pages under it) survives a locale switch, so an already-loaded cart
    // has to refetch. Lives here rather than per page so cart, checkout and
    // anything added later all follow. untracked: load() writes `status`,
    // which would otherwise re-trigger this effect forever; the first run
    // (status still 'idle', e.g. during SSR) is skipped on purpose, that's
    // the afterNextRender call's job.
    effect(() => {
      const locale = this.locale();
      if (untracked(() => this.cart.status()) === 'ready') {
        void this.cart.load(locale);
      }
    });
  }

  protected switchLocale(target: Locale): void {
    this.switchLang(target);
  }
}
