import { defineEventHandler, setResponseStatus } from 'h3';
import { signOut } from '../../../lib/cart-session';

export default defineEventHandler((event) => {
  signOut(event);
  setResponseStatus(event, 204);
  return null;
});
