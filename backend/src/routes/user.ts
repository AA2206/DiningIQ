import express, { type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth';

export const userRouter = express.Router();

// GET /user-profile
userRouter.get('/user-profile', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { username: true, gender: true, frequency: true, height: true, weight: true, age: true, goal: true, diet: true, other: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const genderMap: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };
    const goalMap: Record<string, string> = { BUILD_MUSCLE: 'Build Muscle', LOSE_WEIGHT: 'Lose Weight', MAINTAIN_FITNESS: 'Maintain Fitness' };
    const dietMap: Record<string, string> = { OMNIVORE: 'Classic', VEGETARIAN: 'Vegetarian', VEGAN: 'Vegan' };

    return res.status(200).json({
      username: user.username,
      gender: user.gender ? genderMap[user.gender] || user.gender : null,
      frequency: user.frequency,
      height: user.height,
      weight: user.weight,
      age: user.age,
      goal: user.goal ? goalMap[user.goal] || user.goal : null,
      diet: user.diet ? dietMap[user.diet] || user.diet : null,
      other: user.other,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /update-field
userRouter.post('/update-field', authenticateJWT, async (req: Request, res: Response) => {
  const { field, selectedValue } = req.body;
  const username = (req as any).user?.username;

  if (!field || selectedValue === undefined) {
    return res.status(400).json({ error: 'Field and selectedValue are required' });
  }

  const allowedFields = ['gender', 'frequency', 'height', 'weight', 'age', 'goal', 'diet', 'other', 'mealPlan', 'mealPlanPopulated'];
  if (!allowedFields.includes(field)) {
    return res.status(400).json({ error: `Field '${field}' is not allowed to be updated` });
  }

  try {
    let valueToStore = selectedValue;

    if (field === 'gender') {
      const genderMap: Record<string, string> = { Male: 'MALE', Female: 'FEMALE', Other: 'OTHER' };
      valueToStore = genderMap[selectedValue] || selectedValue;
    } else if (field === 'goal') {
      const goalMap: Record<string, string> = {
        'Build Muscle': 'BUILD_MUSCLE',
        'Lose Weight': 'LOSE_WEIGHT',
        'Get Lean': 'LOSE_WEIGHT',
        'Maintain Fitness': 'MAINTAIN_FITNESS',
        'Improve Fitness': 'MAINTAIN_FITNESS',
      };
      valueToStore = goalMap[selectedValue] || selectedValue;

      const allowedGoalValues = new Set(['BUILD_MUSCLE', 'LOSE_WEIGHT', 'MAINTAIN_FITNESS']);
      if (!allowedGoalValues.has(valueToStore)) {
        return res.status(400).json({ error: 'Invalid goal value' });
      }
    } else if (field === 'diet') {
      const dietMap: Record<string, string> = { Classic: 'OMNIVORE', Vegetarian: 'VEGETARIAN', Vegan: 'VEGAN', Pescetarian: 'OMNIVORE' };
      valueToStore = dietMap[selectedValue] || selectedValue;
    }

    await prisma.user.update({ where: { username }, data: { [field]: valueToStore } });
    return res.status(200).json({ message: 'Value updated successfully' });
  } catch (error: any) {
    console.error('Error updating field:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /add-metrics
userRouter.post('/add-metrics', authenticateJWT, async (req: Request, res: Response) => {
  const { height, weight, age } = req.body;
  const username = (req as any).user?.username;

  if (!height || !weight || !age) {
    return res.status(400).json({ error: 'Height, weight, and age are required' });
  }

  try {
    await prisma.user.update({
      where: { username },
      data: { height: parseFloat(height), weight: parseFloat(weight), age: parseInt(age) },
    });
    return res.status(200).json({ message: 'Metrics added successfully' });
  } catch (error: any) {
    console.error('Error adding metrics:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /other
userRouter.post('/other', authenticateJWT, async (req: Request, res: Response) => {
  const { other } = req.body;
  const username = (req as any).user?.username;

  if (!other) {
    return res.status(400).json({ error: 'Additional allergy/dietary restriction information required' });
  }

  try {
    await prisma.user.update({ where: { username }, data: { other } });
    return res.status(200).json({ message: 'Value added successfully' });
  } catch (error: any) {
    console.error('Error adding other dietary restrictions/allergies:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /delete-account
userRouter.delete('/delete-account', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  try {
    await prisma.mealStats.deleteMany({ where: { username } });
    await prisma.meal.deleteMany({ where: { username } });
    await prisma.user.delete({ where: { username } });
    return res.status(200).json({ message: 'Account and all associated data deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
