import express, { type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { GOOGLE_OAUTH_CLIENT_IDS } from '../config/googleOAuth';
import { buildEnvHealthReport } from '../lib/envHealth';
import { prisma } from '../lib/prisma';

export const authRouter = express.Router();

const googleClient = new OAuth2Client();

type GoogleIdSource = 'env' | 'expo_env' | 'fallback';

/** Resolve Google OAuth client IDs from env, then EXPO_PUBLIC_*, then baked-in public IDs. */
function resolveGoogleClientIds(): {
  ios: string;
  web: string;
  iosSource: GoogleIdSource;
  webSource: GoogleIdSource;
} {
  const iosEnv = process.env.GOOGLE_IOS_CLIENT_ID?.trim();
  const webEnv = process.env.GOOGLE_WEB_CLIENT_ID?.trim();
  const iosExpo = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const webExpo = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

  if (iosEnv) {
    return {
      ios: iosEnv,
      web: webEnv || webExpo || GOOGLE_OAUTH_CLIENT_IDS.web,
      iosSource: 'env',
      webSource: webEnv ? 'env' : webExpo ? 'expo_env' : 'fallback',
    };
  }
  if (iosExpo) {
    return {
      ios: iosExpo,
      web: webEnv || webExpo || GOOGLE_OAUTH_CLIENT_IDS.web,
      iosSource: 'expo_env',
      webSource: webEnv ? 'env' : webExpo ? 'expo_env' : 'fallback',
    };
  }

  console.warn(
    '[auth] GOOGLE_IOS_CLIENT_ID / GOOGLE_WEB_CLIENT_ID not in process.env — using public client ID fallback. Fix Railway service variables.'
  );
  return {
    ios: GOOGLE_OAUTH_CLIENT_IDS.ios,
    web: webEnv || webExpo || GOOGLE_OAUTH_CLIENT_IDS.web,
    iosSource: 'fallback',
    webSource: webEnv ? 'env' : webExpo ? 'expo_env' : 'fallback',
  };
}

/** Audiences for Google ID tokens — iOS client and web client (Android uses web). */
function getGoogleTokenAudiences(): string[] {
  const { ios, web } = resolveGoogleClientIds();
  return [ios, web].filter((id): id is string => typeof id === 'string' && id.length > 0);
}

// GET /health/env — check Railway variables are injected (no secret values)
authRouter.get('/health/env', (_req: Request, res: Response) => {
  const { iosSource, webSource } = resolveGoogleClientIds();
  res.json({
    ...buildEnvHealthReport(),
    googleOAuth: { iosSource, webSource },
  });
});

// GET /health/google-config — safe check that Railway env vars are loaded (no secret values)
authRouter.get('/health/google-config', (_req: Request, res: Response) => {
  const { ios, web, iosSource, webSource } = resolveGoogleClientIds();
  res.json({
    iosConfigured: Boolean(ios),
    webConfigured: Boolean(web),
    audienceCount: getGoogleTokenAudiences().length,
    iosSource,
    webSource,
    googleEnvKeys: Object.keys(process.env).filter((k) =>
      /GOOGLE|EXPO_PUBLIC_GOOGLE/.test(k)
    ),
    railway: Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME),
  });
});

// POST /register
authRouter.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const userExists = await prisma.user.findUnique({ where: { username } });
    if (userExists) {
      return res.status(400).json({ error: 'Username already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { username, passcode: hashedPassword } });

    const token = jwt.sign(
      { username: user.username, id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return res.status(201).json({ token, userId: user.id });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(400).json({ error: 'Username not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passcode);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { username: user.username, id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ token, userId: user.id });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /google-auth
authRouter.post('/google-auth', async (req: Request, res: Response) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'ID token is required' });
  }

  try {
    const audiences = getGoogleTokenAudiences();

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: audiences,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const email = payload.email;
    let user = await prisma.user.findUnique({ where: { username: email } });
    let isNewUser = false;

    if (!user) {
      const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      user = await prisma.user.create({ data: { username: email, passcode: hashedPassword } });
      isNewUser = true;
    }

    const token = jwt.sign(
      { username: user.username, id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ token, userId: user.id, isNewUser });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(401).json({ error: 'Invalid Google token' });
  }
});

// POST /apple-auth
authRouter.post('/apple-auth', async (req: Request, res: Response) => {
  const { identityToken } = req.body;

  if (!identityToken) {
    return res.status(400).json({ error: 'Identity token is required' });
  }

  try {
    const claims = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_BUNDLE_ID || 'com.dietiq.app',
    });

    const appleId = claims.sub;
    if (!appleId) {
      return res.status(401).json({ error: 'Invalid Apple token' });
    }

    const username = `apple_${appleId}`;
    let user = await prisma.user.findUnique({ where: { username } });
    let isNewUser = false;

    if (!user) {
      const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      user = await prisma.user.create({ data: { username, passcode: hashedPassword } });
      isNewUser = true;
    }

    const token = jwt.sign(
      { username: user.username, id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ token, userId: user.id, isNewUser });
  } catch (err) {
    console.error('Apple auth error:', err);
    return res.status(401).json({ error: 'Invalid Apple token' });
  }
});
