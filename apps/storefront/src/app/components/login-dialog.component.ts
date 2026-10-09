import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, maxLength, required } from '@angular/forms/signals';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmInput } from '@spartan-ng/helm/input';
import { MAX_USER_NAME_LENGTH } from '../lib/cart-constants';

type LoginDialogContext = {
  // Passed in by SessionStore rather than injected, so this component never
  // imports the store (which lazy-imports this component).
  signIn: (userName: string) => Promise<void>;
};

// The pseudo login: a display name, no password. Opened through
// HlmDialogService by SessionStore.ensureSignedIn(); closes with `true` once
// signed in, anything else (Esc, backdrop, close button) counts as dismissed.
@Component({
  selector: 'app-login-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmDialogImports, HlmButton, HlmInput, FormRoot, FormField],
  template: `
    <form [formRoot]="loginForm" class="flex flex-col gap-4">
      <hlm-dialog-header>
        <h2 hlmDialogTitle i18n="@@login.title">Sign in</h2>
        <p hlmDialogDescription i18n="@@login.description">
          Pick a name for this demo session - there is no password. It is kept until you sign out or the session expires.
        </p>
      </hlm-dialog-header>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground" i18n="@@login.name">Your name</span>
        <input hlmInput type="text" autocomplete="name" [formField]="loginForm.userName" />
        @if (loginForm.userName().touched() && loginForm.userName().invalid()) {
          <span class="text-destructive" role="alert" i18n="@@login.nameRequired">Please enter your name.</span>
        }
      </label>

      @for (error of loginForm().errors(); track $index) {
        @if (error.kind === 'server') {
          <p class="text-sm text-destructive" role="alert">{{ error.message }}</p>
        }
      }

      <hlm-dialog-footer>
        <button hlmBtn type="submit" [disabled]="loginForm().submitting()" i18n="@@login.submit">Sign in</button>
      </hlm-dialog-footer>
    </form>
  `,
})
export class LoginDialogComponent {
  private readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
  private readonly context = injectBrnDialogContext<LoginDialogContext>();

  private readonly model = signal({ userName: '' });

  protected readonly loginForm = form(
    this.model,
    (path) => {
      required(path.userName);
      maxLength(path.userName, MAX_USER_NAME_LENGTH);
    },
    {
      submission: {
        action: async () => {
          try {
            await this.context.signIn(this.model().userName.trim());
          } catch {
            return { kind: 'server', message: 'Could not sign in. Please try again.' };
          }
          this.ref.close(true);
          return undefined;
        },
      },
    },
  );
}
