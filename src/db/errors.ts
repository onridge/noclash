// Postgres SQLSTATE -> user-facing message. Only codes with an actual
// UI-facing meaning belong here — see CLAUDE.md conventions.
const POSTGRES_ERROR_MESSAGES: Record<string, string> = {
  "23P01": "That slot was just taken.", // exclusion_violation
};

// The driver (postgres.js) throws PostgresError with `.code` directly;
// Drizzle wraps that in a DrizzleQueryError with `.code` under `.cause`.
// Unwrap however deep it's nested rather than assuming one shape.
function extractPostgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  if (typeof code === "string") {
    return code;
  }
  return extractPostgresCode(cause);
}

export function mapPostgresError(error: unknown): string | null {
  const code = extractPostgresCode(error);
  return code ? (POSTGRES_ERROR_MESSAGES[code] ?? null) : null;
}
