import { CommandFactory } from 'nest-commander';
import { AppModule } from './app/app.module';

// A one-shot CLI, not a server (overall-goals-design.md §6) - run via
// `nx run product-ingest:seed` / `nx run product-ingest:clear`.
async function bootstrap() {
  await CommandFactory.run(AppModule, ['warn', 'error']);
}

bootstrap();
