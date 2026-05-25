/** Railway / backend env vars to verify are injected (names only — never log values). */
export const BACKEND_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GOOGLE_IOS_CLIENT_ID',
  'GOOGLE_WEB_CLIENT_ID',
] as const;

export type BackendEnvVar = (typeof BACKEND_ENV_VARS)[number];

export type EnvVarStatus = {
  injected: boolean;
};

export type EnvHealthReport = {
  railway: boolean;
  allInjected: boolean;
  variables: Record<BackendEnvVar, EnvVarStatus>;
};

export function isEnvInjected(key: string): boolean {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildEnvHealthReport(): EnvHealthReport {
  const variables = Object.fromEntries(
    BACKEND_ENV_VARS.map((name) => [name, { injected: isEnvInjected(name) }])
  ) as Record<BackendEnvVar, EnvVarStatus>;

  return {
    railway: Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME),
    allInjected: BACKEND_ENV_VARS.every((name) => variables[name].injected),
    variables,
  };
}
