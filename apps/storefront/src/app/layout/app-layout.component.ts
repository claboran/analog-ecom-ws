import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { injectSwitchLocale } from '@analogjs/router/i18n';
import { LOCALES, type Locale } from '@analog-ecom-ws/product-schema';
import { HeaderComponent } from '../components/header.component';
import { FooterComponent } from '../components/footer.component';

// Single shared shell for every /:locale route - header + <router-outlet>
// + footer. `locale` here is derived from the route (via toSignal), not
// owned local state - it stays a plain computed/signal rather than
// signalState, since signalState is for state a component actually owns
// and mutates, not a read-only projection of the router's own state
// (overall-goals-design.md §8).
@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <div class="flex min-h-full flex-col bg-background text-foreground">
      <app-header [locale]="locale()" [locales]="locales" (localeChange)="switchLocale($event)" />

      <main class="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <router-outlet />
      </main>

      <app-footer />
    </div>
  `,
})
export class AppLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly switchLang = injectSwitchLocale();

  protected readonly locales = LOCALES;
  protected readonly locale = toSignal(
    this.route.paramMap.pipe(map((params) => (params.get('locale') as Locale) ?? 'en')),
    { initialValue: 'en' as Locale },
  );

  protected switchLocale(target: Locale): void {
    this.switchLang(target);
  }
}
