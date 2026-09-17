# analog-ecom-ws — overall goals & design (v0.8, in progress)

Status: **scaffolding underway.** Design approved (v0.7); a first
autonomous implementation pass built the workspace, i18n, layout, landing,
product list/detail, and the markdown-negotiation/llms.txt/sitemap
pieces — see §17 for exactly what's built, what's verified, and what's
still open. Flag anything that looks wrong; the "Open questions" section
lists what's still genuinely undecided.

## 1. What this is

A small, deliberately non-fancy storefront demo built to showcase recent
framework features, used together the way a real project would:

- **AnalogJS i18n** (runtime `$localize`-based i18n, shipped since v2.5,
  present in the v2.7.2 target version) — path-prefixed locales, SSR-time
  locale detection, `provideI18n()`, locale-aware content collections.
- **AnalogJS's newer server/rendering features** — `.server.ts` load
  functions with Zod-validated data, `defineApiRoute`/`defineServerRoute`
  Standard-Schema validation, OG image generation, and (as a stretch/flex,
  see §10) experimental streaming SSR with `@defer`.
- **Modern Angular authoring**: standalone components, `OnPush` everywhere,
  `@defer` for below-the-fold content, a single layout component with its
  template and styles co-located in the `.ts` file (no separate
  `.html`/`.css` files for it).
- **NgRx Signals** — `signalState`/`signal` for whatever page-local UI state
  actually comes up; no `signalStore` in v1, see §8.
- **spartan.ng** as the component layer — the brain/helm (headless primitive
  + copy-owned Tailwind styling) pattern, plus its **skill** and **MCP
  server** used during *our own* development.

The storefront itself is the demo vehicle, not the point: a landing page, a
product list, and a product detail page, in German and English, backed by
product data that lives as **markdown-with-frontmatter objects in S3** rather
than a database. The deeper point — carried over from the ASO / "serving
markdown to agents" thinking in the `ecom-piraten-agentic-commerce` posts — is
to show the same product content served two ways from the same URL: rendered
HTML for a browser, raw markdown for an agent, both derived from one
source-of-truth markdown file instead of one being scraped/converted from the
other. Structured data (JSON-LD, OG images, sitemap, `llms.txt`) rounds this
out: the same product record drives the human-facing page, the agent-facing
markdown, *and* the machine-readable metadata around it.

## 2. Non-goals

- No cart, checkout, payment, or auth. This is a read-only catalog demo.
- No real persistence layer. S3(Mock) is the only store; there is no
  database. Data is expected to be ephemeral and reseeded on demand.
- No production security/perf hardening. It's a showcase, not a product.
- **No search/filter feature at all.** With a 6-product catalog there's
  nothing to search — the list page just lists everything.
- Not testing spartan's `spartan/stack` (Supabase/tRPC/Drizzle) — out of
  scope; we only need the component layer.
- **No automated testing.** No unit tests, no e2e suite, no e2e app for
  `storefront` or `product-ingest`. Verification is manual — run it, click
  through it, `curl` the negotiation/sitemap/OG endpoints (§9, §11). If any
  Nx generator scaffolds an `-e2e` project by default (Playwright/Cypress),
  skip that flag or delete the generated app rather than let it sit unused.

## 3. Tech stack

| Layer | Choice |
|---|---|
| Monorepo | Nx workspace (this repo, already scaffolded, currently empty) |
| Frontend meta-framework | AnalogJS **v2.7.2** (Angular, Vite, Nitro/h3) |
| Component library | **spartan.ng** — `spartan/ui/brain` + `spartan/ui/helm`, Tailwind CSS |
| State management | **`@ngrx/signals`** — `signalState` (+ `rxMethod` for the debounced filter) for page-local state; plain `signal` where even that's overkill. No `signalStore` in v1 — nothing here is shared across pages/components enough to need one |
| Schema/validation | **Zod** (3.24+, Standard Schema) — one schema set in `libs/product-schema`, reused by the ingest CLI, `.server.ts` load functions, and `defineApiRoute` handlers |
| i18n | AnalogJS native i18n (`@angular/localize`, `analog()` plugin `i18n` option, `provideI18n`, `[locale]` route segment) |
| Product data store | S3-compatible object storage — **Adobe `s3mock`** via docker-compose, ephemeral |
| Ingest tool | Small **NestJS CLI app** in the same Nx workspace, one-shot seed command |
| Content format | Markdown + YAML frontmatter, one file per product per locale |

## 4. Workspace layout (proposed)

