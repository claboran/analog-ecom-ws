import { ChangeDetectionStrategy, Component } from '@angular/core';

// Fully static - no inputs, no state at all.
@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="border-t border-border">
      <div class="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-6 text-sm text-muted-foreground">
        <p i18n="@@footer.tagline">A small storefront demo for AnalogJS i18n + spartan.ng.</p>
        <p>
          <span i18n="@@footer.agents">Machine-readable product data</span>:
          <a class="underline hover:text-foreground" href="/llms.txt">llms.txt</a>
        </p>
      </div>
    </footer>
  `,
})
export class FooterComponent {}
