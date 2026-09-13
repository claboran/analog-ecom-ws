import { Command, CommandRunner } from 'nest-commander';
import { clearProducts } from '@analog-ecom-ws/s3-client';

@Command({
  name: 'clear',
  description: 'Delete all product objects from S3Mock (storage is ephemeral by design - reseed with `seed`)',
})
export class ClearCommand extends CommandRunner {
  override async run(): Promise<void> {
    const deleted = await clearProducts();
    console.log(`Deleted ${deleted} object(s) from the products bucket.`);
  }
}