```
apps/
  storefront/            AnalogJS app (landing, product list, product detail)
  product-ingest/        NestJS CLI ("nest-commander"), seeds S3Mock

libs/
  product-schema/        Shared Zod schema + TS types for the frontmatter
                          contract — imported by the ingest CLI, storefront
                          .server.ts load functions, and any defineApiRoute
                          handlers, so ingest/read/validate can't drift.
  s3-client/              Thin wrapper around @aws-sdk/client-s3 pointed at
                          S3Mock (shared config: endpoint, bucket, path-style
                          addressing), used by both apps.

docker-compose.yml       s3mock service, root of the workspace
```

`apps/storefront/src/server/lib/wants-markdown.ts` (or similar): the
UA/Accept-header detection function used by both the negotiation middleware
and the `.md` sibling route (§9). Lives inside the app, not `libs/` — it's
isolated as its own small module so it *could* be lifted out later, but
isn't promoted to a shared library until there's a second real consumer
(see §9's "use before reuse" note).

No `storefront-e2e`/`product-ingest-e2e` apps — see the testing non-goal in
§2; generate without the e2e flag, or delete it if a generator adds one
unasked.

Open naming point: exact Nx generators/preset to use for `storefront` (the
`setup-analog` skill available in this session follows the dev.to
Nx-without-dotnet tutorial pattern) and for `product-ingest` (Nx's `@nx/nest`
generator, plus `nest-commander` for the CLI command surface). We'll pick
exact generator invocations when we start scaffolding.

## 5. Product content model

**Why runtime rendering, not AnalogJS content collections:** AnalogJS's
native content pipeline (`injectContent`, `injectContentFiles`, and the
locale-aware `withLocale()` addition to `provideContent()`) is designed
around markdown files sitting in `src/content` at *build* time. Piping S3
data through that pipeline would mean syncing S3 → local files before every
build — at which point "ephemeral S3-backed data" stops being true; it'd just
be a seeding detour. Instead:

- The **landing page** (static marketing copy, not product data) can use
  Analog's native content collections normally — it's a good showcase of
  that feature on its own.
- **Product list and detail pages** get their data through AnalogJS's native
  `.server.ts` **load function** convention (`injectLoad<typeof load>()`),
  which already *is* the idiomatic "fetch on the server before rendering"
  mechanism — no need to invent a bespoke API route just for page data. The
  load function calls one shared function — `getProduct(sku, locale)` /
  `listProducts(locale)` in `libs/s3-client` — that fetches the object(s)
  from S3, parses frontmatter with `gray-matter`, renders the body with a
  markdown-to-HTML step (e.g. `marked`), and validates the result against
  `libs/product-schema`'s Zod schema with `safeParse` (falling back to a
  safe empty result rather than throwing, per Analog's own load-function
  guidance).
- That same shared fetch/parse function is reused verbatim by the
  agent-content-negotiation middleware (§9) and by `defineApiRoute` handlers
  where needed (e.g. the OG image route, §11) — one function, three
  consumers, no drift between what a browser, an agent, and an OG image
  renderer each see.

### S3 object layout

One object per product per locale, so each language version is a complete,
independently-fetchable markdown document (mirrors the "authored markdown per
language" idea rather than a translated-at-render-time single file):

```
s3://products/<sku>/en.md
s3://products/<sku>/de.md
```

### Frontmatter contract (`libs/product-schema`)

```yaml
---
sku: "TS-BLK-001"
title: "Classic Crew Tee"       # product name, localized per file
price: 29.90
currency: "EUR"                 # always EUR, even on the en/ files (see §7)
stock: 42
sizes: ["S", "M", "L", "XL"]
colors: ["black", "charcoal"]
category: "apparel/shirts"
locale: "en"                    # matches the filename, kept for validation
images: ["/images/products/ts-blk-001.jpg"]
updatedAt: "2026-09-01T00:00:00Z"
---

# Classic Crew Tee

A short, honest product description. Headline, then a paragraph or two.
Written directly in markdown — this **is** the source of truth, not a CMS
export or an HTML page reverse-engineered back into markdown.
```

`libs/product-schema` exports a Zod schema validating this shape. It is used
in three places with the exact same object: the ingest CLI (before writing
to S3), the storefront's `.server.ts` load functions (after reading from
S3), and — since Zod 3.24+ is a Standard Schema — directly as the
`params`/`query`/`output` schema on any `defineApiRoute`/`defineServerRoute`
handler that touches product data, so validation logic is never duplicated
by hand.

