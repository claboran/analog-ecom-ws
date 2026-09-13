import { Module } from '@nestjs/common';
import { SeedCommand } from './commands/seed.command';
import { ClearCommand } from './commands/clear.command';

@Module({
  providers: [SeedCommand, ClearCommand],
})
export class AppModule {}
