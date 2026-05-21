import { PrismaClient } from '@prisma/client';

// Single shared instance across all route files
export const prisma = new PrismaClient();
