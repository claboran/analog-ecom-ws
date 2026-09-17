import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Locale } from '@analog-ecom-ws/product-schema';
import { BreadcrumbStore } from '../stores/breadcrumb.store';

// Reads the shared BreadcrumbStore (set by whichever leaf page is active)
// and prepends Home, so pages only ever describe the segments after it.
// Hidden entirely on the landing page, where the trail is empty.
@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (store.trail().length > 0) {
      <nav class="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <a [routerLink]="['/', locale()]" class="hover:text-foreground" i18n="@@nav.home">Home</a>
        @for (item of store.trail(); track item.label) {
          <span aria-hidden="true">/</span>
          @if (item.link) {
            <a [routerLink]="item.link" class="hover:text-foreground">{{ item.label }}</a>
          } @else {
            <span class="text-foreground" aria-current="page">{{ item.label }}</span>
          }
        }
      </nav>
    }
  `,
})
export class BreadcrumbComponent {
  protected readonly store = inject(BreadcrumbStore);
  readonly locale = input.required<Locale>();
}
