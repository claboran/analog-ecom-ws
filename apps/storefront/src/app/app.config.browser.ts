import { mergeApplicationConfig, provideExperimentalWebMcpTools } from '@angular/core';

import { appConfig } from './app.config';
import { webMcpTools } from './webmcp-tools';

// Browser-only counterpart of app.config.server.ts.
export const browserConfig = mergeApplicationConfig(appConfig, {
  providers: [provideExperimentalWebMcpTools(webMcpTools)],
});
