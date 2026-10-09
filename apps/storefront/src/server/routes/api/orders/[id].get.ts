import { createError, defineEventHandler, getRouterParam } from 'h3';
import { findSession } from '../../../lib/cart-session';

// Session-bound: another session (or no session) gets the same 404 as an
// unknown id, so order ids can't be probed.
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id');
  const order = findSession(event)?.orders.find((o) => o.id === id);
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' });
  }
  return order;
});
