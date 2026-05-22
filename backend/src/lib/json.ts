/** Coerce arbitrary objects (e.g. Zod/AI output) into a plain JSON value for Prisma Json fields. */
export function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
