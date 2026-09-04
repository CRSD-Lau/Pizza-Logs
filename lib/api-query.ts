import { z } from "zod";

const integer = (fallback: number, max: number, min = 0) => z.string()
  .regex(/^\d{1,8}$/).transform(Number).pipe(z.number().int().min(min).max(max))
  .optional().default(fallback);
const filter = z.string().min(1).max(128).optional();

export const EncounterQuerySchema = z.object({
  take: integer(50, 200, 1), skip: integer(0, 10_000),
  boss: filter, player: filter, difficulty: filter,
  outcome: z.enum(["KILL", "WIPE", "UNKNOWN"]).optional(),
});
export const LeaderboardQuerySchema = z.object({
  take: integer(25, 100, 1), boss: filter, difficulty: filter,
  metric: z.enum(["dps", "hps"]).optional().default("dps"),
});
