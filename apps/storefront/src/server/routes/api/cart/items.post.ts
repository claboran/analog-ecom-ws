import { createError, defineEventHandler, readValidatedBody } from 'h3';
import { addItemSchema } from '../../../../app/lib/cart-schema';
import { addItem, findSession, requireProduct, toCartView } from '../../../lib/cart-session';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, addItemSchema.parse);

  // Signing in is a separate step (POST /api/session). A missing session is
  // also what an expired one looks like, so the client treats 401 as "show
  // the login dialog again".
  const session = findSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' });
  }

  const product = await requireProduct(body.sku);
  if (!product.sizes.includes(body.size) || !product.colors.includes(body.color)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid size or color' });
  }
  if (product.stock < 1) {
    throw createError({ statusCode: 409, statusMessage: 'Out of stock' });
  }

  addItem(session, { sku: body.sku, size: body.size, color: body.color, quantity: body.quantity });
  return toCartView(session, body.locale);
});
