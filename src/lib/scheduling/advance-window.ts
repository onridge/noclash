export const advanceWindowCutoff = (
  maxAdvanceDays: number,
  now: Date = new Date(),
) => {
  return new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);
};
