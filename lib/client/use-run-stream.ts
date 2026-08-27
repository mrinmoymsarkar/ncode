"use client";

import { useEffect, useRef, useState } from "react";
import { fetchEventSource, type EventSourceMessage } from "@microsoft/fetch-event-source";
import { getAccessToken } from "@/lib/client/token-store";
import { isTerminalStage, type RunEvent, type Stage } from "@/lib/types";

export interface RunStreamState {
  stage: Stage | null;
  progressPct: number;
  log: string[];
  error: string | null;
  connected: boolean;
  done: boolean;
}

const initialState: RunStreamState = {
  stage: null,
  progressPct: 0,
  log: [],
  error: null,
  connected: false,
  done: false,
};

function appendLog(log: string[], message: string): string[] {
  if (log.at(-1) === message) return log;
  return [...log, message];
}

/**
 * Subscribes to the authenticated SSE endpoint and aborts it on unmount or run changes.
 */
export function useRunStream(runId: string | null, onTerminal?: () => void): RunStreamState {
  const [state, setState] = useState<RunStreamState>(initialState);
  const onTerminalRef = useRef(onTerminal);

  useEffect(() => {
    onTerminalRef.current = onTerminal;
  }, [onTerminal]);

  useEffect(() => {
    if (!runId) {
      setState(initialState);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setState({ ...initialState, connected: true });

    void fetchEventSource(`/api/runs/${runId}/events`, {
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${getAccessToken() ?? ""}`,
        accept: "text/event-stream",
      },
      openWhenHidden: true,
      onopen: async (response) => {
        if (!response.ok) throw new Error(`Unable to open progress stream (${response.status})`);
        if (!response.headers.get("content-type")?.includes("text/event-stream")) {
          throw new Error("Progress endpoint did not return an event stream");
        }
      },
      onmessage: (message: EventSourceMessage) => {
        if (!active || !message.data) return;
        let event: RunEvent;
        try {
          event = JSON.parse(message.data) as RunEvent;
        } catch {
          setState((current) => ({ ...current, error: "Received an invalid progress event." }));
          return;
        }
        const logMessage = event.error ? `${event.message} ${event.error}` : event.message;

        setState((current) => ({
          ...current,
          stage: event.stage,
          progressPct: event.progressPct,
          log: appendLog(current.log, logMessage),
          error: event.error ?? null,
          done: isTerminalStage(event.stage),
        }));
        if (isTerminalStage(event.stage)) onTerminalRef.current?.();
      },
      onclose: () => {
        if (active) setState((current) => ({ ...current, connected: false }));
      },
      onerror: (error: unknown) => {
        if (active && !controller.signal.aborted) {
          setState((current) => ({
            ...current,
            connected: false,
            error: error instanceof Error ? error.message : "Progress stream failed.",
          }));
        }
        throw error;
      },
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted) {
        setState((current) => ({
          ...current,
          connected: false,
          error: error instanceof Error ? error.message : "Progress stream failed.",
        }));
      }
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [runId]);

  return state;
}
