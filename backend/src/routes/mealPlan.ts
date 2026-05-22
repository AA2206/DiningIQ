import express, { type Request, type Response } from 'express';
import { toInputJson } from '../lib/json';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth';
import { generateMealPlanForUser, modifyMealPlan } from '../services/mealPlanService';

export const mealPlanRouter = express.Router();

// GET /get-meal-plan
mealPlanRouter.get('/get-meal-plan', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  try {
    const user = await prisma.user.findUnique({ where: { username }, select: { mealPlan: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mealPlan) return res.status(204).json({ message: 'No meal plan found' });
    return res.status(200).json({ mealPlan: user.mealPlan });
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /generation-status
mealPlanRouter.get('/generation-status', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { mealPlanGenerating: true, mealPlanGeneratedAt: true, mealPlan: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({
      inProgress: user.mealPlanGenerating || false,
      startedAt: user.mealPlanGeneratedAt?.toISOString() || null,
      hasMealPlan: !!user.mealPlan,
    });
  } catch (error) {
    console.error('Error checking generation status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /generate-meal-plan
mealPlanRouter.post('/generate-meal-plan', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { mealPlanGenerating: true, mealPlan: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.mealPlan) {
      return res.status(200).json({ message: 'Meal plan already exists', mealPlan: user.mealPlan });
    }

    if (user.mealPlanGenerating) {
      const withTimestamp = await prisma.user.findUnique({ where: { username }, select: { mealPlanGeneratedAt: true } });
      return res.status(202).json({
        message: 'Meal plan generation already in progress',
        inProgress: true,
        startedAt: withTimestamp?.mealPlanGeneratedAt?.toISOString() || null,
      });
    }

    await prisma.user.update({
      where: { username },
      data: { mealPlanGenerating: true, mealPlanGeneratedAt: new Date() },
    });

    const mealPlan = await generateMealPlanForUser(username);

    await prisma.user.update({
      where: { username },
      data: { mealPlan: toInputJson(mealPlan), mealPlanGenerating: false },
    });

    return res.status(200).json({ message: 'Meal plan generated successfully', mealPlan });
  } catch (error: any) {
    console.error('Error generating meal plan:', error);
    try {
      await prisma.user.update({ where: { username }, data: { mealPlanGenerating: false } });
    } catch (e) {
      console.error('Error clearing generation flag:', e);
    }
    if (error.message === 'User not found') return res.status(404).json({ error: 'User not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /modify-meal-plan
mealPlanRouter.post('/modify-meal-plan', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;
  const { user_query } = req.body;

  if (!user_query) return res.status(400).json({ error: 'user_query is required' });

  try {
    const user = await prisma.user.findUnique({ where: { username }, select: { mealPlan: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mealPlan) return res.status(404).json({ error: 'No meal plan found. Please generate a meal plan first.' });

    const modifiedMealPlan = await modifyMealPlan(user_query, user.mealPlan);
    await prisma.user.update({ where: { username }, data: { mealPlan: toInputJson(modifiedMealPlan) } });

    return res.status(200).json({ message: 'Meal plan updated successfully', mealPlan: modifiedMealPlan });
  } catch (error) {
    console.error('Error modifying meal plan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