**Images: filesystem, not S3.** Decided: product images live as static
assets in `apps/storefront/public/images/products/` and frontmatter just
references the path (`/images/products/<sku>.jpg`) — not uploaded to
S3Mock alongside the markdown. S3 stays scoped to what this demo is actually
about (ephemeral, agent-legible product *data*); images are a fixed, curated
set of demo assets, and shipping them through the app's own static file
serving is the simplest thing that works. A real storefront would put
images on a CDN in front of object storage — noted here as the obvious next
step, deliberately out of scope for a demo.

## 6. Ingest CLI (`apps/product-ingest`)

A small NestJS command-line app (`nest-commander`), run manually for demo
purposes — not a long-running service:

- `nx run product-ingest:seed` — generates a small, fixed set of sample
  products (**6 products across 2 categories**, e.g. 3 shirts + 3
  shoes) with EN+DE markdown bodies and pushes them to the `products`
  bucket in S3Mock, creating the bucket if needed. Small on purpose: enough
  to show a list page and category variety, not enough to need pagination
  or real search (see §2, §8).
- `nx run product-ingest:clear` — empties the bucket, useful since storage is
  ephemeral by design and the whole point is "reseed and move on."
- **Fixture data is hand-authored, by us, once** — titles, EN+DE
  descriptions, SKUs, prices — checked into `apps/product-ingest` as plain
  fixture files/objects. No external product feed, no LLM-generation step
  at ingest time; it's a demo catalog, not a real one.
- **Placeholder images, generated by us too.** Since there's no real product
  photography, a tiny one-off script generates simple SVG placeholders (a
  flat color per category + the product title as text) into
  `apps/storefront/public/images/products/<sku>.svg`, derived from the same
  fixture data so titles/SKUs stay in sync with the markdown. No stock
  photos, no licensing question, no extra runtime dependency — see the
  filesystem-images decision in §5.

## 7. i18n design

Following AnalogJS's native i18n feature:

- **Locales:** `en` (default), `de`.
- **Routing:** path-prefixed via a `[locale]` route segment —
  `/en/products/ts-blk-001`, `/de/products/ts-blk-001` — configured via the
  `analog()` Vite plugin's `i18n: { defaultLocale, locales }` option, matching
  the documented pattern (this is also what unlocks automatic per-locale
  prerender expansion, correct `lang` attribute, and hreflang generation for
  routes that *are* prerenderable, i.e. the landing page).
- **UI chrome** (nav, buttons, labels): `$localize`-tagged templates via
  `provideI18n()` with a JSON loader per locale, extracted with the
  `extract` config (JSON format) once there's real content to extract.
- **Product content:** not run through Analog's `$localize`/content-locale
  machinery at all (see §5) — the locale is resolved from the URL segment,
  and that locale directly selects which S3 object (`en.md` vs `de.md`) to
  fetch. Simpler and consistent with "product content is data, not UI
  string catalog."
- **Locale switcher:** `injectSwitchLocale()`, surfaced once, in the shared
  layout's header (§8) rather than duplicated per page; accept the
  documented caveat that switching triggers a full navigation rather than
  in-place re-render.
- **Guard note:** Analog's `[locale]` segment doesn't itself reject
  unsupported locales — add a small guard/redirect for anything outside
  `en`/`de`.
- **Currency:** fixed to EUR for both locales — it's a demo, not a
  real market-specific storefront, so there's no reason to invent a second
  currency/exchange rate. Still worth the one cheap touch of running the
  fixed EUR amount through `Intl.NumberFormat(locale, { style: 'currency',
  currency: 'EUR' })` so `en` renders `€29.90` and `de` renders `29,90 €` —
  same value, locale-correct formatting, no fake conversion.

## 8. UI architecture: layout, state, change detection

### Central layout

One `AppLayoutComponent` wraps every `[locale]` route: header (logo, nav,
locale switcher via `injectSwitchLocale()`) + `<router-outlet>` + footer
(links, and a small nod to the agent-facing side of this demo — e.g. a
footer link to `llms.txt` if we add one, see §9). Per your ask, this
component's template and styles live **inline in the `.ts` file**
(`template:`/`styles:` fields) rather than as separate `.html`/`.css`
files — it's the one shell component, so co-location keeps it in one place
instead of three.

### Change detection & deferred rendering

- Every component is `standalone` with `changeDetection:
  ChangeDetectionStrategy.OnPush` — no exceptions, this is Angular's
  recommended default now and Analog scaffolds it that way already.
