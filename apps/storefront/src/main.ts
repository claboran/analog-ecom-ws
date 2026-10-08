import '@angular/localize/init';

import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { browserConfig } from './app/app.config.browser';

// Dev/demo only: expose the page's WebMCP tools to desktop agents.
// Angular registers tools on document.modelContext; browsers without native
// WebMCP need the polyfill first, and the relay embed then forwards the tools
// to a local MCP server (see .mcp.json).
async function enableWebMcpDemo(): Promise<void> {
  const { initializeWebMCPPolyfill } = await import('@mcp-b/webmcp-polyfill');
  initializeWebMCPPolyfill();
  const embed = document.createElement('script');
  embed.src = 'https://cdn.jsdelivr.net/npm/@mcp-b/webmcp-local-relay@5/dist/browser/embed.js';
  document.head.appendChild(embed);
}

(import.meta.env.DEV ? enableWebMcpDemo() : Promise.resolve())
  .then(() => bootstrapApplication(AppComponent, browserConfig))
  .catch((err) => console.error(err));
