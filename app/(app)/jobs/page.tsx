"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/client/api";
import { useCreateJob, useJobs } from "@/lib/client/hooks";
import { createJobSchema, type CreateJobInput } from "@/lib/schemas";
import { StatusBadge } from "@/components/status-badge";

export default function JobsPage() {
  const jobs = useJobs();
  const createJob = useCreateJob();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { sourceUrl: "", title: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    clearErrors();
    try {
      await createJob.mutateAsync(values);
      reset({ sourceUrl: "", title: "" });
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          const message = messages[0];
          if (message && (field === "sourceUrl" || field === "title")) {
            setError(field, { type: "server", message });
          }
        }
        return;
      }

      setError("root", {
        type: "server",
        message: error instanceof Error ? error.message : "Could not create job",
      });
    }
  });

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-xl font-semibold">New encode job</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Queue a media source. Validation is shared with the server, so the same rules apply in
            both places.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-1.5">
            <label htmlFor="sourceUrl" className="text-sm font-medium text-neutral-800">
              Source URL
            </label>
            <input
              id="sourceUrl"
              {...register("sourceUrl")}
              type="url"
              placeholder="https://cdn.example.com/videos/corrupt.mp4"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              aria-invalid={errors.sourceUrl ? "true" : "false"}
              autoComplete="off"
            />
            <p className="text-xs text-neutral-500">
              Use an HTTP(S) media URL with a path. The demo corrupt fixture is accepted here too.
            </p>
            {errors.sourceUrl && (
              <p className="text-xs text-red-600">{errors.sourceUrl.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="title" className="text-sm font-medium text-neutral-800">
              Title
            </label>
            <input
              id="title"
              {...register("title")}
              type="text"
              placeholder="Optional title"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              aria-invalid={errors.title ? "true" : "false"}
              autoComplete="off"
            />
            {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
          </div>

          {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || createJob.isPending}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting || createJob.isPending ? "Creating…" : "Create job"}
            </button>
            <p className="text-xs text-neutral-500">
              The jobs list updates automatically after a successful create.
            </p>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Jobs</h2>
          {jobs.isFetching && <p className="text-xs text-neutral-500">Refreshing…</p>}
        </div>
        {jobs.isLoading && <p className="text-sm text-neutral-500">Loading jobs…</p>}
        {jobs.isError && (
          <div className="text-sm text-red-600">
            Couldn’t load jobs (is GET /api/jobs implemented?).{" "}
            <button onClick={() => jobs.refetch()} className="underline">
              Retry
            </button>
          </div>
        )}
        {jobs.data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white/60 p-4 text-sm text-neutral-500">
            No jobs yet. Create the first encode job above.
          </p>
        )}
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {jobs.data?.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{job.title}</p>
                  <p className="truncate text-xs text-neutral-500">{job.sourceUrl}</p>
                </div>
                <StatusBadge value={job.status} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