- `@defer` blocks for anything below the fold or non-critical to first
  paint: on the landing page, hero content renders eagerly, secondary
  sections (`@defer (on viewport)`); on the product detail page, the
  description body can render eagerly (it's the actual product-page-ness of
  the page) while a "related products" strip defers `on viewport`. This is
  also what pairs directly with streaming SSR's `hydrate on` triggers if we
  turn that on (§10) — same `@defer` blocks, an extra `hydrate` clause.

### State: `signalState` (+ `rxMethod`), not `signalStore` — except breadcrumbs

Decided: `signalStore` is out of scope for v1 for page-local state — it's
built for shared state injected across multiple components, and most state
here isn't actually shared. `signalState` gives the same immutable-update
ergonomics (`patchState`) for state that's scoped to a single page
component, which is all we need there:

**Exception: breadcrumbs.** The breadcrumb trail genuinely is cross-component
— `AppLayoutComponent` renders it, but only the active leaf page (products
list, product detail) knows what it should say — so it's the one piece of
state that fits `signalStore`'s actual purpose. `BreadcrumbStore`
(`providedIn: 'root'`, `apps/storefront/src/app/stores/breadcrumb.store.ts`)
holds just `trail: BreadcrumbItem[]`; each page sets it in its constructor
(product detail via an `effect()`, since client-side nav between two `[sku]`
routes reuses the component instance and needs to follow the newly loaded
product), and the landing page clears it. No `TransferState` involved — the
trail is derived synchronously from data the page component already has
(route params, the already-loaded product), nothing async to replay across
hydration.

