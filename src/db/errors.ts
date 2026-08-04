// Postgres SQLSTATE -> user-facing message. Only codes with an actual
// UI-facing meaning belong here — see CLAUDE.md conventions.
const POSTGRES_ERROR_MESSAGES: Record<string, string> = {
  "23P01": "That slot was just taken.", // exclusion_violation
  // Two people racing to book the same slot can also resolve as a
  // deadlock rather than an exclusion violation — Postgres's deadlock
  // detector aborting one of the two transactions to break the cycle,
  // instead of the exclusion check itself rejecting the row. Confirmed
  // this actually happens under real concurrency (CI caught it, not
  // hypothetical). Unlike 23P01 this doesn't mean the slot is taken —
  // it's a transient contention error, so the message says retry.
  "40P01": "Something went wrong booking that slot — please try again.",
};

// The driver (postgres.js) throws PostgresError with `.code` directly;
// Drizzle wraps that in a DrizzleQueryError with `.code` under `.cause`.
// Unwrap however deep it's nested rather than assuming one shape.
export function extractPostgresCode(error: unknown): string | undefined {
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
