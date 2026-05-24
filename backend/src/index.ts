import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';

import { prisma } from './lib/prisma';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { mealPlanRouter } from './routes/mealPlan';
import { mealLoggingRouter } from './routes/mealLogging';

// Load .env without overriding Railway-injected variables (backend/, then repo root for EXPO_PUBLIC_*)
dotenv.config({ path: path.join(__dirname, '../.env'), override: false });
dotenv.config({ path: path.join(__dirname, '../../.env'), override: false });

const googleIos =
  process.env.GOOGLE_IOS_CLIENT_ID?.trim() ||
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const googleWeb =
  process.env.GOOGLE_WEB_CLIENT_ID?.trim() ||
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
console.log(
  `[startup] Google OAuth configured: ios=${Boolean(googleIos)} web=${Boolean(googleWeb)}`
);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', authRouter);
app.use('/', userRouter);
app.use('/', mealPlanRouter);
app.use('/', mealLoggingRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