- **Product detail page:** primary data comes straight from
  `injectLoad<typeof load>()` — no `signalState` needed for that. If there's
  any page-local UI bit (e.g. a "copy SKU" confirmation flash, an image
  gallery's selected index), a plain `signal()` covers it; `signalState`
  only if that grows into more than one or two related fields.
- **Landing page:** no state beyond content-collection data and maybe one
  `signal()` (e.g. whether a promo banner is dismissed).
- **Product list page:** with search/filtering cut from scope (§2 — a
  6-product catalog doesn't need it), the list page just renders whatever
  its `.server.ts` load function returns. No `signalState` needed here
  either; a plain `signal()` at most, if we end up wanting something
  trivial like a grid/list view toggle.
- No global app-wide state of any kind — there's no cross-page shared state
  that needs one (no cart, no auth).

**Accepted tradeoff:** cutting search means `rxMethod`/rxjs-integration —
originally on the tech-showcase wishlist alongside `signalStore`/
`signalState` — has no natural home in v1; every remaining data fetch is a
plain SSR load function with nothing to debounce. Decided: not adding it
back just to tick that box. `rxMethod` is out of scope for this demo.

## 9. Serving markdown to agents (the ASO showcase)

This is the direct carry-over from the two linked posts
([SEO→ASO](../ecom-piraten-agentic-commerce/src/content/blog/seo-aeo-geo-aso.md),
[serving markdown to agents](../ecom-piraten-agentic-commerce/src/content/blog/serving-markdown-to-agents.md)),
reapplied to product pages instead of blog posts. Decision: demo **both**
techniques on the product detail route, since the page is already dynamic
(server-fetching from S3) so content negotiation is nearly free here — unlike
a normally-static blog where it costs opting a route out of prerendering.

- **Content negotiation, same URL** (`/​<locale>/products/<sku>`): an Analog
  middleware/server-route checks `Accept: text/markdown` first — that path
  is UA-agnostic and is the primary way to demo this with `curl -H
  "Accept: text/markdown"` using whatever tool/agent name you like. On top
  of that, a small, deliberately minimal illustrative UA pattern list
  (GPTBot, ClaudeBot, PerplexityBot — same idea as the existing
  `wantsMarkdown()` check) is kept just to show the pattern also works via
  `curl -A "GPTBot/1.0"`; not trying to maintain an exhaustive/current bot
  list; the `Accept`-header path is what actually matters for the demo. If
  matched, return the raw fetched-from-S3 markdown (frontmatter + body) with
  `content-type: text/markdown`. Otherwise let the request fall through to
  the normal Angular route (which uses the same shared fetch function via
  its `.server.ts` load function, per §5).
- **Static-shaped sibling route** (`/<locale>/products/<sku>.md`): always
  returns the same raw markdown regardless of headers, for agents that just
  try appending `.md` (or that follow a `<link rel="alternate"
  type="text/markdown">` tag we add to the rendered page's `<head>`).
  "Static-shaped" because the *route* is fixed, even though the content
  behind it is fetched live from S3, not prebuilt.
- Both paths — negotiation middleware and `.md` sibling route — call the
  exact same `getProduct(sku, locale)` function the page's load function
  calls (§5). No HTML-to-markdown conversion at request time anywhere (the
  anti-pattern called out in the reference posts) — markdown is always the
  source, HTML is always derived from it, never the reverse.
- **`llms.txt` for the catalog — in scope for v1.** A `server/routes/
  llms.txt.ts` route, generated at request time (same "can't be
  build-time" reasoning as the product routes themselves — the catalog is
  ephemeral S3 data). Format follows the same compact-index convention
  Analog's own doc site uses: a short site description, then one line per
  page. Content: the landing page, plus one entry per product per locale,
  each linking straight to the `.md` sibling route (§9) rather than the
  HTML page — the whole point of `llms.txt` is handing an agent the
  markdown entry point directly instead of making it discover content
  negotiation on its own. Built from the same shared `listProducts()`
  function as everything else, so it can never drift out of sync with the
  actual catalog.

**Scope decision — h3-only, not framework-portable, not extracted yet.**
This project targets AnalogJS/h3 exclusively; the negotiation logic doesn't
need to work outside that (no attempt to make it Astro- or
Nuxt-compatible, even though the underlying idea — the `wantsMarkdown()`
check from the Astro middleware — is the same one). It stays living in this
workspace as **one clearly separated module** (the UA/Accept detection
function, kept isolated from route-handling glue) rather than being
extracted into its own package now — "use before reuse": we have exactly one
real usage in this project so far, wire it up cleanly, don't build a
plugin/adapter abstraction speculatively. Revisit packaging it standalone
only once there's an actual second consumer.

## 10. Streaming SSR (experimental, stretch)

AnalogJS 2.7.2's `experimental.streaming` option progressively flushes the
response as `@defer` blocks resolve, instead of buffering the whole document.
Worth trying, with eyes open about the constraints:

```typescript
// vite.config.ts
analog({ experimental: { streaming: true } })
```

```typescript
// src/main.server.ts
import { renderStream } from '@analogjs/router/server';
export default renderStream(AppComponent, config);
```

- **Requires Angular 21+** and builds on incremental hydration
  (`provideClientHydration(withIncrementalHydration())` on Angular 21;
  default-on from Angular 22). **Checked:** `@analogjs/vite-plugin-angular`
  2.7.2 declares its Angular-tooling peer range as `@angular/build`/
  `@angular-devkit/build-angular` `^18 || ^19 || ^20 || ^21 || ^22` — i.e.
  AnalogJS 2.7.2 doesn't pin a specific Angular version, it supports a
  range up through 22, and current `@angular/core` latest is `22.1.6`. So
  scaffolding fresh naturally lands on Angular 22 (incremental hydration
  on by default) and streaming SSR's "21+" requirement is satisfied without
  any special pinning. No longer an open question.
- Pairs directly with the `@defer` usage in §8: `@defer (hydrate on
  viewport)` around "related products" on the detail page is a natural
  place to demonstrate it — streams in, hydrates only once visible.
- **Reassuring detail for the structured-data/SEO plan in §11:** the
  document `<head>` streams immediately, and "search engine crawlers
  receive fully buffered renders with complete head information" — so
  turning streaming on doesn't put JSON-LD/OG/meta tags at risk of being
  cut off for anything that matters for discoverability. Route metadata and
  any JSON-LD we inject still need to be resolved *before* the head is
  written (i.e., in the `.server.ts` load function or route metadata, not
  in something deferred), which is already how we're structuring it.
- Can be opted out per-route via `nitro.routeRules['/some-route'] =
  { streaming: false }` if it turns out to fight with something — cheap
  to try, cheap to back out of.
- Given it's explicitly experimental, treat this as a **stretch goal** to
  demo once the core pages work with plain SSR, not a v1 blocker.

## 11. Structured data: JSON-LD, sitemap, Open Graph

Three related but distinct pieces of "machine-readable metadata around the
page," each with a different native-support story in Analog:

### Open Graph images — native support

Analog ships this directly: `ImageResponse` from `@analogjs/content/og` (on
top of `satori` + `satori-html` + `sharp`) renders an HTML/Tailwind template
to a PNG at request time in a normal API route. Plan: `server/routes/api/og/
products/[sku].ts`, `query` schema (`sku`, `locale`) validated the same
Standard-Schema/Zod way as everything else, template showing product title +
price + a product image if available. Wired into the product detail page's
`routeMeta.meta` as `og:image`/`twitter:image` pointing at that route with
the right query params — a genuine "auto-generated OG image per product"
rather than one static share image for the whole site.

### Meta tags / Open Graph text fields — native support

`routeMeta.meta` (the `RouteMeta` type) directly supports `og:title`,
`og:description`, `og:image` alongside standard meta tags, set per route —
already covers the non-image OG fields with no extra plumbing.

### JSON-LD — not natively supported, needs a small custom piece

Analog's route metadata explicitly stops at meta/OG tags; there's no
built-in JSON-LD/structured-data feature. Plan: a small shared
function/service that builds a schema.org `Product` object (name, sku,
image, `offers: { price, priceCurrency, availability }` derived from
`stock`) from the same validated product data the page already has, and
injects it as a `<script type="application/ld+json">` — via `afterNextRender`
+ `DOCUMENT`/`Renderer2`, resolved synchronously from load-function data so
it's present in the buffered head Analog sends to crawlers (see the
streaming caveat in §10). Scope for v1: `Product` schema on the detail page
only; `BreadcrumbList`/`ItemList` on the product list page is a nice-to-have,
not required.

### Sitemap — native feature, but needs a dynamic route to actually cover products

Analog's built-in sitemap generation hangs off `prerender.sitemap.host` and
the routes Analog already knows about at build time (plus i18n hreflang
alternates). That covers the landing page fine, but **product routes aren't
known at build time** — they live in ephemeral S3, which is the whole
premise. So: keep the native sitemap for prerendered routes, and add a
`server/routes/sitemap-products.xml.ts` (or fold both into one hand-rolled
`sitemap.xml` route) that lists the current bucket contents at request time
and emits `<url>` entries with `<xhtml:link rel="alternate" hreflang="...">`
per locale, mirroring what the native feature does for static routes. Same
shared `listProducts()` function as everywhere else.

## 12. spartan.ng usage, and setting up both frameworks' AI tooling

- Standard brain+helm flow: `npx nx g @spartan-ng/cli:ui <component>` (or
  equivalent) to copy in the primitives we need — button, badge, card-ish
  layout primitives, select (locale switcher), maybe breadcrumb. Own and
  edit the generated Tailwind classes directly, per spartan's model.
- **Meta layer:** this repo is also meant to be evidence of *using* each
  framework's own AI-agent tooling to build it, not just the shipped
  storefront. Concrete setup for both, once dependencies are installed:

### spartan.ng — skill + MCP server

1. **Skill:** `npx skills add spartan-ng/spartan` (project-scoped by
   default; add `-g` to install globally instead). For Claude Code this
   copies procedural knowledge of spartan's CLI/components/conventions into
   `.claude/skills/spartan`. It activates automatically on any project with
   a `components.json` file — i.e. once `spartan`'s own `init` generator has
   run — so run that first, then add the skill.
2. **MCP server:** add a project-scoped `.mcp.json` at the workspace root
   (checked in, so it applies for anyone working in this repo) so Claude
   Code has live component/docs/block lookups instead of guessing APIs:
   ```json
   {
     "mcpServers": {
       "spartan-ui": {
         "command": "npx",
         "args": ["-y", "@spartan-ng/mcp"]
       }
     }
   }
   ```
   (A global install + `spartan-mcp` binary is the documented alternative
   if repeated `npx` cold-starts get annoying.)

### AnalogJS — AGENTS.md + Agent Plugins manifest

- `@analogjs/platform` ships `node_modules/@analogjs/platform/AGENTS.md`
  and a `node_modules/@analogjs/platform/plugin.json` (an "Agent Plugins
  v1.0.0" manifest) automatically once the dependency is installed — no
  setup step for the `AGENTS.md` half; a generated Analog project's root
  `AGENTS.md` just points at the platform copy, and Analog's own docs note
  "the `AGENTS.md` pointer keeps working with no setup either way," so it
  stays in sync with whatever Analog version is actually installed rather
  than going stale as a copied-in file.
- The `plugin.json` (Agent Plugins v1.0.0) side is a different story: that
  spec doesn't get auto-discovered from `node_modules` by a client — it
  needs the plugin root (`node_modules/@analogjs/platform`) registered
  explicitly with whatever tool supports the spec. Whether Claude Code
  itself supports Agent Plugins v1.0.0 registration (as opposed to its own
  `.claude/skills` convention) is genuinely unverified — worth checking
  against Claude Code's actual plugin docs when we get here, rather than
  assuming it just works. The `AGENTS.md` half needs nothing and already
  works regardless.
- No MCP server on Analog's side (as of now) — the framework-level
  counterpart to spartan's interactive skill+MCP approach is purely
  machine-readable docs (`llms.txt`/`llms-full.txt`, per-page `.md`) plus
  the in-repo `AGENTS.md`/`plugin.json` guidance above.

## 13. Pages / routes (v1 scope)

```
/                                  → redirect to /<defaultLocale>
/<locale>                          → landing page (static content collection, layout-wrapped)
/<locale>/products                 → product list (SSR load fn, no filter/search — 6-item catalog)
/<locale>/products/<sku>               → product detail (SSR load fn + content negotiation + JSON-LD)
/<locale>/products/<sku>.md            → markdown sibling (always raw markdown)
/api/og/products/[sku]             → OG image (ImageResponse), ?locale= query
/sitemap.xml                       → native (static routes) — or folded into the custom one below
/sitemap-products.xml              → custom, request-time, lists current S3 catalog
/llms.txt                          → custom, request-time, compact index → product .md sibling routes
```

## 14. Local infra

`docker-compose.yml` at the workspace root:

```yaml
services:
  s3mock:
    image: adobe/s3mock:latest
    environment:
      - COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS=products
    ports:
      - "9090:9090"
```

**Corrected during implementation:** the env var is
`COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS`, not the plain
`INITIAL_BUCKETS` originally sketched here — that name was deprecated as
of S3Mock 4.5.0. Verified against the actual container: with the old name
the bucket silently never gets created (empty `ListAllMyBucketsResult`,
no error) — worth knowing since it fails quiet, not loud.

Storefront and ingest CLI both point at `http://localhost:9090`, path-style
addressing, via the shared `s3-client` lib's config (env vars, not hardcoded,
so CI or a differently-ported local run isn't broken).

## 15. Suggested build order

1. Scaffold Nx workspace apps: `storefront` (AnalogJS v2.7.2), `product-ingest` (NestJS).
2. `libs/product-schema` (Zod) + `libs/s3-client`, docker-compose s3mock.
3. Ingest CLI `seed` command — get sample EN/DE product markdown into S3Mock and confirm objects are readable by hand (`aws s3 --endpoint-url ...` or the SDK).
4. Storefront: `AppLayoutComponent` (inline template/styles, header/footer, locale switcher) + i18n wiring (`[locale]` segment, `provideI18n`, sample translated UI strings) + landing page (native content collection).
5. Product list page: `.server.ts` load function, spartan components for layout/cards. No filter/search (see §2, §8).
6. Product detail page: `.server.ts` load function, JSON-LD injection, `routeMeta` OG/meta tags.
7. Content negotiation middleware + `.md` sibling route on product detail; verify with `curl -H "Accept: text/markdown"` and `curl -A "GPTBot/1.0"` against the same URL.
8. OG image API route (`ImageResponse`) + wire into `routeMeta`; custom `sitemap-products.xml` route; `llms.txt` route.
9. Stretch: flip on experimental streaming SSR + `@defer (hydrate on viewport)` for a below-the-fold block; verify crawler-facing head output is unaffected.
10. Polish pass: README documenting how to run the whole thing (`docker compose up`, seed, dev server, curl examples for negotiation/sitemap/OG/llms.txt).

## 16. Open questions

None — all resolved: currency fixed EUR (§7); AI UA list minimal/
illustrative with `Accept` header as the primary path (§9); catalog fixed
at 6 products / 2 categories with hand-authored fixtures and generated
placeholder images (§6); Angular version satisfied by scaffolding fresh,
no pinning needed (§10); JSON-LD scoped to the product detail page only
(§11); `llms.txt` in scope for v1 (§9); `rxMethod`/search out of scope,
accepted tradeoff (§8).

## 17. Implementation status (as of this build session)

**Built and verified** (production build + manual `curl` checks against
a real running S3Mock, not just typechecked):

- Workspace: `apps/storefront` (AnalogJS 2.7.2, Angular 22.1.x — auto-
  satisfies streaming SSR's 21+ requirement), `apps/product-ingest`
  (NestJS + `nest-commander`), `libs/product-schema` (Zod), `libs/
  s3-client`. No `-e2e` apps, per the testing non-goal.
- `docker-compose.yml` + `nx run product-ingest:seed`/`:clear` — 6
  hand-authored products (3 shirts, 3 shoes), EN+DE, plus generated SVG
  placeholders in `apps/storefront/public/images/products/`.
- i18n: `[locale]` route segment, `provideI18n`, `injectSwitchLocale`,
  hand-authored `en.json`/`de.json` UI strings. `/`, `/en`, `/de` all
  verified rendering the correct language.
- `AppLayoutComponent` — inline template/styles, `OnPush`, header/nav/
  locale-switcher/footer.
- Landing, product list (with the category-link filter, not a search
  feature — see §8), and product detail pages, all `OnPush`, all backed
  by `.server.ts` load functions hitting S3 at request time. One `@defer
  (on viewport)` block on the landing page.
- JSON-LD `Product` schema on the detail page.
- Content negotiation + `.md` sibling route, `llms.txt`, and
  `sitemap-products.xml` — all working, all verified with `curl`
  (`Accept: text/markdown`, `-A "GPTBot/1.0"`, and the `.md` URL all
  return identical raw markdown; plain requests still get rendered HTML).

**Not yet built:**

- OG image generation (`ImageResponse`/satori) — §11's plan stands,
  just not implemented yet.
- Streaming SSR (§10) — still explicitly a stretch goal, not attempted.
- README / run instructions for a fresh clone.

**Real gotchas hit during the build** (beyond the S3Mock env var fix in
§14), worth knowing before touching this code:

- **Nx `workspaceLayout` must be set *before* generating.** Without it,
  Nx's current default `appsDir` is `.` (workspace root), and Analog's
  generator happily scaffolds there instead of under `apps/`. Hit this
  firsthand; fixed by setting `workspaceLayout` in `nx.json` first and
  regenerating rather than moving files by hand. Folded into the
  `setup-analog` skill.
- **`vite-tsconfig-paths` didn't resolve the workspace libs** in this
  app's SSR module runner, despite the `extends` chain in `tsconfig.json`
  being correct. Fixed with explicit `resolve.alias` entries in
  `vite.config.ts` for `@analog-ecom-ws/product-schema` and
  `@analog-ecom-ws/s3-client`.
- **Nitro has its own separate module resolution**, entirely apart from
  Vite's. The same two workspace-lib aliases had to be repeated under
  `analog({ nitro: { alias: {...} } })` or `.server.ts` load functions
  and server middleware can't resolve them, even though the page
  components (bundled by Vite, not Nitro) resolve fine.
- **Root-caused and fixed:** the negotiation/`llms.txt`/sitemap
  middleware used to hang indefinitely under `nx serve` (Vite dev
  server), while working fine in a production build. Cause found in
  `@analogjs/vite-plugin-nitro`'s dev-mode middleware runner
  (`register-dev-middleware.js`): it calls each `server/middleware/*.ts`
  handler directly and only inspects the *return value* to decide whether
  to call `next()` — `if (!result) next();` — it never actually writes
  that returned value to the HTTP response. That auto-serialization
  (return a value, framework sends it) only happens in Nitro's real
  production h3 pipeline, not in this dev-mode shim. So `return raw`
  built the right string but nothing ever closed the response, and the
  client waited forever. **Fix:** call h3's `send(event, raw, contentType)`
  explicitly — it writes and ends the response itself, independent of any
  wrapping context — then `return true` (a truthy sentinel) purely so the
  dev-mode wrapper's `if (!result) next()` doesn't also try to continue
  the chain into Angular's SSR renderer on an already-closed response.
  Verified fixed in both `nx serve` and a production build. **Any future
  `server/middleware/*.ts` handler that isn't purely pass-through should
  use `send()` rather than `return`ing a body**, or it will silently hang
  under the dev server the same way.
- **Angular strips literal `<script>` elements from templates** (a
  security default, even static ones with no bindings) — the JSON-LD
  `<script type="application/ld+json">` had to go in via `Renderer2` in
  the component constructor instead (run synchronously, not in an
  `afterRender`/effect hook, so it's guaranteed to happen during SSR too).
- **A page file with both a default-exported component *and*
  `routeMeta.redirectTo`** throws `NG04014` at runtime (Angular rejects a
  route with both `component` and `redirectTo`) — Analog's generated
  route object sets `component` unconditionally regardless of
  `routeMeta`. Fix: don't export a default component from a pure-redirect
  page at all.
- **My own initial `productObjectKey` implementation was wrong** relative
  to this doc's own S3 layout in §5 — it added a redundant `products/`
  prefix *inside* the `products` bucket. Fixed to match §5 exactly
  (`s3://products/<sku>/<locale>.md` = bucket `products`, key
  `<sku>/<locale>.md`); caught by actually inspecting objects in the
  running S3Mock, not just by the code looking plausible.
