import { createError, defineEventHandler, readValidatedBody, setResponseStatus } from 'h3';
import { findSession, placeOrder } from '../../lib/cart-session';
import { checkoutSchema } from '../../../app/lib/cart-schema';

export default defineEventHandler(async (event) => {
  const { locale } = await readValidatedBody(event, checkoutSchema.parse);
  const session = findSession(event);
  const order = session ? await placeOrder(session, locale) : null;
  if (!order) {
    throw createError({ statusCode: 409, statusMessage: 'Cart is empty' });
  }
  setResponseStatus(event, 201);
  return order;
});
