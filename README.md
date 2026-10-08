# One URL, two audiences

**A storefront that serves rendered HTML to people and raw markdown to AI
agents, both from the same markdown files.** Built with AnalogJS, Angular
and spartan.ng.

## The idea in 30 seconds

Agents read the web too, but a product page's HTML is mostly hydration
payload, styles and scripts. Most "serve markdown to agents" setups deal
with that by converting HTML back into markdown, or by running a separate
content pipeline. This repo shows that neither is needed if **markdown is
the source of truth from the start**:

```
S3: products/<sku>/<locale>.md  (frontmatter + markdown body)
          │
          ├─→ browser request  → rendered as an Angular page (HTML)
          ├─→ agent request    → returned as-is (raw markdown)
          ├─→ JSON-LD + meta description → built from the same parsed data
          └─→ llms.txt / sitemap → built from the same parsed data
```

One fetch, one parse, several outputs. Nothing is produced by converting
one output into another. Same URL, different `Accept` header:

```sh
curl http://localhost:3000/en/products/TS-BLK-001                             # HTML
curl -H "Accept: text/markdown" http://localhost:3000/en/products/TS-BLK-001  # markdown
```

**What it gets you, measured:**

- **~50x fewer tokens** for an agent: 7,879 → 158 tokens for the same
  product page (GPT-4o tokenizer). See
  [Measured: HTML vs. markdown](#measured-html-vs-markdown-in-tokens).
- **Lighthouse 100/100/100/100, plus 3/3 on the new Agentic Browsing
  category.** That category grades a page for agents rather than people.
  See [Lighthouse](#lighthouse-100100100100-and-33-on-agentic-browsing).

## What's in the box

- **Agent-facing routes:** content negotiation on the product URL, an
  always-markdown `.md` sibling route, `llms.txt`, a live sitemap,
  per-bot-class `robots.txt`, JSON-LD and per-product OG images.
- **A genuinely dynamic catalog:** products are markdown files with YAML
  frontmatter in S3 (mocked locally via
  [Adobe S3Mock](https://github.com/adobe/S3Mock)), fetched at request time
  rather than baked in at build time.
- **Runtime i18n:** every page in English and German under `/en/...` and
  `/de/...`, with one markdown file per product per locale.
- **The stack, used together the way a real project would:** AnalogJS 2.7
  (SSR, `.server.ts` load functions, Nitro/h3 middleware), Angular 22
  (standalone, `OnPush`, zoneless, signals, `@defer`), NgRx Signals, Zod,
  Tailwind v4 with [spartan.ng](https://spartan.ng), and a NestJS ingest
  CLI, all in one Nx workspace.
- **A demo shop on top:** a pseudo login (just a name, in a dialog), a
  server-side session cart, and a checkout that creates an in-memory
  order - all client-only, so the server-rendered pages stay identical for
  every visitor. See [Demo cart, session and checkout](#demo-cart-session-and-checkout).
- **WebMCP, so an agent can act and not only read:** a CLI agent searches the
  catalog, fills the cart and opens checkout in the user's own browser tab;
  the user signs in and places the order. Angular's experimental WebMCP
  support, a polyfill and a local relay - see
  [WebMCP: an agent that can shop](#webmcp-an-agent-that-can-shop).
- **Built with the frameworks' own AI tooling:** spartan's skill and MCP
  server plus AnalogJS's shipped agent guidance. See
  [Built with each framework's own AI tooling](#built-with-each-frameworks-own-ai-tooling).

This is a showcase, not a product: the shop is a demo (no passwords, no
payment, everything in server memory) and there is no real persistence
(see [Non-goals](#non-goals)).

## Quick start

Requires Node.js and Docker.

```sh
npm install
npm start
```

`npm start` runs the whole chain: starts S3Mock via Docker, seeds it with
a demo catalog (6 products, EN+DE), does a production build, and serves
the app at **http://localhost:3000**.

Stop it with Ctrl-C. Tear down S3Mock with `npm run docker:down` when
you're done.

If product pages come up empty, the seed step probably ran before S3Mock
had finished starting (it fails with `ECONNRESET`). Run `npm run seed`
again while the server is running; no restart needed.

`npm start` does a production build and serve; `npm run dev` runs the
Vite dev server (faster reload while editing pages). Both work for
everything below, including the agent-facing routes — but that wasn't
always true, see [Lessons learned](#lessons-learned). `npm start` remains
the closer-to-production path, and is what was used to verify most of this
repo's behavior.

## A guided tour

With the server running on port 3000:

**The storefront itself:**

| URL | What it is |
|---|---|
| `/` | redirects to `/en` |
| `/en`, `/de` | landing page, each language |
| `/en/products`, `/de/products` | product list, with a category filter |
| `/en/products/TS-BLK-001` | a product detail page (add to cart; asks you to sign in first) |
| `/en/cart`, `/en/checkout` | the session cart and checkout (client-only) |

**The agent-facing side — the actual point of this demo.** One product,
HTML for the browser and three ways for an agent to get markdown:

```sh
# A browser gets rendered HTML (the default)
curl http://localhost:3000/en/products/TS-BLK-001

# An agent that asks for markdown gets markdown, same URL
curl -H "Accept: text/markdown" http://localhost:3000/en/products/TS-BLK-001

# So does a known AI crawler user-agent, same URL again
curl -A "GPTBot/1.0" http://localhost:3000/en/products/TS-BLK-001

# Or an agent can just append .md and always get markdown, no headers needed
curl http://localhost:3000/en/products/TS-BLK-001.md
```

All three markdown responses are byte-identical to what's actually stored
in S3 — frontmatter and all. Nothing is converted; it's handed back as-is.

![Same product URL, three ways: an Accept: text/markdown request, a GPTBot user-agent request, and a plain browser request — the first two return identical raw markdown, the last returns rendered HTML](./images/example-requests.webp)

**Machine-readable indexes**, also built from the live catalog:

```sh
curl http://localhost:3000/llms.txt              # compact index → agent entry points
curl http://localhost:3000/sitemap-products.xml  # per-locale sitemap with hreflang alternates
curl http://localhost:3000/robots.txt            # explicit rules per bot class
```

**View source on a product page** and you'll also find a `schema.org`
`Product` JSON-LD block, a `<meta name="description">`, and an `og:image`
pointing at a per-product OG image — all in the `<head>`, all built from
the same parsed product data the page renders:

```sh
curl http://localhost:3000/api/og/products/TS-BLK-001 -o og.png  # 1200x630 PNG, title + price
```

## Measured: HTML vs. markdown, in tokens

"An agent gets markdown instead of HTML" is a claim about token cost, so it
should be measured as one instead of just asserted. `scripts/measure-tokens.mjs`
fetches the same product detail URL both ways from a running instance and
counts tokens with [`gpt-tokenizer`](https://www.npmjs.com/package/gpt-tokenizer)
against two real encodings (`cl100k_base` — GPT-3.5/4 — and `o200k_base` —
GPT-4o and newer). Reproduce it against your own running server:

```sh
npm start                                        # in one terminal (serves :3000)
npm run measure:tokens                           # in another; defaults to http://localhost:3000
npm run measure:tokens -- http://localhost:4200  # against npm run dev instead
```

Measured against a production build (`npm start`), `/products/TS-BLK-001`, both locales:

| Variant | Bytes | Chars | Tokens (cl100k_base) | Tokens (o200k_base / gpt-4o) |
|---|---:|---:|---:|---:|
| en — rendered HTML (raw response) | 29,062 | 29,054 | 7,909 | 7,879 |
| en — HTML, tags stripped (naive scrape) | 494 | 490 | 110 | 110 |
| en — markdown (`.md` route) | 506 | 506 | 156 | 158 |
| de — rendered HTML (raw response) | 29,237 | 29,202 | 8,058 | 7,947 |
| de — HTML, tags stripped (naive scrape) | 546 | 537 | 147 | 127 |
| de — markdown (`.md` route) | 536 | 532 | 181 | 168 |

Two different comparisons worth pulling apart here, because they tell
different stories (figures below use `o200k_base`; `cl100k_base` tells the
same story within a few percent):

- **Raw HTML response vs. markdown response: ~50x fewer tokens** (7,879 →
  158, `en`). This is the honest worst case for an agent that just does
  `fetch()` and hands the body to a model with no extraction step —
  Angular's hydration payload, inlined styles, and script tags are most of
  those 7,879 tokens, and none of it is product information. Content
  negotiation ([Serving markdown to agents](#serving-markdown-to-agents))
  means an agent never has to pay that cost or do that extraction — same
  URL, `Accept: text/markdown`, straight to the 158.
- **HTML with tags stripped (naive scrape) vs. markdown: markdown is
  *larger*** (158 vs. 110 tokens, `en`) — the one place the numbers don't
  favor markdown outright, and worth stating plainly rather than picking
  the comparison that flatters the repo. The reason is what's *in* each:
  the stripped-HTML column is only what's visually rendered (title, price,
  description prose). The markdown response is the complete source file —
  frontmatter and all — so it also carries `sku`, `stock`, `sizes`,
  `colors`, `category`, `images`, `updatedAt`: structured, typed fields
  that were never rendered as visible text at all, and that a scraper
  would otherwise have to re-infer from page markup (with no guarantee of
  getting `stock: 42` right, versus reading it as an actual field). The
  ~44% extra tokens buy strictly more information, already structured,
  guaranteed to match [the Zod-validated
  source](#product-content-model) — not the same information paid for
  twice.

The tags-stripped column is a crude regex extraction (script/style/comment
stripping + whitespace collapse), not a real readability implementation —
good enough to establish the order of magnitude, not a precise baseline.
Numbers will drift slightly release to release as dependencies update; the
script exists so re-measuring is a command, not a rewrite.

## Lighthouse: 100/100/100/100, and 3/3 on Agentic Browsing

![Chrome Lighthouse report for /de/products/TS-BLK-001: Performance 100, Accessibility 100, Best Practices 100, SEO 100, and a green 3/3 on the Agentic Browsing category. Performance metrics: First Contentful Paint 0.6s, Largest Contentful Paint 0.7s, Total Blocking Time 0ms, Cumulative Layout Shift 0, Speed Index 0.6s.](./images/lighthouse.png)

That's a cold Lighthouse run against the product detail page, unthrottled
build, nothing special staged for the audit — the same production build
`npm start` serves. Worth showing because none of it is a coincidence; it
falls out of specific decisions made elsewhere in this README, not a
separate "make Lighthouse happy" pass:

- **Performance (100, CLS 0, TBT 0ms).** SSR + `provideClientHydration()`
  means the browser gets real, painted HTML on the first response instead
  of an empty shell waiting for JS — that's most of the 0.6s FCP right
  there. [`OnPush` everywhere](#ui-architecture) plus
  [explicit zoneless change detection](#ui-architecture) keep the runtime
  from doing speculative work on every event. Every `<img>` (product cards,
  product detail) carries explicit `width`/`height` attributes, so the
  browser reserves layout space before the image loads — that's the `0`
  CLS, not luck. And the [barrel-export bug that was quietly shipping Zod
  to the browser](#lessons-learned) is exactly the kind of thing that
  erodes this number silently over time if nobody looks at built chunk
  sizes; it's fixed now, but it's a good example of how a 100 doesn't stay
  a 100 on its own.
- **Accessibility (100).** Comes mostly for free from
  [spartan.ng's `brain` primitives](#spartanng-components) doing the
  unglamorous work: the toggle groups (locale/size/color pickers) get
  roving keyboard focus and pressed-state semantics instead of a `<div
  (click)>` soup, and the breadcrumb renders as a real `nav` landmark with
  `aria-current` on the active crumb and `aria-hidden` separators. Every
  product image has a real `[alt]` (bound to the product title, not a
  static placeholder) — small, but it's the kind of thing that's easy to
  skip on a demo and didn't get skipped here.
- **Best Practices (100) / SEO (100).** Structured data and metadata are
  generated from the same parsed product object the page renders — see
  [Structured data & SEO](#structured-data--seo) — so there's no separate,
  driftable "SEO version" of the content to get out of sync. The
  [locale guard](#i18n) exists specifically because an earlier Lighthouse
  SEO audit caught unknown paths like `/robots.txt` rendering as a bogus
  locale page — this repo's SEO 100 already survived one real regression.
- **Agentic Browsing (3/3).** This is a newer Lighthouse category
  (shipped in Lighthouse 13.3, May 2026) that scores a page not against a
  human visitor but against an *agent* trying to read and act on it — it
  checks for an `llms.txt`, WebMCP tool definitions, the quality of the
  accessibility tree (which is the data model an agent actually sees), and
  layout stability, and reports a pass ratio rather than a 0–100 score.
  This repo passes all 3 *applicable* checks: [`llms.txt` is served at the
  root](#serving-markdown-to-agents), the accessibility tree is clean (the
  same primitives and labeling behind the Accessibility 100 above), and
  CLS is 0. It's 3/3 and not 4/4 because the fourth check, WebMCP, wasn't
  wired up when this was measured. It is now - see
  [WebMCP: an agent that can shop](#webmcp-an-agent-that-can-shop) - but the
  polyfill that provides `document.modelContext` is loaded in dev builds only,
  and the score has not been re-measured, so don't read this as 4/4.

**Why this belongs in this README specifically:** the whole premise of this
repo is that a storefront can be genuinely legible to an agent — served
markdown, `llms.txt`, structured data — without that being bolted on as a
separate pipeline. Lighthouse shipping a category that measures exactly
that claim, from an external, vendor-neutral tool rather than this
project's own say-so, is about as close to independent validation of the
thesis as a showcase repo can get. A11y/SEO/Performance scores would matter
for any app; the Agentic Browsing score is the one that's actually *about*
what this repo is trying to prove.

## How it works

### Product content model

One object per product per locale, so each language version is a complete,
independently fetchable markdown document (authored per language, not
translated at render time):

```
s3://products/<sku>/en.md
s3://products/<sku>/de.md
```

Each file is YAML frontmatter plus a markdown body:

```yaml
---
sku: "TS-BLK-001"
title: "Classic Crew Tee"      # product name, localized per file
price: 29.9
currency: "EUR"                # always EUR, in every locale
stock: 42
sizes: ["S","M","L","XL"]
colors: ["black","charcoal"]
category: "apparel/shirts"
locale: "en"                   # matches the filename, kept for validation
images: ["/images/products/TS-BLK-001.svg"]
updatedAt: "2026-09-01T00:00:00.000Z"
---

# Classic Crew Tee

**A tee that gets out of the way**

Midweight combed cotton, a crew neck that keeps its shape after a wash...
```

That Markdown *is* the source of truth — not a CMS export, and not an HTML
page reverse-engineered back into markdown.

- **One schema.** `libs/product-schema` holds the Zod schema for that
  frontmatter. The ingest CLI validates against it before writing, and the
  storefront validates against it after reading, so the two can't drift.
- **One fetch function.** `libs/s3-client` exports `getProduct` /
  `listProducts` / `getProductRaw`. Every consumer calls those — page load
  functions, the negotiation middleware, the `.md` route, `llms.txt`, the
  sitemap. Nothing re-implements S3 access or frontmatter parsing (it's
  `front-matter` + `marked`, with the frontmatter validated against the Zod
  schema; the load functions catch failures and fall back to an empty result
  instead of throwing).
- **Why runtime, not Analog's content collections.** `injectContent` &
  friends are built around markdown sitting in `src/content` at *build*
  time. Piping S3 through that would mean syncing S3 → local files before
  every build, at which point "ephemeral, S3-backed data" stops being true.
  Product pages use Analog's `.server.ts` load functions
  (`injectLoad<typeof load>()`), which is already the idiomatic "fetch on
  the server before rendering" mechanism.
- **Images live on disk, not in S3.** Product images are static assets in
  `apps/storefront/public/images/products/`, referenced by path from the
  frontmatter. S3 stays scoped to what the demo is about — ephemeral,
  agent-legible product *data*. A real storefront would put images on a CDN.

### Serving markdown to agents

All of it lives in `apps/storefront/src/server/`, as plain Nitro/h3
middleware:

- **Content negotiation, same URL.** `/<locale>/products/<sku>` checks
  `Accept: text/markdown` first — UA-agnostic, and the primary way to demo
  this. A deliberately small, illustrative user-agent list (GPTBot,
  ClaudeBot, PerplexityBot) also works, purely to show the pattern; it is
  not an exhaustive or current bot registry. A match returns the raw S3
  object with `content-type: text/markdown`; everything else falls through
  to the normal Angular route.
- **Always-markdown sibling route.** `/<locale>/products/<sku>.md` returns
  the same raw markdown regardless of headers, for agents that just try
  appending `.md`.
- **No HTML→markdown conversion, anywhere.** Markdown is always the
  source; HTML is always derived from it, never the reverse.
- **`llms.txt`** is generated per request from `listProducts()`: a short
  site description, the landing pages, then one line per product per
  locale linking straight to the `.md` route — handing an agent the
  markdown entry point instead of making it discover content negotiation.
- **`robots.txt`** names every bot class explicitly instead of relying on
  `*`: classic search crawlers, AI search/retrieval crawlers (OAI-SearchBot,
  Claude-SearchBot, PerplexityBot…), user-triggered agents (ChatGPT-User,
  Claude-User, Perplexity-User…), and model-training crawlers (GPTBot,
  ClaudeBot, Google-Extended, CCBot…). Everything is allowed by default,
  since serving agents is the point of the demo; one constant
  (`ALLOW_TRAINING_CRAWLERS` in `server/lib/robots-txt.ts`) opts out of
  training crawls only. Worth knowing: robots.txt is advisory, some
  user-triggered fetchers are documented by their vendors as not bound by
  it, and browser-driving agents send a plain Chrome user-agent and can't
  be addressed by it at all. The bot list is a snapshot of documented
  user-agent tokens, not a maintained registry.

The negotiation logic is h3-only and deliberately not framework-portable or
extracted into a package: `wantsMarkdown()` is one small isolated module
(`server/lib/wants-markdown.ts`), kept separate from the route-handling
glue so it *could* be lifted out later — but there's exactly one consumer
today, so it stays where it is ("use before reuse").

### Structured data & SEO

- **JSON-LD `Product`** on the detail page (name, sku, image, `offers` with
  price/currency/availability derived from `stock`), built from the same
  validated product the page renders. It's written by `JsonLdDirective`
  through `Renderer2` in an `effect()` — Angular strips literal `<script>`
  elements from templates, and the effect (not a constructor) matters
  because the router reuses the component between `/products/:skuA` and
  `/products/:skuB`.
- **Meta descriptions**, localized per page: the landing page reuses the
  hero subheading's translation, the product list has its own string, and
  product pages derive theirs from the product's markdown body
  (`lib/product-description.ts`, shared with the JSON-LD `description` so
  the two can't drift).
- **Sitemap.** Product routes aren't known at build time — they live in
  S3 — so `/sitemap-products.xml` is generated per request from the live
  catalog, with `<xhtml:link rel="alternate" hreflang>` entries per locale.
- **Open Graph image**, generated per request at `/api/og/products/<sku>`
  (`server/routes/api/og/products/[sku].ts`) using Analog's `ImageResponse`
  (`@analogjs/content/og`, on `satori`/`satori-html`/`sharp`) — the same
  `getProduct(sku, locale)` every other consumer calls, rendered as a
  1200×630 PNG with the product's title and localized price (`en`:
  `€29.90`, `de`: `29,90 €`). Deliberately title + price only, no product
  photo: this catalog's images are generated placeholder SVGs, and
  satori's own layout/rendering engine doesn't reliably support SVG `<img>`
  sources the way a real browser would — a raster photo would embed fine,
  these placeholders wouldn't, so the template skips it rather than risk a
  broken image in production. Wired into the product detail page via
  `og:image`/`twitter:image`, set alongside the description in the same
  `effect()` as above, using `injectBaseURL()` (`@analogjs/router/tokens`)
  for the absolute URL a crawler actually needs — skipped entirely if
  that's `null` (e.g. no request context) rather than emit a broken
  relative one. The font `ImageResponse` needs to lay out text (satori
  can't use system fonts — it targets serverless/edge runtimes with no OS
  font access) is fetched once and cached for the life of the server
  process, not refetched per request.

### i18n

- **Locales:** `en` (default) and `de`, path-prefixed through a `[locale]`
  route segment, configured with the `analog()` Vite plugin's
  `i18n: { defaultLocale, locales }` option.
- **UI chrome** (nav, buttons, labels) uses `$localize` with `provideI18n()`
  and one JSON catalog per locale (`src/i18n/en.json`, `de.json`).
- **Product content** doesn't go through `$localize` at all: the locale in
  the URL directly selects which S3 object (`en.md` vs `de.md`) to fetch.
  Product content is data, not a UI string catalog.
- **Locale switcher:** `injectSwitchLocale()`, once, in the shared layout's
  header. Switching is a full navigation rather than an in-place re-render.
- **Unknown locales are rejected.** Analog's `[locale]` segment matches
  *anything*, so without a guard `/robots.txt` or `/favicon.ico` rendered
  the landing page nested under a bogus locale (found via a Lighthouse SEO
  audit). `[locale].page.ts` redirects anything outside `en`/`de`.
- **Currency** is fixed to EUR for both locales — no fake exchange rate —
  but still goes through `Intl.NumberFormat` so `en` renders `€29.90` and
  `de` renders `29,90 €`.

**Discussion: runtime vs. build-time localization.** Worth being precise
about what "build-time" means here, because it's really two different
mechanisms that get conflated:

- **Angular CLI's classic i18n** (`ng build --localize`) compiles a
  *separate application bundle per locale*: `$localize` messages get
  swapped for their translations at compile time, and the output is N
  distinct, self-contained bundles with zero i18n runtime machinery in any
  of them — no JSON fetch, no locale lookup, nothing to get out of sync at
  request time.
- **AnalogJS's own i18n** (`@analogjs/router/i18n`, what this repo
  actually uses) is a different design: *one* bundle handles every
  configured locale. `$localize`/`i18n="@@id"` is still used in templates
  (see the `nav.home`, `home.heading`, etc. message IDs throughout
  `apps/storefront/src/app`), but only for *extraction* — the actual
  translation happens at runtime, resolved per request by
  `provideI18n()`'s `loader` (here, `import('../i18n/${locale}.json')` in
  `app.config.ts`). Analog does support a build-time-*ish* layer on top of
  this — `prerender: { routes, sitemap }` combined with the `i18n` config
  generates locale-prefixed static HTML (`/en/about`, `/de/about`, …) at
  build time — but it does that by running the *same* runtime-capable
  bundle once per locale during the build, not by compiling N separate
  bundles the CLI way.

So "even build-time would be possible with `$localize`" is half right:
Analog's prerender step is exactly that build-time option, and it would
work fine for genuinely static routes here (the landing page, for
instance). It doesn't extend to this repo's product routes, though, for
the same reason [product content stays out of Analog's content
collections](#product-content-model): `/<locale>/products/<sku>` isn't a
known, finite set at build time — the catalog lives in S3 and can change
without a rebuild. Prerendering can't enumerate routes it doesn't know
exist yet. Baking those pages at build time would mean re-baking on every
catalog change, which is exactly the "ephemeral, S3-backed data" premise
this whole repo is built to avoid.

**Locale-specific images are already possible, independent of any of
this.** That part of the idea doesn't actually depend on runtime vs.
build-time localization at all — `en.md` and `de.md` are already two
separate frontmatter documents (see [Product content
model](#product-content-model)), each with its own `images` array. A
German file pointing at a different (or differently localized) image than
its English sibling would work today, unchanged, under the current runtime
i18n setup. Nothing about that needs compile-time bundle splitting.

What real build-time bundle splitting *would* buy over the current setup:
slightly less shipped to the client (the i18n catalogs are already tiny —
`en.json`/`de.json` compile down to ~0.4 kB gzip each, their own chunks in
the [bundle analysis below](#lessons-learned)) and translation-key typos
caught at compile time instead of surfacing as a missing string at
runtime. What it would cost: N separately built, versioned, deployed
server bundles instead of the one Nitro process this app runs today — a
real operational trade for a win this small at a 2-locale, 6-product
scale. Not pursued here for that reason, not because it's unsupported.

### UI architecture

- **One layout.** `AppLayoutComponent` wraps every `[locale]` route
  (header, breadcrumb, `<router-outlet>`, footer with a link to
  `llms.txt`). Its template and styles are inline in the `.ts` file — it's
  the one shell component, so co-location keeps it in one place.
- **`OnPush` on every component**, standalone throughout. The landing page
  uses one `@defer (on viewport)` block for its secondary section.
- **Zoneless**, explicitly. `provideZonelessChangeDetection()` in
  `app.config.ts` — `zone.js` was never actually a dependency (not in
  `package.json`, not in `node_modules`; only a peer-dependency mention in
  the lockfile), so the app was already running on Angular's implicit
  no-zone fallback. Declaring it turns that into the real zoneless
  scheduler instead, which is what the OnPush/signals architecture here was
  already built for. No bundle-size change from this (`zone.js` was never
  shipped either way) — this is a correctness/explicitness fix, not a
  size one.
- **State is as small as it can be.** Almost everything is a plain
  `computed()` derived from the loaded product. The add-to-cart form on
  the detail page is the one place with genuinely *owned* local state: a
  signal form (`@angular/forms/signals`) over a writable model signal
  (size, color, quantity), with an `effect()` that resets the model when
  the product input changes (again, the router reuses the component
  instance). Cross-component state lives in three `signalStore`s:
  `BreadcrumbStore` (the layout renders the trail but only the active page
  knows what it should say), and `SessionStore` / `CartStore`, which
  mirror the server-side session and cart (see
  [Demo cart, session and checkout](#demo-cart-session-and-checkout)).
- **No `rxMethod`.** Search was cut from scope, which left no debounced
  input for it to serve. The cart/session stores use plain async methods
  (`firstValueFrom` + `patchState`) because each call is a one-shot
  request, not a stream.

### spartan.ng components

spartan splits each component into a headless **brain** primitive (behaviour
and accessibility, from `@spartan-ng/brain`) and a **helm** layer (Tailwind
styling) that the CLI *copies into your repo* instead of shipping as a
dependency. Here the helm code lives in `libs/ui/<primitive>` (config in
`components.json`), imported as `@spartan-ng/helm/<primitive>`, and is ours
to edit. Seven primitives are used, each replacing hand-written markup:

| Primitive | Used for |
|---|---|
| `button` | landing call-to-action, "Back to products" (`hlmBtn` on `<a>`) |
| `card` | product cards, landing category tiles (`hlmCard` on `<a>`) |
| `badge` | category label, stock status |
| `breadcrumb` | the trail rendered by `BreadcrumbStore` (nav landmark, `aria-current`, decorative separators) |
| `toggle-group` | locale switcher, size picker, color picker |
| `dialog` | the sign-in dialog, opened through `HlmDialogService` |
| `input` | the name field in the sign-in dialog (`hlmInput`) |

The size/color pickers are the interesting one: a single-select toggle
group gives roving keyboard focus and pressed-state semantics that the old
hand-styled buttons didn't have. They aren't form controls, so they read
and write the add-to-cart form's model signal directly instead of using
`[formField]`. Two local edits to the copied code: selected items
are filled with the primary color (the stock "on" state was too faint on
this background), and the badge gained two project-specific variants,
`accent` (the one-off brand-accent color, "In stock") and `muted` ("Out of
stock") — used as `variant="accent"` rather than overriding colors through
`class`, which spartan reserves for layout.

**Discussion: is this heavier than shadcn/daisyUI?** At the code level, no
— spartan's CLI copies plain source files into your repo exactly like
`npx shadcn add button`; you own and edit them from there, not a package
you `npm update`. `libs/ui/button`'s actual code is two small files,
`hlm-button.ts` and `hlm-button.token.ts`. What *is* heavier here is
packaging, not philosophy: `components.json` has `"generateAs": "library"`,
so in this Nx workspace the CLI wraps every copied primitive in a full Nx
library — `project.json`, `tsconfig.json`, `tsconfig.lib.json`,
`eslint.config.mjs`, `README.md` — per component, on top of those one or
two source files. That buys independent lint/build targets and
tree-shakeable, path-mapped imports (`@spartan-ng/helm/<primitive>` via
`tsconfig.base.json`) if the workspace ever wants per-component Nx
targets; for a single app like this one, it's ceremony this repo doesn't
exploit. `components.json` also supports `"generateAs": "directory"`,
which drops the Nx-library scaffold and just places files under
`libs/ui/<name>` — closer to shadcn's flat-file feel. Not switched here
because it wasn't worth the churn on an already-generated set of
components, but it's the knob to reach for if the current structure feels
like more than the workspace needs.

### Demo cart, session and checkout

A small shop flow on top of the catalog, kept deliberately demo-grade: no
passwords, no payment, and every piece of state lives in server memory.

**The flow.** The header has a *Sign in* button. Signing in means picking a
display name in a dialog (a spartan `dialog` + a signal form) - no
credentials. Adding to the cart while signed out opens the same dialog and
then *continues the add* once you're in; dismissing it (Esc, backdrop) just
cancels. The cart page lists the lines, checkout reviews them and places an
in-memory order, and a confirmation page shows it. *Sign out* deletes the
session, and the cart and orders with it.

**Server (Nitro/h3, `src/server/`).** The session is a random id in an
httpOnly, `SameSite=Lax` cookie (`secure` outside dev), mapped to
`{ userName, items, orders }` in a module-level `Map`
(`server/lib/cart-session.ts` is the only file that touches it). Expiry
slides on both sides: every lookup that finds a live session refreshes the
server-side `lastSeen` *and* re-sends the cookie, so they always lapse
together after 2 hours of inactivity (a fixed cookie max-age would drop the
cookie while the server still held the session). The map is also capped at
1000 sessions.

| Endpoint | Behavior |
|---|---|
| `GET /api/session` | `{ userName }`, `null` when signed out; never creates a session |
| `POST /api/session` | pseudo login; signing in again just renames the session and keeps the cart |
| `DELETE /api/session` | deletes the session (cart + orders) and the cookie |
| `GET /api/cart?locale=` | the cart lines; titles/prices are looked up at read time |
| `POST /api/cart/items` | add a line (same sku+size+color merges); validates size/color/stock; **401** without a session |
| `POST /api/checkout` | prices the cart from the product source, re-checks stock, creates the order, empties the cart |
| `GET /api/orders/:id` | session-bound: another session gets the same 404 as an unknown id |

The server never trusts the client for prices or titles - those always come
from the product source (`getProduct`), at read time for the cart and
frozen into the order at checkout. Stock is tracked per sku, so checkout
sums the quantities across size/color lines and answers **409** with a
readable message (`Only 12 of "Leather Derby" in stock`) when it doesn't
add up. Stock is never *decremented* (the product source is read-only), so
the check guards the cart against the catalog, not orders against each
other - two sessions can both order the last unit. Add-to-cart itself only
checks for stock of at least one.

**Client-only, on purpose.** `SessionStore` and `CartStore` are
`signalStore`s that mirror the server and stay `idle` during SSR; the
layout loads them from `afterNextRender`. So server-rendered HTML is
identical for every visitor (nothing per-user, nothing uncacheable, no
hydration mismatch): the header renders signed-out with no cart badge, the
cart/checkout/order pages render a skeleton, and everything fills in after
hydration. Those pages are `noindex`. A locale switch refetches an
already-loaded cart (the layout owns that effect), since titles and prices
are locale-specific; an order is a frozen snapshot and keeps the language
it was placed in.

A 401 from add-to-cart (session expired, or the server restarted) is
treated as "signed out": the store resets, the dialog reopens, and the add
retries once.

**One contract, no zod on the client.** `app/lib/cart-schema.ts` holds the
zod schemas for the requests *and* responses; the server validates with
them, and the client's types are `z.infer` types imported with
`import type` only - erased at compile time, so zod never reaches the
bundle (the same lesson as the barrel-export entry under
[Lessons learned](#lessons-learned)). The runtime values the client does
need (`MAX_QUANTITY`, ...) live in a separate zod-free
`cart-constants.ts`. Two guards keep that honest: an ESLint rule
(`@typescript-eslint/no-restricted-imports`, `allowTypeImports`) that fails
any value import of `cart-schema` under `src/app`, and
`npm run check:client-zod`, which scans the built client bundle for zod's
own identifiers.

**Honest limits.** Sessions are lost on restart and aren't shared across
instances or serverless invocations; there's no CSRF token beyond
`SameSite=Lax` plus JSON bodies; the checkout, cart and add-to-cart copy is
English-only (the header and dialog strings are translated in
`src/i18n/*.json`); and there are no automated tests - the API was
exercised with `curl` against the built server.

### WebMCP: an agent that can shop

The markdown routes let an agent *read* the shop. WebMCP lets it *act* in it:
a CLI agent (Claude Code, in the demo) searches the catalog, reads a product,
fills the cart and sends the user to checkout, in the user's own browser tab
and session, while the human keeps the irreversible step.

[WebMCP](https://github.com/webmachinelearning/webmcp) is a browser API: a page
registers tools on `document.modelContext` (older drafts:
`navigator.modelContext`), and an agent embedded in or attached to the browser
calls them. The tools run **in the page**, against the same stores the UI uses.
That is the catch for a terminal agent: it can't see them over HTTP the way it
reads `.md` routes, so it needs a bridge into a live tab.

```
Claude Code ──stdio──▶ @mcp-b/webmcp-local-relay ◀──WebSocket (127.0.0.1:9333)── embed.js
  (MCP client)          (local MCP server)                                          │ in the page
                                                                       document.modelContext
                                                           (native in Chrome, or the polyfill)
                                                                                    ▲
                                              Angular: provideExperimentalWebMcpTools(...)
                                                                                    │ execute()
                                                          CartStore · SessionStore · /api/products
```

**The tools** (`app/webmcp-tools.ts`). Each is a thin adapter over code the UI
already uses, so an agent and a human go through the same path:

| Tool | Does |
|---|---|
| `search_products` | `query` (every word must match title, category or description), optional `category`; no query lists the catalog. Returns sku, title, price, stock, sizes, colors |
| `get_product` | one product with its description and the valid sizes and colors |
| `add_to_cart` | `sku`, `size`, `color`, `quantity`; goes through `CartStore.add`, so the server's size/color/stock validation applies |
| `view_cart` | the cart lines and total |
| `go_to_checkout` | navigates the tab to `/<locale>/checkout` and stops |

`locale` is optional everywhere and defaults to the language in the tab's URL.

**Human in the loop, by construction.** There is no `place_order` tool, so an
agent *cannot* complete a purchase - `go_to_checkout` only opens the review page
and the user presses *Place order*. The login is the same: `add_to_cart` reuses
`SessionStore.ensureSignedIn()`, so a signed-out user gets the normal login
dialog. A tool call that waits on a human runs into the relay's 65 s invoke
timeout and the agent only sees `Host response timeout`, so the tool opens the
dialog *without awaiting it* and returns "not signed in - ask the user to sign
in, then call again". Only one dialog is ever open, however often the agent
retries. Failures (bad size, unknown sku) come back as `isError` results
carrying the server's reason and a hint, so the agent can correct itself.

**Angular's own WebMCP support** (Angular 22.1, `@angular/core`, marked
*experimental - APIs may change even outside major versions*). Tools are
registered with `provideExperimentalWebMcpTools([...])`; each tool's `execute`
runs in an injection context, so it just calls `inject(CartStore)`. Details
that matter here:

- **Browser-only config.** `app/app.config.browser.ts` merges the tools onto
  `appConfig`, the mirror image of `app.config.server.ts`, and `main.ts`
  bootstraps with it. The server bundle never contains the tool code (checked
  with `grep` on the build output). Angular's own registration also no-ops under
  `ngServerMode`, so this is belt and braces.
- **It registers on `document.modelContext` first, then falls back to
  `navigator.modelContext`, and silently does nothing if neither exists.** No
  error, no warning - a browser without WebMCP just has no tools.
- **JSON Schema, not Zod.** Input schemas are plain `as const` JSON Schema, so
  the zod contract in `cart-schema.ts` isn't reused directly (and zod must stay
  out of the client bundle anyway - see
  [above](#demo-cart-session-and-checkout)). Angular infers `execute`'s argument
  type from a const schema, which breaks down for a mixed list of tools, so a
  small `defineTool<Input>()` helper types the arguments explicitly instead.
- **Tools need data.** The catalog is only read in server-side load functions,
  so two small JSON routes back the browser tools: `GET /api/products`
  (`?locale=&q=&category=`) and `GET /api/products/:sku`. They return a slim
  projection (no rendered HTML) built from the same `listProducts`/`getProduct`
  calls as everything else.

**The polyfill and the bridge (dev builds only).** Chrome ships WebMCP behind a
flag, so for ordinary browsers `main.ts` dynamically imports
[`@mcp-b/webmcp-polyfill`](https://docs.mcp-b.ai) and calls
`initializeWebMCPPolyfill()` *before* bootstrapping Angular (the tools register
at bootstrap, so the global has to exist first). It then injects the relay's
`embed.js` from jsDelivr, which discovers whatever is registered on
`document.modelContext` - including tools added later - and forwards it over a
local WebSocket. The other half is one entry in `.mcp.json`:

```json
"webmcp-local-relay": { "command": "npx", "args": ["-y", "@mcp-b/webmcp-local-relay@5"] }
```

Claude Code launches the relay as a stdio MCP server; the relay exposes each
page tool under its own name plus `webmcp_list_sources`, `webmcp_list_tools`
and `webmcp_open_page`. Both pieces are gated on `import.meta.env.DEV`, because
loading a third-party script from a CDN into a production storefront is a
decision for a real deployment, not a default for a demo.

**Try it.**

1. `npm run dev` (needs S3Mock seeded, see [Quick start](#quick-start)) and open
   `http://localhost:4200/en` in a normal browser. Keep the tab open: the tools
   exist only while it does.
2. Start Claude Code in this repo (it picks up `.mcp.json`; approve the new
   server) and run `webmcp_list_sources` - the tab should appear with 5 tools.
3. Ask it something like *"find a leather shoe, add it in size 42 and take me to
   checkout"*. Sign in when the dialog appears, review the order, press
   *Place order* yourself.

Behind WSL the relay (in WSL) and the browser (on Windows) still find each other
over `localhost:9333`.

**Versions and traps.**

- The MCP-B docs describe a v6 API (`setupPolyfill()`, an `embed.js` under
  `@6`). npm's stable release of both packages is **5.1.0**, where the function is
  `initializeWebMCPPolyfill` and `@6/.../embed.js` is a 404; only `@6`'s beta
  exists. Everything here is pinned to 5.x. Re-check when v6 goes stable.
- The relay accepts WebSocket connections from **any origin** by default. For
  anything beyond a laptop demo, pass `--widget-origin http://localhost:4200`
  in the `.mcp.json` args.
- Two tabs registering the same tool get suffixed names (`search_ed93`, ...);
  keep one storefront tab open.
- After a code change, Vite reloads the page and the relay briefly drops and
  re-lists the tools. A tool's description as your agent client cached it can be
  stale; `webmcp_list_tools` shows what the page currently registers.

**What was verified, and what wasn't.** Driven for real from Claude Code through
the relay into a Chrome tab: listing sources, `search_products`, `get_product`,
`add_to_cart` (including the login dialog completing a queued add, and a bad
size coming back as a readable error), `view_cart` reflecting a change made in
the UI, and `go_to_checkout` navigating the tab. **Not** verified: the
signed-out path of the non-blocking `add_to_cart`, the `de` locale through the
tools, a production build, other agent clients, and Lighthouse's WebMCP check
(see [Lighthouse](#lighthouse-100100100100-and-33-on-agentic-browsing)). There
are no automated tests.

**Limits.** No tool to remove or change a cart line, so an agent that adds the
wrong item can't undo it. `search_products` is a plain substring match, fine
for a six-product catalog and nothing more. The tools hold no per-agent identity:
they act as whoever is signed in in that tab.

### Built with each framework's own AI tooling

This repo is also meant to be evidence of *using* spartan.ng's and
AnalogJS's own AI-agent tooling to build it, not just of the shipped
storefront. The two frameworks take different approaches, and neither is
hypothetical here — both are checked into or verified against this actual
repo:

**spartan.ng — skill + MCP server.**

1. **Skill:** `npx skills add spartan-ng/spartan` (project-scoped by
   default; `-g` installs it globally instead) — run against this repo, not
   just documented. Procedural knowledge of spartan's CLI/components/
   conventions lands in `.agents/skills/spartan` (the vendor-neutral
   location this tool uses across ~20 agents — Codex, Cline, Amp, and
   others, alongside Claude Code), with `.claude/skills/spartan` left as a
   symlink to it rather than a separate copy. It activates automatically on
   any project with a `components.json` — i.e. once spartan's own `init`
   generator has run (it has, here — see [spartan.ng
   components](#spartanng-components)) — so that has to come first, then
   the skill.
2. **MCP server:** [`.mcp.json`](.mcp.json), checked into this repo's root
   so it applies to anyone working in it, not just whoever set it up:
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
   Gives Claude Code (or any MCP-speaking client) live component/docs/block
   lookups instead of guessing spartan's API from training data. A global
   install + `spartan-mcp` binary is the documented alternative if repeated
   `npx` cold-starts get annoying.

**AnalogJS — three formats of the same guidance, all shipped
automatically, one wired up by hand.** `@analogjs/platform` ships three
things the moment the dependency is installed — no setup step, no
generator to run — all covering the same ground (file-based routing,
server/API routes, `.server.ts` load functions, content routes, modern
Angular style):

- `node_modules/@analogjs/platform/AGENTS.md` — plain Markdown for any
  client that reads `AGENTS.md` files. This workspace's
  `apps/storefront/AGENTS.md` is two lines pointing at that platform copy
  rather than a duplicated file, so it can't drift out of sync with
  whatever Analog version is actually installed — a deliberate framework
  design choice, not something this repo added. Works with zero
  configuration; it's how the coding agent used to build this repo picked
  up AnalogJS's conventions.
- `node_modules/@analogjs/platform/plugin.json` — an [Agent
  Plugins](https://agent-plugins.org) `1.0.0` manifest, the more formal
  side. We verified that this is *not* auto-discovered from
  `node_modules`: Claude Code running in this repo loads no "analogjs"
  plugin, even though the manifest is right there —
  Agent Plugins v1 has no `node_modules` discovery mechanism, so the
  plugin root has to be registered with whatever client supports the spec
  by hand.
- `node_modules/@analogjs/platform/skills/analogjs/SKILL.md` — the same
  guidance again, this time as a Claude-Code-native skill, mirroring
  `AGENTS.md`. This is the one worth actually wiring up: symlinked into
  `.claude/skills/analogjs` in this repo (the same pattern spartan's own
  skill install used — real content in a stable location, a symlink is
  what Claude Code discovers from), so it's genuinely active here, not
  just described:
  ```sh
  ln -s ../../node_modules/@analogjs/platform/skills/analogjs .claude/skills/analogjs
  ```

No MCP server on Analog's side (as of now) — the framework-level
counterpart to spartan's interactive skill+MCP approach is purely
machine-readable docs (`llms.txt`/`llms-full.txt`, per-page `.md` — the
same pattern [this repo's own agent-facing
routes](#serving-markdown-to-agents) are modeled on) plus the three files
above.

### Routes

| Route | Served by |
|---|---|
| `/` | redirect to `/en` |
| `/<locale>` | landing page |
| `/<locale>/products` | product list (`.server.ts` load function, category filter via query param) |
| `/<locale>/products/<sku>` | product detail — HTML, or markdown if negotiated |
| `/<locale>/products/<sku>.md` | always raw markdown |
| `/<locale>/cart` | the session cart (client-only, `noindex`) |
| `/<locale>/checkout` | review + place the order (client-only, `noindex`) |
| `/<locale>/order/<id>` | order confirmation, visible only to the session that placed it |
| `/api/session`, `/api/cart`, `/api/cart/items`, `/api/checkout`, `/api/orders/<id>` | the demo shop API, see [above](#demo-cart-session-and-checkout) |
| `/api/products`, `/api/products/<sku>` | slim JSON catalog backing the WebMCP tools (`?locale=&q=&category=`), see [WebMCP](#webmcp-an-agent-that-can-shop) |
| `/api/og/products/<sku>` | per-product Open Graph image (PNG, `?locale=`) |
| `/llms.txt` | request-time index → product `.md` routes |
| `/sitemap-products.xml` | request-time sitemap of the live catalog |
| `/robots.txt` | per-bot-class rules |

### Local infrastructure

`docker-compose.yml` runs S3Mock with a `products` bucket on port 9090.
The storefront and the ingest CLI both talk to it through the shared
`s3-client` lib (path-style addressing, endpoint from env vars rather than
hardcoded). One trap: the bucket-creation env var is
`COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS`. The plain
`INITIAL_BUCKETS` was deprecated in S3Mock 4.5.0, and with the old name the
bucket silently never gets created — no error, just an empty bucket list.

## Re-seeding

Storage is deliberately ephemeral — that's the point (a real catalog would
be genuinely dynamic, not baked into the build). Reset it any time:

```sh
npm run seed:clear   # empty the bucket
npm run seed         # push the 6-product demo catalog back in (EN+DE)
```

The catalog and its EN/DE copy are hand-authored fixtures in
`apps/product-ingest/src/app/fixtures.ts` — 6 products across 2 categories
(3 shirts, 3 shoes), not fetched from anywhere external, and not generated
by an LLM. Placeholder product images are generated SVGs (no stock photos,
no licensing questions), written to
`apps/storefront/public/images/products/` by the same seed command.

## Project structure

```
apps/
  storefront/              AnalogJS app — the actual storefront
    src/app/
      pages/                 file-based routes (see below)
      components/            presentational components (Header, Footer,
                              Breadcrumb, ProductCard, ProductDetail,
                              CartItem) plus the lazy LoginDialog, built on
                              the spartan components in libs/ui
      layout/                AppLayoutComponent - the shared shell
      directives/            JsonLdDirective
      webmcp-tools.ts        the WebMCP tools (search, get, add, view, checkout)
      app.config.browser.ts  browser-only config: appConfig + the WebMCP tools
      stores/                BreadcrumbStore, SessionStore, CartStore
      lib/                   small pure helpers (price formatting,
                              product description) and the cart contract:
                              cart-schema.ts (zod + z.infer types, import
                              type only on the client), cart-constants.ts
    src/i18n/                en.json / de.json UI string catalogs
    src/server/
      middleware/            content negotiation, llms.txt, sitemap, robots.txt
      routes/api/og/products/[sku].ts   per-product Open Graph image
      routes/api/{session,cart,orders}/, checkout.post.ts   the demo shop API
      routes/api/products/   JSON catalog for the WebMCP tools
      lib/                   Accept-header/user-agent detection, robots.txt
                              rules, cart-session.ts (the in-memory sessions),
                              product-view.ts (slim product JSON)

  product-ingest/          NestJS CLI (nest-commander) - seeds S3Mock,
                            not a running service. `nx run product-ingest:seed`

libs/
  product-schema/          Zod schema for the frontmatter contract -
                            shared by both apps so ingest/read can't drift
  s3-client/               The one shared S3 fetch/parse function - every
                            consumer above (pages, negotiation, llms.txt,
                            sitemap) calls the same getProduct/listProducts
  ui/                      spartan.ng helm components, copied in by the
                            spartan CLI (button, card, badge, breadcrumb,
                            toggle-group, dialog, input + shared utils) -
                            one Nx lib each

components.json           spartan CLI config (where helm code goes, style)
.mcp.json                 spartan's MCP server and the WebMCP relay (checked in,
                          applies repo-wide)
.claude/skills/           spartan + analogjs skills - see "Built with each
                          framework's own AI tooling"
docker-compose.yml        S3Mock, the only external dependency
```

Routes, file-by-file, under `apps/storefront/src/app/pages/`:

```
index.page.ts                          /  → redirects to /en
[locale].page.ts                       shared layout + locale guard for every /:locale/* route
[locale]/index.page.ts                 /:locale            landing page
[locale]/products/index.page.ts        /:locale/products    product list
[locale]/products/[sku].page.ts        /:locale/products/:sku    product detail
[locale]/cart.page.ts                  /:locale/cart        session cart (client-only)
[locale]/checkout.page.ts              /:locale/checkout    review + place order (client-only)
[locale]/order/[id].page.ts            /:locale/order/:id   order confirmation (client-only)
```

Product list/detail pages each have a sibling `.server.ts` file — Analog's
load-function convention — which is where the S3 fetch actually happens,
server-side, before the page renders.

## Tech stack

| Layer | Choice |
|---|---|
| Monorepo | Nx workspace |
| Meta-framework | [AnalogJS](https://analogjs.org) 2.7 (Angular 22, Vite, Nitro/h3) |
| Components & styling | [spartan.ng](https://spartan.ng) (`brain` headless primitives + copy-owned `helm` styling, in `libs/ui`) on Tailwind v4, themed through spartan's `hlm-tailwind-preset` |
| State & forms | `@ngrx/signals` — `signalStore` for the breadcrumb trail and the session/cart mirrors; Angular signal forms for the add-to-cart and sign-in forms; plain `computed()` for everything derived |
| Schema/validation | Zod, shared between the ingest CLI and the storefront; the cart contract's types reach the client through `import type` only |
| i18n | AnalogJS's native runtime i18n (`provideI18n`, `[locale]` route segment) |
| Product storage | S3-compatible object storage (Adobe S3Mock), ephemeral |
| Content parsing | `front-matter` + `marked` |
| OG images | Analog's `ImageResponse` (`@analogjs/content/og`), on `satori` + `satori-html` + `sharp` |
| Ingest tool | NestJS CLI (`nest-commander`) |
| Agent actions | Angular's experimental WebMCP APIs (`provideExperimentalWebMcpTools`), `@mcp-b/webmcp-polyfill` and `@mcp-b/webmcp-local-relay` 5.x (dev only) |

## Lessons learned

Real problems hit while building this, with root causes rather than just
workarounds — most of them are the kind of thing that only shows up when
several of these tools are used together.

- **Analog's dev server never sends a middleware handler's return value.**
  The negotiation/`llms.txt`/sitemap middleware hung forever under
  `nx serve` while working fine in a production build. Cause, found in
  `@analogjs/vite-plugin-nitro`'s dev-mode runner: it calls each
  `server/middleware/*.ts` handler directly and only inspects the *return
  value* to decide whether to call `next()` (`if (!result) next()`) — it
  never writes that value to the response. Auto-serialization of returned
  values only happens in Nitro's real production pipeline. **Fix:** call
  h3's `send(event, body, contentType)` explicitly, then `return true` so the
  chain doesn't continue into Angular's renderer on an already-closed
  response. Any non-pass-through middleware here should do the same.
- **Vite and Nitro resolve modules separately.** `vite-tsconfig-paths` didn't
  resolve the workspace libs in the SSR module runner despite a correct
  `extends` chain, and Nitro (which runs `.server.ts` load functions and
  middleware) has an entirely separate resolution pipeline that ignores
  Vite's `resolve.alias`. Fix: explicit aliases for both workspace libs,
  given to Vite *and* repeated under `analog({ nitro: { alias } })`. The
  spartan helm libs hit the same wall (`@spartan-ng/helm/*` failed in SSR
  despite correct `tsconfig` paths); one pattern alias in `vite.config.ts`
  covers all of them (Vite only — Nitro never imports components).
- **Nx's default `appsDir` is the workspace root.** Without setting
  `workspaceLayout` in `nx.json` *before* generating, Analog's generator
  scaffolds at the root instead of under `apps/`.
- **Two spartan/Tailwind traps.** (1) Tailwind v4 only auto-scans the app,
  so the copied helm classes in `libs/ui` need an explicit
  `@source "../../../libs/ui"` in `styles.css` — and it must sit *below*
  every `@import`: CSS ignores `@import` rules that follow other rules, so
  placed above the spartan preset import it silently drops the preset and
  fails with a confusing `Cannot apply unknown utility class border-border`.
  (2) A toggle group's `nullable` input defaults to `true`, so re-clicking
  the selected size deselected it and left the UI out of sync with the
  form model behind it; the pickers set `[nullable]="false"`.
- **Angular strips literal `<script>` elements from templates** — even
  static ones — so JSON-LD has to be written through `Renderer2`.
- **A page can't have both a component and `redirectTo`.** Analog's
  generated route always sets `component`, so a pure-redirect page throws
  `NG04014` unless it exports no default component at all.
- **`<analog-markdown>` broke SSR here.** Rendering product bodies with
  Analog's own component seemed like a clean fit but tripped an SSR-breaking
  incompatibility in this Vite/Nitro AOT build (a partially-Ivy-linked
  dependency needing the JIT compiler, which gets tree-shaken out of the
  production server bundle). Tried, reverted, and rendered with `marked`
  instead.
- **Dark mode CSS existed but was never activated.** `styles.css` had a
  full `:root.dark { ... }` variable set from the start, but nothing ever
  added a `dark` class anywhere, and no `@media (prefers-color-scheme)`
  fallback existed either — so the app was permanently light. Complicating
  a "just use a media query" fix: spartan's `hlm-tailwind-preset.css`
  redefines Tailwind's `dark:` variant as `@custom-variant dark
  (&:is(.dark *))` — class-based, not `prefers-color-scheme` — and three
  helm components (`hlm-button`, `hlm-badge`, `hlm-toggle`) use `dark:`
  utilities directly. So the CSS variables have to stay keyed off `.dark`
  too. Fixed with a small inline script in `index.html`, run before first
  paint, that sets `.dark` on `<html>` from
  `matchMedia('(prefers-color-scheme: dark)')` and keeps it in sync on
  change — OS-driven, no manual toggle in the UI.
- **A barrel export silently shipped Zod to the browser.** A production
  build showed `_locale_.page-*.js` — the shared layout chunk loaded on
  *every* route — at 99.5 kB / 29.4 kB gzip, disproportionate for a
  component that just renders header/breadcrumb/footer. `libs/product-schema`
  exports both plain constants (`LOCALES`) and Zod schemas from one barrel
  (`export * from './lib/product-schema'` in `index.ts`), and that file
  does `import { z } from 'zod'` at module scope. `AppLayoutComponent` and
  `[locale].page.ts` only ever value-import `LOCALES` — everything else
  they take from that module is `import type`, which erases — but because
  a bundler can't prove `z.object(...)` calls are side-effect-free, the
  barrel re-export pulled in the whole Zod schema graph anyway, and this
  build's Rollup config didn't shake it back out even after `LOCALES` was
  moved to its own zod-free file (`libs/product-schema/src/lib/locales.ts`)
  — the barrel indirection alone was enough to defeat tree-shaking here.
  Confirmed the mechanism empirically: importing that file by a direct
  relative path (bypassing the barrel entirely) shrank the chunk to
  12.5 kB / 4.6 kB gzip and removed every trace of Zod (`ZodError`,
  `ZodObject`, …) from the build output. Fixed properly with a second path
  alias, `@analog-ecom-ws/product-schema/locales` (in both
  `tsconfig.base.json` and `vite.config.ts`'s `workspaceLibAliases`,
  ordered before the bare specifier), so the two client call sites resolve
  straight to the zod-free file without a relative-path escape hatch.
  Net: ~87 kB raw / ~25 kB gzip off every route's initial load. Worth
  remembering generally: a barrel that mixes side-effecting and pure
  exports can force-include the side-effecting half even when only the
  pure half is imported as a value — measure with the actual built output,
  not just source-level `import type` discipline.
- **A lint guard that never fires is worse than none.** The rule that
  restricts value imports of `cart-schema` (to keep zod out of the client)
  passed under `nx lint` even with a planted violation, while a direct
  `eslint` run caught it. Cause: the Nx lint executor runs from the
  workspace root, so flat-config `files`/`ignores` globs written relative to
  the app (`src/app/**`) matched nothing; they need a `**/` prefix. A
  second trap in the same rule: gitignore-style `group` patterns don't match
  a `./cart-schema` specifier, so it uses `regex`. Both were found only by
  deliberately planting a violation - do that for any guard.
- **A fixed cookie max-age drifts from a sliding server session.** The
  first session cookie got a 2-hour max-age at creation while the
  server-side session slid on activity, so a busy session could lose its
  cookie while the server still held it. Refreshing the cookie on every
  lookup that finds a live session keeps both expiries the same.
- **S3Mock fails quiet.** The deprecated bucket env var creates no bucket
  and reports no error (see [Local infrastructure](#local-infrastructure)).
  It only showed up by querying the running container, not by the code
  looking plausible — which is why this repo is verified by hand and by
  `curl` against a real S3Mock instead of only being typechecked.

## Scripts reference

| Script | What it does |
|---|---|
| `npm start` | docker up → seed → production build → serve (**use this**) |
| `npm run dev` | docker up → seed → Vite dev server (fast reload for editing pages) |
| `npm run docker:up` / `docker:down` | start/stop S3Mock |
| `npm run seed` / `seed:clear` | push/clear the demo catalog |
| `npm run storefront:build` | production build only |
| `npm run storefront:dev` | Vite dev server only (no docker/seed step) |
| `npm run check:client-zod` | fail if zod ended up in the built client bundle (run after `storefront:build`) |

## Non-goals

No payment, no real auth (the sign-in is a display name, no password), and
no persistent orders: the demo cart, session and orders live in server
memory and vanish on restart. No real persistence layer — S3Mock is the
only store for the catalog, and data is expected to be reseeded on demand. No
production security or performance hardening. No real search in the UI (the
category filter on the product list follows two static links, not a search
box — a 6-product catalog doesn't need one); the only search is the
agent-facing `search_products` tool, a plain substring match. No automated tests: this is a
showcase repo, verified by hand and by `curl` against a real running
S3Mock throughout its build, not by a test suite. That includes the
sign-in dialog, which has only been built and linted, not driven in a
browser.

## Not built (yet)

- **Streaming SSR.** Analog's `experimental.streaming` option with
  `@defer (hydrate on viewport)` would progressively flush the response;
  still a stretch goal, not attempted.
- **A `<link rel="alternate" type="text/markdown">` hint** on rendered
  product pages, pointing at the `.md` route.
- **More WebMCP.** The basics are built (see
  [WebMCP](#webmcp-an-agent-that-can-shop)); still missing: tools to remove
  or change a cart line, a production story for the polyfill and relay (they
  load in dev builds only), a Lighthouse re-run, a check of the signed-out
  and `de` paths, moving to v6 of the MCP-B packages once it is stable, and
  Angular's declarative `provideExperimentalWebMcpForms()` for the sign-in
  form.
- **Stock decrement, a stock check at add-to-cart beyond "at least one",
  and translated cart/checkout copy.**
