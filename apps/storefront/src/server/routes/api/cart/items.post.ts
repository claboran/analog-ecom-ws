import { createError, defineEventHandler, readValidatedBody } from 'h3';
import { addItem, findSession, getOrCreateSession, requireProduct, toCartView } from '../../../lib/cart-session';
import { addItemSchema } from '../../../../app/lib/cart-schema';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, addItemSchema.parse);

  const product = await requireProduct(body.sku);
  if (!product.sizes.includes(body.size) || !product.colors.includes(body.color)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid size or color' });
  }
  if (product.stock < 1) {
    throw createError({ statusCode: 409, statusMessage: 'Out of stock' });
  }

  // The first add is what creates the session, so it must carry the name.
  const existing = findSession(event);
  if (!existing && !body.userName) {
    throw createError({ statusCode: 400, statusMessage: 'userName is required for the first add' });
  }
  const session = existing ?? getOrCreateSession(event, body.userName ?? null);

  addItem(session, { sku: body.sku, size: body.size, color: body.color, quantity: body.quantity });
  return toCartView(session, body.locale);
});
