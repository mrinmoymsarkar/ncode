"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { CreateJobInput } from "@/lib/schemas";
import type { EncodeRun, Job } from "@/lib/types";

export const jobKeys = {
  all: ["jobs"] as const,
  detail: (id: string) => ["jobs", id] as const,
};

// Two worked examples to show the intended React Query pattern:
export function useJobs() {
  return useQuery({
    queryKey: jobKeys.all,
    queryFn: ({ signal }) => api.get<Job[]>("/api/jobs", signal),
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: ({ signal }) => api.get<Job>(`/api/jobs/${id}`, signal),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) => api.post<Job>("/api/jobs", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  });
}

export function useStartRun() {
  return useMutation({
    mutationFn: (jobId: string) => api.post<{ runId: string }>("/api/runs", { jobId }),
  });
}

/** Imperative one-shot fetch of a run's current state. */
export function fetchRun(runId: string) {
  return api.get<EncodeRun>(`/api/runs/${runId}`);
}
