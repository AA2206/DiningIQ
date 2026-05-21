import express, { type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth';
import { getMealFilter } from '../lib/mealFilter';

export const mealLoggingRouter = express.Router();

const VALID_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Brunch'];

// GET /fetchAllEntrees
mealLoggingRouter.get('/fetchAllEntrees', authenticateJWT, async (req: Request, res: Response) => {
  const { diningHall, mealType } = req.query;

  if (!diningHall || !mealType) {
    return res.status(400).json({ error: 'diningHall and mealType query parameters are required' });
  }

  if (!VALID_MEAL_TYPES.includes(mealType as string)) {
    return res.status(400).json({ error: `mealType must be one of: ${VALID_MEAL_TYPES.join(', ')}` });
  }

  try {
    const entrees = await prisma.uMD_Dining.findMany({
      where: { diningHall: diningHall as string, meal: getMealFilter(mealType as string) },
      select: { id: true, entree: true, totalCalories: true, totalFat: true, totalCarbohydrate: true, protein: true },
      orderBy: { entree: 'asc' },
    });
    return res.status(200).json({ entrees });
  } catch (error) {
    console.error('Error fetching entrees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /fetch-meals
mealLoggingRouter.get('/fetch-meals', authenticateJWT, async (req: Request, res: Response) => {
  const { date } = req.query;
  const username = (req as any).user?.username;

  if (!date) {
    return res.status(400).json({ error: 'date query parameter is required (ISO string)' });
  }

  try {
    const mealDate = new Date(date as string);
    if (isNaN(mealDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO string (e.g., 2024-11-22T00:00:00Z)' });
    }

    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    const meals = await prisma.meal.findMany({
      where: { username, date: { gte: startOfDay, lte: endOfDay } },
      orderBy: { meal: 'asc' },
    });

    const mealsByType: { [key: string]: any[] } = { Breakfast: [], Lunch: [], Dinner: [], Brunch: [] };
    meals.forEach((meal: any) => {
      const mealType = meal.meal as string;
      if (mealsByType[mealType]) mealsByType[mealType].push(meal);
    });

    return res.status(200).json({ date, meals: mealsByType });
  } catch (error) {
    console.error('Error fetching meals:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /fetch-meal-stats
mealLoggingRouter.get('/fetch-meal-stats', authenticateJWT, async (req: Request, res: Response) => {
  const { date, meal } = req.query;
  const username = (req as any).user?.username;

  if (!date || !meal) {
    return res.status(400).json({ error: 'date and meal query parameters are required' });
  }

  if (!VALID_MEAL_TYPES.includes(meal as string)) {
    return res.status(400).json({ error: `meal must be one of: ${VALID_MEAL_TYPES.join(', ')}` });
  }

  try {
    const mealDate = new Date(date as string);
    if (isNaN(mealDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO string (e.g., 2024-11-22T00:00:00Z)' });
    }

    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    const mealStats = await prisma.mealStats.findFirst({
      where: { username, date: { gte: startOfDay, lte: endOfDay }, meal: meal as any },
    });

    const macros = mealStats
      ? { calories: mealStats.calories, protein: mealStats.protein, fats: mealStats.fats, carbs: mealStats.carbs }
      : { calories: 0, protein: 0, fats: 0, carbs: 0 };

    return res.status(200).json({ date, meal, macros });
  } catch (error) {
    console.error('Error fetching meal stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /increase-serving
mealLoggingRouter.put('/increase-serving', authenticateJWT, async (req: Request, res: Response) => {
  const { mealId } = req.body;
  const username = (req as any).user?.username;

  if (!mealId) return res.status(400).json({ error: 'mealId is required' });

  try {
    const meal = await prisma.meal.findFirst({ where: { id: parseInt(mealId), username } });
    if (!meal) return res.status(404).json({ error: 'Meal not found or does not belong to user' });

    const updatedMeal = await prisma.meal.update({
      where: { id: meal.id },
      data: { servingSize: meal.servingSize + 1 },
    });

    const mealDate = new Date(meal.date);
    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingStats = await prisma.mealStats.findFirst({
      where: { username, date: { gte: startOfDay, lte: endOfDay }, meal: meal.meal },
    });

    if (existingStats) {
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: existingStats.calories + meal.totalCalories,
          protein: existingStats.protein + meal.totalProtein,
          fats: existingStats.fats + meal.totalFats,
          carbs: existingStats.carbs + meal.totalCarbs,
        },
      });
    } else {
      await prisma.mealStats.create({
        data: {
          username,
          date: mealDate,
          meal: meal.meal,
          calories: meal.totalCalories,
          protein: meal.totalProtein,
          fats: meal.totalFats,
          carbs: meal.totalCarbs,
        },
      });
    }

    return res.status(200).json({ meal: updatedMeal, message: 'Serving size increased successfully' });
  } catch (error: any) {
    console.error('Error increasing serving:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Meal not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /decrease-serving
mealLoggingRouter.put('/decrease-serving', authenticateJWT, async (req: Request, res: Response) => {
  const { mealId } = req.body;
  const username = (req as any).user?.username;

  if (!mealId) return res.status(400).json({ error: 'mealId is required' });

  try {
    const meal = await prisma.meal.findFirst({ where: { id: parseInt(mealId), username } });
    if (!meal) return res.status(404).json({ error: 'Meal not found or does not belong to user' });

    if (meal.servingSize <= 1) {
      return res.status(400).json({ error: 'Serving size is already 1. Use the remove-meal endpoint to delete the meal.' });
    }

    const updatedMeal = await prisma.meal.update({
      where: { id: meal.id },
      data: { servingSize: meal.servingSize - 1 },
    });

    const mealDate = new Date(meal.date);
    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingStats = await prisma.mealStats.findFirst({
      where: { username, date: { gte: startOfDay, lte: endOfDay }, meal: meal.meal },
    });

    if (existingStats) {
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: Math.max(0, existingStats.calories - meal.totalCalories),
          protein: Math.max(0, existingStats.protein - meal.totalProtein),
          fats: Math.max(0, existingStats.fats - meal.totalFats),
          carbs: Math.max(0, existingStats.carbs - meal.totalCarbs),
        },
      });
    } else {
      console.warn(`MealStats not found for meal ${mealId} - stats may be inconsistent`);
    }

    return res.status(200).json({ meal: updatedMeal, message: 'Serving size decreased successfully' });
  } catch (error: any) {
    console.error('Error decreasing serving:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Meal not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /remove-meal
mealLoggingRouter.delete('/remove-meal', authenticateJWT, async (req: Request, res: Response) => {
  const mealId = req.body?.mealId || req.query?.mealId;
  const username = (req as any).user?.username;

  if (!mealId) return res.status(400).json({ error: 'mealId is required' });

  try {
    const meal = await prisma.meal.findFirst({ where: { id: parseInt(mealId), username } });
    if (!meal) return res.status(404).json({ error: 'Meal not found or does not belong to user' });

    const totalCalories = meal.totalCalories * meal.servingSize;
    const totalProtein = meal.totalProtein * meal.servingSize;
    const totalCarbs = meal.totalCarbs * meal.servingSize;
    const totalFats = meal.totalFats * meal.servingSize;

    const mealDate = new Date(meal.date);
    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingStats = await prisma.mealStats.findFirst({
      where: { username, date: { gte: startOfDay, lte: endOfDay }, meal: meal.meal },
    });

    await prisma.meal.delete({ where: { id: meal.id } });

    if (existingStats) {
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: Math.max(0, existingStats.calories - totalCalories),
          protein: Math.max(0, existingStats.protein - totalProtein),
          fats: Math.max(0, existingStats.fats - totalFats),
          carbs: Math.max(0, existingStats.carbs - totalCarbs),
        },
      });
    } else {
      console.warn(`MealStats not found for meal ${mealId} - stats may be inconsistent`);
    }

    return res.status(200).json({ message: 'Meal removed successfully' });
  } catch (error: any) {
    console.error('Error removing meal:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Meal not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /update-meal
mealLoggingRouter.put('/update-meal', authenticateJWT, async (req: Request, res: Response) => {
  const { mealId, mealName, mealDescription, entrees } = req.body;
  const username = (req as any).user?.username;

  if (!mealId) return res.status(400).json({ error: 'mealId is required' });
  if (!entrees || !Array.isArray(entrees) || entrees.length === 0) {
    return res.status(400).json({ error: 'entrees (non-empty array) is required' });
  }

  try {
    const existingMeal = await prisma.meal.findFirst({ where: { id: parseInt(mealId), username } });
    if (!existingMeal) return res.status(404).json({ error: 'Meal not found or does not belong to user' });

    const oldTotalCalories = existingMeal.totalCalories * existingMeal.servingSize;
    const oldTotalProtein = existingMeal.totalProtein * existingMeal.servingSize;
    const oldTotalCarbs = existingMeal.totalCarbs * existingMeal.servingSize;
    const oldTotalFats = existingMeal.totalFats * existingMeal.servingSize;

    const entreeIds = entrees.map((e: any) => (typeof e === 'object' ? e.id : e));

    const entreeData = await prisma.uMD_Dining.findMany({
      where: { id: { in: entreeIds } },
      select: { id: true, entree: true, totalCalories: true, totalFat: true, totalCarbohydrate: true, protein: true },
    });

    if (entreeData.length !== entreeIds.length) {
      const foundIds = entreeData.map((e: any) => e.id);
      const missingIds = entreeIds.filter((id: number) => !foundIds.includes(id));
      return res.status(400).json({ error: `Some entrees not found. Missing IDs: ${missingIds.join(', ')}` });
    }

    const newBaseCalories = entreeData.reduce((sum: number, e: any) => sum + e.totalCalories, 0);
    const newBaseProtein = entreeData.reduce((sum: number, e: any) => sum + e.protein, 0);
    const newBaseCarbs = entreeData.reduce((sum: number, e: any) => sum + e.totalCarbohydrate, 0);
    const newBaseFats = entreeData.reduce((sum: number, e: any) => sum + e.totalFat, 0);

    const newTotalCalories = newBaseCalories * existingMeal.servingSize;
    const newTotalProtein = newBaseProtein * existingMeal.servingSize;
    const newTotalCarbs = newBaseCarbs * existingMeal.servingSize;
    const newTotalFats = newBaseFats * existingMeal.servingSize;

    const entreesArray = entreeData.map((e: any) => ({ id: e.id, entree: e.entree }));

    const updatedMeal = await prisma.meal.update({
      where: { id: existingMeal.id },
      data: {
        mealName: mealName || existingMeal.mealName,
        mealDescription: mealDescription !== undefined ? mealDescription : existingMeal.mealDescription,
        entrees: entreesArray,
        totalCalories: newBaseCalories,
        totalProtein: newBaseProtein,
        totalCarbs: newBaseCarbs,
        totalFats: newBaseFats,
      },
    });

    const mealDate = new Date(existingMeal.date);
    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingStats = await prisma.mealStats.findFirst({
      where: { username, date: { gte: startOfDay, lte: endOfDay }, meal: existingMeal.meal },
    });

    if (existingStats) {
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: Math.max(0, existingStats.calories - oldTotalCalories + newTotalCalories),
          protein: Math.max(0, existingStats.protein - oldTotalProtein + newTotalProtein),
          fats: Math.max(0, existingStats.fats - oldTotalFats + newTotalFats),
          carbs: Math.max(0, existingStats.carbs - oldTotalCarbs + newTotalCarbs),
        },
      });
    } else {
      console.warn(`MealStats not found for meal ${mealId} - creating new stats record`);
      await prisma.mealStats.create({
        data: {
          username,
          date: mealDate,
          meal: existingMeal.meal,
          calories: newTotalCalories,
          protein: newTotalProtein,
          fats: newTotalFats,
          carbs: newTotalCarbs,
        },
      });
    }

    return res.status(200).json({ meal: updatedMeal, message: 'Meal updated successfully' });
  } catch (error: any) {
    console.error('Error updating meal:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Meal not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /verify-entrees
mealLoggingRouter.post('/verify-entrees', authenticateJWT, async (req: Request, res: Response) => {
  const { entreeNames, mealType, diningHall } = req.body;

  if (!entreeNames || !Array.isArray(entreeNames) || entreeNames.length === 0) {
    return res.status(400).json({ error: 'entreeNames (non-empty array) is required' });
  }
  if (!mealType) return res.status(400).json({ error: 'mealType is required' });
  if (!diningHall) return res.status(400).json({ error: 'diningHall is required' });
  if (!VALID_MEAL_TYPES.includes(mealType)) {
    return res.status(400).json({ error: `mealType must be one of: ${VALID_MEAL_TYPES.join(', ')}` });
  }

  try {
    const existingEntrees = await prisma.uMD_Dining.findMany({
      where: { entree: { in: entreeNames }, meal: getMealFilter(mealType), diningHall },
      select: { id: true, entree: true, meal: true, diningHall: true },
    });

    const foundNames = existingEntrees.map((e: any) => e.entree);
    const missingNames = entreeNames.filter((name: string) => !foundNames.includes(name));

    if (missingNames.length > 0) {
      return res.status(200).json({
        valid: false,
        missingNames,
        message: `Some entrees are not available for ${mealType} at ${diningHall}`,
      });
    }

    return res.status(200).json({ valid: true, message: `All entrees are available for ${mealType} at ${diningHall}` });
  } catch (error) {
    console.error('Error verifying entrees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /get-entrees-by-names
mealLoggingRouter.post('/get-entrees-by-names', authenticateJWT, async (req: Request, res: Response) => {
  const { entreeNames, mealType, diningHall } = req.body;

  if (!entreeNames || !Array.isArray(entreeNames) || entreeNames.length === 0) {
    return res.status(400).json({ error: 'entreeNames (non-empty array) is required' });
  }
  if (!mealType || !diningHall) {
    return res.status(400).json({ error: 'mealType and diningHall are required' });
  }
  if (!VALID_MEAL_TYPES.includes(mealType)) {
    return res.status(400).json({ error: `mealType must be one of: ${VALID_MEAL_TYPES.join(', ')}` });
  }

  try {
    const existingEntrees = await prisma.uMD_Dining.findMany({
      where: { entree: { in: entreeNames }, meal: getMealFilter(mealType), diningHall },
      select: { id: true, entree: true, meal: true, diningHall: true },
    });
    return res.status(200).json({ entrees: existingEntrees });
  } catch (error) {
    console.error('Error looking up entrees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /add-meal
mealLoggingRouter.post('/add-meal', authenticateJWT, async (req: Request, res: Response) => {
  const { mealName, mealDescription, mealType, date, diningHall, entrees, servingSize } = req.body;
  const username = (req as any).user?.username;

  if (!mealName || !mealType || !date || !diningHall || !entrees || !Array.isArray(entrees) || entrees.length === 0) {
    return res.status(400).json({ error: 'mealName, mealType, date, diningHall, and entrees (non-empty array) are required' });
  }
  if (!VALID_MEAL_TYPES.includes(mealType)) {
    return res.status(400).json({ error: `mealType must be one of: ${VALID_MEAL_TYPES.join(', ')}` });
  }

  const servings = servingSize ? parseInt(servingSize) : 1;
  if (servings < 1) return res.status(400).json({ error: 'servingSize must be at least 1' });

  try {
    const entreeIds: number[] = [];
    const entreeServingSizes = new Map<number, number>();

    entrees.forEach((e: any) => {
      if (typeof e === 'object' && e.id !== undefined) {
        entreeIds.push(e.id);
        entreeServingSizes.set(e.id, e.servingSize || 1);
      } else if (typeof e === 'number') {
        entreeIds.push(e);
        entreeServingSizes.set(e, 1);
      }
    });

    const entreeData = await prisma.uMD_Dining.findMany({
      where: { id: { in: entreeIds } },
      select: { id: true, entree: true, totalCalories: true, totalFat: true, totalCarbohydrate: true, protein: true },
    });

    if (entreeData.length !== entreeIds.length) {
      const foundIds = entreeData.map((e: any) => e.id);
      const missingIds = entreeIds.filter((id: number) => !foundIds.includes(id));
      return res.status(400).json({ error: `Some entrees not found. Missing IDs: ${missingIds.join(', ')}` });
    }

    const baseCalories = entreeData.reduce((sum: number, e: any) => sum + e.totalCalories * (entreeServingSizes.get(e.id) || 1), 0);
    const baseProtein = entreeData.reduce((sum: number, e: any) => sum + e.protein * (entreeServingSizes.get(e.id) || 1), 0);
    const baseCarbs = entreeData.reduce((sum: number, e: any) => sum + e.totalCarbohydrate * (entreeServingSizes.get(e.id) || 1), 0);
    const baseFats = entreeData.reduce((sum: number, e: any) => sum + e.totalFat * (entreeServingSizes.get(e.id) || 1), 0);

    const totalCalories = baseCalories * servings;
    const totalProtein = baseProtein * servings;
    const totalCarbs = baseCarbs * servings;
    const totalFats = baseFats * servings;

    const entreeNameMap = new Map(entreeData.map((e: any) => [e.id, e.entree]));
    const entreesWithNames = entrees.map((e: any) => {
      const entreeId = typeof e === 'object' ? e.id : e;
      const entreeServingSize = typeof e === 'object' && e.servingSize !== undefined ? e.servingSize : 1;
      return { id: entreeId, entree: entreeNameMap.get(entreeId) || '', servingSize: entreeServingSize };
    });

    const mealDate = new Date(date);
    const meal = await prisma.meal.create({
      data: {
        username,
        mealName,
        mealDescription: mealDescription || null,
        meal: mealType as any,
        date: mealDate,
        diningHall,
        servingSize: servings,
        entrees: entreesWithNames,
        totalCalories: baseCalories,
        totalProtein: baseProtein,
        totalCarbs: baseCarbs,
        totalFats: baseFats,
      },
    });

    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingStats = await prisma.mealStats.findFirst({
      where: { username, date: { gte: startOfDay, lt: endOfDay }, meal: mealType as any },
    });

    if (existingStats) {
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: existingStats.calories + totalCalories,
          protein: existingStats.protein + totalProtein,
          fats: existingStats.fats + totalFats,
          carbs: existingStats.carbs + totalCarbs,
        },
      });
    } else {
      await prisma.mealStats.create({
        data: { username, date: mealDate, meal: mealType as any, calories: totalCalories, protein: totalProtein, fats: totalFats, carbs: totalCarbs },
      });
    }

    return res.status(201).json({ meal, message: 'Meal added successfully' });
  } catch (error: any) {
    console.error('Error adding meal:', error);
    if (error.code === 'P2002') return res.status(409).json({ error: 'Meal already exists' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /weekly-macros
mealLoggingRouter.get('/weekly-macros', authenticateJWT, async (req: Request, res: Response) => {
  const dateParam = req.query.date as string | undefined;
  const username = (req as any).user?.username;

  try {
    const protein: number[] = new Array(7).fill(0);
    const calories: number[] = new Array(7).fill(0);
    const carbs: number[] = new Array(7).fill(0);
    const fats: number[] = new Array(7).fill(0);

    const referenceDate = dateParam ? new Date(dateParam) : new Date();
    if (isNaN(referenceDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const currentDay = referenceDate.getDay();
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const previousMonday = new Date(referenceDate);
    previousMonday.setDate(referenceDate.getDate() - daysToMonday);
    previousMonday.setHours(0, 0, 0, 0);

    const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay;
    const upcomingSunday = new Date(referenceDate);
    upcomingSunday.setDate(referenceDate.getDate() + daysToSunday);
    upcomingSunday.setHours(23, 59, 59, 999);

    const mealStatsEntries = await prisma.mealStats.findMany({
      where: { username, date: { gte: previousMonday, lte: upcomingSunday } },
      select: { date: true, calories: true, protein: true, carbs: true, fats: true },
    });

    mealStatsEntries.forEach((entry: any) => {
      const dayOfWeek = new Date(entry.date).getDay();
      const arrayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      protein[arrayIndex] += entry.protein;
      calories[arrayIndex] += entry.calories;
      carbs[arrayIndex] += entry.carbs;
      fats[arrayIndex] += entry.fats;
    });

    return res.status(200).json({ protein, calories, carbs, fats });
  } catch (error) {
    console.error('Error fetching weekly macros:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
