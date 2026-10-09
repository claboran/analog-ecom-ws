import { defineEventHandler, getValidatedQuery } from 'h3';
import { z } from 'zod';
import { findSession, toCartView } from '../../../lib/cart-session';
import { localeSchema } from '../../../../app/lib/cart-schema';

// Never creates a session: an anonymous visitor just gets an empty cart.
export default defineEventHandler(async (event) => {
  const { locale } = await getValidatedQuery(event, z.object({ locale: localeSchema.default('en') }).parse);
  return toCartView(findSession(event), locale);
});
