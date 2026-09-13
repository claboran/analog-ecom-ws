import { DOCUMENT } from '@angular/common';
import { Directive, DestroyRef, Renderer2, effect, inject, input } from '@angular/core';

// Injects/updates a <script type="application/ld+json"> in <head> from a
// plain object input. Not just an organizational nicety over the old
// constructor-based version: Angular Router *reuses* a routed component
// instance when only a param changes (e.g. navigating between
// /:locale/products/:skuA and /:locale/products/:skuB - same route
// config), so a constructor never re-runs on that navigation. The old
// approach would have left stale JSON-LD from the previous product in
// <head>. An `effect()` reacting to the `appJsonLd` input signal re-runs
// on every change, including in-place param navigations, and the
// `DestroyRef` callback cleans up when navigating away from the route
// entirely.
//
// Angular strips literal <script> elements written directly in templates
// (a security default, even static ones) - Renderer2 bypasses that
// because it creates real DOM nodes outside the template compiler's
// reach, which is also why this can't just be a `<script>{{ appJsonLd() }}
// </script>` in the template.
@Directive({
  selector: '[appJsonLd]',
})
export class JsonLdDirective {
  readonly appJsonLd = input<Record<string, unknown> | null>(null);

  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private scriptEl: HTMLScriptElement | null = null;

  constructor() {
    effect(() => {
      const data = this.appJsonLd();
      if (!data) {
        this.remove();
        return;
      }
      const script = this.scriptEl ?? (this.renderer.createElement('script') as HTMLScriptElement);
      if (!this.scriptEl) {
        this.renderer.setAttribute(script, 'type', 'application/ld+json');
        this.renderer.appendChild(this.document.head, script);
        this.scriptEl = script;
      }
      script.textContent = JSON.stringify(data);
    });

    inject(DestroyRef).onDestroy(() => this.remove());
  }

  private remove(): void {
    if (this.scriptEl) {
      this.renderer.removeChild(this.document.head, this.scriptEl);
      this.scriptEl = null;
    }
  }
}
