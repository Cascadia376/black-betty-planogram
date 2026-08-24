import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));
const environmentSchema = z.object({
  VITE_DATA_ADAPTER: z.enum(["mock", "supabase"]).default("mock"),
  VITE_SUPABASE_URL: optionalUrl,
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
  VITE_URSUS_MAJOR_BASE_URL: optionalUrl,
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function readEnvironment(source: Record<string, unknown> = import.meta.env): AppEnvironment {
  const result = environmentSchema.safeParse(source);
  if (!result.success) throw new Error(`Invalid application environment: ${result.error.issues.map((issue) => issue.message).join("; ")}`);
  if (result.data.VITE_DATA_ADAPTER === "supabase" && (!result.data.VITE_SUPABASE_URL || !result.data.VITE_SUPABASE_ANON_KEY)) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for the Supabase adapter.");
  }
  return result.data;
}

