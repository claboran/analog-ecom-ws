import { getHeader, type H3Event } from 'h3';

// Scope decision (overall-goals-design.md §9): h3/AnalogJS only, no
// attempt at framework portability. `Accept: text/markdown` is the
// primary, UA-agnostic path - the pattern list below is deliberately
// small and illustrative, not an exhaustive/current bot registry.
const AI_USER_AGENT_PATTERNS = [/GPTBot/i, /ClaudeBot/i, /PerplexityBot/i];

export const wantsMarkdown = (event: H3Event): boolean =>
  ((getHeader(event, 'accept') ?? '').includes('text/markdown')) ? true
    : AI_USER_AGENT_PATTERNS.some(
      (pattern) => pattern.test(getHeader(event, 'user-agent') ?? ''),
    );
