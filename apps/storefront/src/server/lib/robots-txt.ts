// robots.txt policy for the demo (overall-goals-design.md §9).
//
// This storefront exists to be read by agents, so the default is "everything
// public is open to everyone" - but every known bot class is still named
// explicitly. That matters for two reasons: it documents intent per bot
// class, and a crawler that matches a specific `User-agent` group ignores the
// `*` group entirely (RFC 9309), so any rule added later has to live in every
// group, not just `*`.
//
// Honest limits: robots.txt is advisory. User-triggered fetchers (the
// `*-User` bots) are documented by several vendors as *not* bound by it, and
// browser-driving agents (Operator-style, Comet, Claude in Chrome, ...) send
// a plain Chrome user-agent and can't be addressed here at all. The lists are
// a snapshot of documented UA tokens, not a maintained registry.

// Flip to false to opt out of model-training crawls while still allowing
// AI search and user-triggered agents. Left true because GPTBot/ClaudeBot are
// also in the markdown-negotiation UA list (wants-markdown.ts) - disallowing
// them here would contradict that demo.
const ALLOW_TRAINING_CRAWLERS = true;

// Anything not named below (Googlebot, Bingbot, DuckDuckBot, Yandex, Baidu,
// ...) is a classic search-index crawler and falls through to `*`.
const GENERAL_CRAWLERS = ['*'];

// AI search / retrieval indexes: crawl to build an answer-engine index and
// cite the source. Not used for model training.
const AI_SEARCH_CRAWLERS = [
  'OAI-SearchBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'DuckAssistBot',
  'Applebot',
  'Amazonbot',
];

// Agentic / user-triggered fetchers: request a page because a person asked an
// assistant about it, in real time.
const AI_USER_AGENTS = [
  'ChatGPT-User',
  'Claude-User',
  'Perplexity-User',
  'MistralAI-User',
  'meta-externalfetcher',
];

// Model-training crawlers. `Google-Extended` and `Applebot-Extended` are
// robots.txt-only control tokens: they never crawl, they just tell Google and
// Apple whether already-crawled content may be used for training.
const AI_TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'CCBot',
  'Bytespider',
];

const group = (comment: string, userAgents: string[], allow: boolean): string[] => [
  `# ${comment}`,
  ...userAgents.map((userAgent) => `User-agent: ${userAgent}`),
  allow ? 'Allow: /' : 'Disallow: /',
  '',
];

export const buildRobotsTxt = (baseUrl: string): string =>
  [
    '# Analog Goods - a demo storefront built to be read by agents as well as browsers.',
    `# Agent entry points: ${baseUrl}/llms.txt and /<locale>/products/<sku>.md`,
    '',
    ...group('Search engine crawlers (non-agentic)', GENERAL_CRAWLERS, true),
    ...group('AI search and retrieval crawlers', AI_SEARCH_CRAWLERS, true),
    ...group('User-triggered AI agents and fetchers', AI_USER_AGENTS, true),
    ...group('AI model-training crawlers', AI_TRAINING_CRAWLERS, ALLOW_TRAINING_CRAWLERS),
    `Sitemap: ${baseUrl}/sitemap-products.xml`,
    '',
  ].join('\n');
