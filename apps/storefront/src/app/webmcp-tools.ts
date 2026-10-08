import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, type WebMcpToolDescriptor } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CATEGORIES, LOCALES, type Locale } from '@analog-ecom-ws/product-schema/locales';
import { MAX_QUANTITY } from './lib/cart-constants';
import { CartStore } from './stores/cart.store';
import { SessionStore } from './stores/session.store';

// WebMCP tools exposed to browser agents. Each tool is a thin adapter over an
// existing store or API, so the agent goes through the same code path as the
// UI. Registered only in the browser (see app.config.browser.ts): the server
// has no navigator.modelContext.

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) }],
});
const failure = (message: string) => ({ ...text(message), isError: true });

// The locale the user is currently browsing (first URL segment), unless the
// agent asks for another one explicitly.
const resolveLocale = (requested?: string): Locale => {
  if (requested && (LOCALES as readonly string[]).includes(requested)) {
    return requested as Locale;
  }
  const first = inject(Router).url.split('/')[1];
  return (LOCALES as readonly string[]).includes(first) ? (first as Locale) : 'en';
};

const localeProperty = {
  type: 'string',
  enum: [...LOCALES],
  description: 'Language and market. Defaults to the language the user is currently browsing.',
} as const;

// Opens the login dialog for the user without waiting for it: a tool call
// that blocks on a human runs into the relay's invoke timeout and the agent
// only sees "Host response timeout". One dialog at a time, however often the
// agent retries.
let loginDialogOpen = false;
const promptSignIn = (session: InstanceType<typeof SessionStore>): void => {
  if (loginDialogOpen) return;
  loginDialogOpen = true;
  void session.ensureSignedIn().finally(() => (loginDialogOpen = false));
};
const SIGN_IN_NEEDED =
  'The user is not signed in. A login dialog was opened in their browser - ask them to sign in, then call this tool again.';

const isSignedIn = async (session: InstanceType<typeof SessionStore>): Promise<boolean> => {
  if (session.status() === 'idle') {
    await session.load();
  }
  return !!session.userName();
};

// Angular infers `execute`'s args from a const JSON schema, which doesn't work
// for a heterogeneous list of tools; this types the args explicitly instead.
type ToolSchema = WebMcpToolDescriptor<any>['inputSchema']; // eslint-disable-line @typescript-eslint/no-explicit-any
const defineTool = <Input>(tool: {
  name: string;
  description: string;
  inputSchema: ToolSchema;
  execute: (input: Input) => unknown;
}): WebMcpToolDescriptor<any> => ({ ...tool, execute: (args: unknown) => tool.execute(args as Input) }); // eslint-disable-line @typescript-eslint/no-explicit-any

export const webMcpTools = [
  defineTool({
    name: 'search_products',
    description:
      'Searches the product catalog. Every word in `query` must match the title, category or description. ' +
      'Call without a query to list all products. Returns sku, title, price, stock, available sizes and colors.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search words, e.g. "waterproof running shoe".' },
        category: { type: 'string', enum: [...CATEGORIES] },
        locale: localeProperty,
      },
    } as const,
    execute: async (input: { query?: string; category?: string; locale?: string }) => {
      const params: Record<string, string> = { locale: resolveLocale(input.locale) };
      if (input.query) params['q'] = input.query;
      if (input.category) params['category'] = input.category;
      return text(await firstValueFrom(inject(HttpClient).get('/api/products', { params })));
    },
  }),
  defineTool({
    name: 'get_product',
    description:
      'Returns full details for one product: description, price, stock and the valid sizes and colors ' +
      'that add_to_cart accepts.',
    inputSchema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'Product SKU from search_products.' },
        locale: localeProperty,
      },
      required: ['sku'],
    } as const,
    execute: async (input: { sku: string; locale?: string }) => {
      try {
        const params = { locale: resolveLocale(input.locale) };
        return text(await firstValueFrom(inject(HttpClient).get(`/api/products/${encodeURIComponent(input.sku)}`, { params })));
      } catch (err) {
        return failure(err instanceof HttpErrorResponse && err.status === 404 ? `Unknown sku "${input.sku}".` : 'Could not load the product.');
      }
    },
  }),
  defineTool({
    name: 'add_to_cart',
    description:
      'Adds a product to the shopping cart. size and color must be one of the values returned by get_product. ' +
      'If the user is not signed in, a login dialog opens in their browser and this call returns an error: ' +
      'ask the user to sign in, then call it again. Does not check out.',
    inputSchema: {
      type: 'object',
      properties: {
        sku: { type: 'string' },
        size: { type: 'string' },
        color: { type: 'string' },
        quantity: { type: 'integer', minimum: 1, maximum: MAX_QUANTITY },
        locale: localeProperty,
      },
      required: ['sku', 'size', 'color', 'quantity'],
    } as const,
    execute: async (input: { sku: string; size: string; color: string; quantity: number; locale?: string }) => {
      const cart = inject(CartStore);
      const session = inject(SessionStore);
      const request = { ...input, locale: resolveLocale(input.locale) };
      if (!(await isSignedIn(session))) {
        promptSignIn(session);
        return failure(SIGN_IN_NEEDED);
      }
      try {
        await cart.add(request);
      } catch (err) {
        // 401: the session expired (or the server restarted) since we last looked.
        if (err instanceof HttpErrorResponse && err.status === 401) {
          session.markSignedOut();
          promptSignIn(session);
          return failure(SIGN_IN_NEEDED);
        }
        const reason = err instanceof HttpErrorResponse ? err.statusText || `HTTP ${err.status}` : 'unknown error';
        return failure(`Could not add to cart: ${reason}. Check sku, size and color with get_product.`);
      }
      return text({ added: input, lines: cart.lines(), total: cart.total() });
    },
  }),
  defineTool({
    name: 'view_cart',
    description:
      'Returns the current shopping cart: line items (sku, size, color, quantity, title, unit price) and the total.',
    inputSchema: { type: 'object', properties: { locale: localeProperty } } as const,
    execute: async (input: { locale?: string }) => {
      const cart = inject(CartStore);
      await cart.load(resolveLocale(input.locale));
      return text({ lines: cart.lines(), total: cart.total() });
    },
  }),
  defineTool({
    name: 'go_to_checkout',
    description:
      'Opens the checkout page in the user\'s browser so they can review the order. This does NOT place the ' +
      'order: there is deliberately no tool for that, and the user presses "Place order" themselves. ' +
      'Tell the user the cart is ready for their review.',
    inputSchema: { type: 'object', properties: { locale: localeProperty } } as const,
    execute: async (input: { locale?: string }) => {
      const cart = inject(CartStore);
      const router = inject(Router);
      const locale = resolveLocale(input.locale);
      await cart.load(locale);
      if (cart.lines().length === 0) {
        return failure('The cart is empty (or the user is not signed in). Add products first.');
      }
      await router.navigate(['/', locale, 'checkout']);
      return text({
        navigatedTo: `/${locale}/checkout`,
        lines: cart.lines(),
        total: cart.total(),
        next: 'The user reviews the order and places it themselves.',
      });
    },
  }),
];
