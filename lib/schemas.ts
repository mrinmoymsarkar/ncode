import { z } from "zod";

export const sourceUrlSchema = z
  .string()
  .trim()
  .min(1, "Source URL is required")
  .url("Enter a valid URL")
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && url.pathname !== "/";
    } catch {
      return false;
    }
  }, "Use an HTTP(S) media URL with a path");

export const createJobSchema = z.object({
  sourceUrl: sourceUrlSchema,
  title: z
    .string()
    .trim()
    .max(80, "Keep the title under 80 characters")
    .optional()
    .or(z.literal("")),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const startRunSchema = z.object({
  jobId: z.string().min(1, "jobId is required"),
});
