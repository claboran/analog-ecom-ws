import { defineEventHandler, readValidatedBody } from 'h3';
import { signInSchema, type SessionView } from '../../../../app/lib/cart-schema';
import { signIn } from '../../../lib/cart-session';

export default defineEventHandler(async (event): Promise<SessionView> => {
  const { userName } = await readValidatedBody(event, signInSchema.parse);
  return { userName: signIn(event, userName).userName };
});
