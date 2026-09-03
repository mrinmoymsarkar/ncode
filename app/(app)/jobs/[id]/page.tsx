"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/client/api";
import { fetchRun, jobKeys, useJob, useStartRun } from "@/lib/client/hooks";
import { useRunStream } from "@/lib/client/use-run-stream";
import type { EncodeRun } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const jobQuery = useJob(id);
  const startRun = useStartRun();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const runStream = useRunStream(activeRunId, () => {
    void queryClient.invalidateQueries({ queryKey: jobKeys.all });
    void queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
  });

  useEffect(() => {
    if (jobQuery.data?.latestRunId && !activeRunId) {
      setActiveRunId(jobQuery.data.latestRunId);
    }
  }, [activeRunId, jobQuery.data?.latestRunId]);

  const runDetailsQuery = useQuery({
    queryKey: ["runs", activeRunId] as const,
    queryFn: ({ signal }) => fetchRun(activeRunId ?? ""),
    enabled: Boolean(activeRunId) && runStream.done,
  });

  const runDetails: EncodeRun | null = runDetailsQuery.data ?? null;
  const terminalStage = runDetails?.stage ?? (runStream.done ? runStream.stage ?? null : null);
  const progressPct = runStream.stage ? runStream.progressPct : jobQuery.data?.status === "COMPLETED" ? 100 : 0;
  const log = runStream.log;
  const isRunning = Boolean(activeRunId) && !runStream.done;
  const headline = useMemo(() => {
    if (!activeRunId) return "Ready to start";
    if (runStream.error && !runStream.done) return "Stream error";
    if (runStream.done) return runStream.error ? "Run failed" : "Run complete";
    return "Encoding in progress";
  }, [activeRunId, runStream.done, runStream.error]);

  const startOrRetry = async () => {
    try {
      setScreenError(null);
      const response = await startRun.mutateAsync(id);
      setActiveRunId(response.runId);
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not start run";
      setScreenError(message);
    }
  };

  if (jobQuery.isLoading) return <p className="text-sm text-neutral-500">Loading job…</p>;
  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="text-sm text-red-600">
        Job not found.{" "}
        <Link href="/jobs" className="underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const job = jobQuery.data;

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-neutral-500 hover:underline">
        ← All jobs
      </Link>

      <div className="flex items-start justify-between gap-4 rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-neutral-900">{job.title}</h1>
          <p className="mt-1 truncate text-sm text-neutral-500">{job.sourceUrl}</p>
          <p className="mt-3 text-sm text-neutral-600">{headline}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StatusBadge value={job.status} />
          <button
            onClick={() => void startOrRetry()}
            disabled={startRun.isPending || isRunning}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {startRun.isPending
              ? "Starting…"
              : activeRunId && !runStream.done
                ? "Encoding…"
                : activeRunId && runStream.done
                  ? "Retry encode"
                  : "Start encode"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Run progress</h2>
              <p className="text-sm text-neutral-500">Live updates from the authenticated SSE stream.</p>
            </div>
            {runStream.connected ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                Live
              </span>
            ) : (
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                Idle
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div aria-live="polite" aria-label="Run progress" className="sr-only">
              {runStream.stage ?? terminalStage ?? "No active run"} {progressPct}%
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-700">
                {runStream.stage ?? terminalStage ?? "No active run"}
              </span>
              <span className="text-neutral-500">{progressPct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {runStream.error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {runStream.error}
              </p>
            )}
            {screenError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {screenError}
              </p>
            )}
            {runDetails?.result && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-medium">Encoding finished successfully.</p>
                <p className="mt-1">
                  Duration: {runDetails.result.durationSec}s. {runDetails.result.warnings.length} warning
                  {runDetails.result.warnings.length === 1 ? "" : "s"}.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Streaming log</h2>
          {log.length === 0 ? (
            <p className="text-sm text-neutral-500">Waiting for progress messages…</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {log.map((entry, index) => (
                <li
                  key={`${index}-${entry}`}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-700"
                >
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {runDetails?.result && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Results</h2>
            <p className="text-sm text-neutral-500">
              Derived from the final run record returned by the server.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Duration</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">
                {runDetails.result.durationSec}s
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Warnings</p>
              {runDetails.result.warnings.length === 0 ? (
                <p className="mt-1 text-sm text-neutral-700">No warnings.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  {runDetails.result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Label</th>
                  <th className="px-4 py-3 font-medium">Resolution</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {runDetails.result.renditions.map((rendition) => (
                  <tr key={rendition.label}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{rendition.label}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {rendition.width} × {rendition.height}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{rendition.sizeMb} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
