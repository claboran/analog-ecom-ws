import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { HlmBreadcrumbImports } from '@spartan-ng/helm/breadcrumb';
import type { Locale } from '@analog-ecom-ws/product-schema';
import { BreadcrumbStore } from '../stores/breadcrumb.store';

// Reads the shared BreadcrumbStore (set by whichever leaf page is active)
// and prepends Home, so pages only ever describe the segments after it.
// Hidden entirely on the landing page, where the trail is empty. The markup
// and a11y semantics (navigation landmark, aria-current on the last crumb,
// decorative separators) come from spartan's breadcrumb primitives.
@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmBreadcrumbImports],
  template: `
    @if (store.trail().length > 0) {
      <nav hlmBreadcrumb class="mb-6">
        <ol hlmBreadcrumbList>
          <li hlmBreadcrumbItem>
            <a hlmBreadcrumbLink [link]="['/', locale()]" i18n="@@nav.home">Home</a>
          </li>
          @for (item of store.trail(); track item.label) {
            <li hlmBreadcrumbSeparator></li>
            <li hlmBreadcrumbItem>
              @if (item.link) {
                <a hlmBreadcrumbLink [link]="item.link">{{ item.label }}</a>
              } @else {
                <span hlmBreadcrumbPage>{{ item.label }}</span>
              }
            </li>
          }
        </ol>
      </nav>
    }
  `,
})
export class BreadcrumbComponent {
  protected readonly store = inject(BreadcrumbStore);
  readonly locale = input.required<Locale>();
}
