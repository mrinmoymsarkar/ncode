import { getRun, getRunRecord } from "@/lib/server/store";
import { error, withAuth } from "@/lib/server/http";
import { isTerminalStage, type RunEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Streams snapshots from the same time-based state machine used by GET /api/runs/:id.
 * The client uses fetch-event-source so the access token can be sent in a request header.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params;
    const record = getRunRecord(id);
    if (!record) return error(404, "Run not found");

    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    let closeStream: (() => void) | undefined;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const close = () => {
          if (closed) return;
          closed = true;
          if (timer) clearInterval(timer);
          req.signal.removeEventListener("abort", close);
          try {
            controller.close();
          } catch {
            // The client may already have disconnected.
          }
        };
        closeStream = close;

        const publish = () => {
          if (closed) return;
          const run = getRun(id);
          if (!run) {
            close();
            return;
          }

          const event: RunEvent = {
            stage: run.stage,
            progressPct: run.progressPct,
            message: messageFor(run.stage),
            ...(run.error ? { error: run.error } : {}),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          if (isTerminalStage(run.stage)) close();
        };

        req.signal.addEventListener("abort", close, { once: true });
        publish();
        if (!closed) timer = setInterval(publish, 1_000);
      },
      cancel() {
        closeStream?.();
      },
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
      },
    });
  });
}

function messageFor(stage: RunEvent["stage"]): string {
  switch (stage) {
    case "QUEUED": return "Encode queued.";
    case "DOWNLOADING": return "Downloading source media…";
    case "PROBING": return "Inspecting media properties…";
    case "TRANSCODING": return "Transcoding renditions…";
    case "PACKAGING": return "Packaging output files…";
    case "COMPLETED": return "Encode completed.";
    case "FAILED": return "Encode failed.";
  }
}
