/**
 * Public Google OAuth client IDs (same values as the mobile app / app.json).
 * Used only when host env vars are missing — e.g. Railway misconfiguration.
 * These are not secrets; they are embedded in the client app bundle.
 */
export const GOOGLE_OAUTH_CLIENT_IDS = {
  ios: '314360585010-told5d99b7mhc9318rpglgc9ktie66dg.apps.googleusercontent.com',
  web: '314360585010-54cfprp0koshojleni1hl7j460mkjhkf.apps.googleusercontent.com',
} as const;
