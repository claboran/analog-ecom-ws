import { defineEventHandler } from 'h3';
import type { SessionView } from '../../../../app/lib/cart-schema';
import { findSession } from '../../../lib/cart-session';

// Never creates a session; also what keeps a live session's cookie fresh.
export default defineEventHandler((event): SessionView => ({ userName: findSession(event)?.userName ?? null }));
