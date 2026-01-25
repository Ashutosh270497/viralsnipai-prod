/**
 * Database client re-export
 *
 * Re-exports the Prisma client as 'db' for consistent usage across the app.
 */

import { prisma } from './prisma';

export const db = prisma;
