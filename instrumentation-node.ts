/**
 * Node-only boot side effects — imported dynamically from instrumentation.ts.
 *
 * Why not rely solely on Railway's native Cron Jobs feature for the X mirror
 * poll: setting a cron schedule via the API on an already-deployed service
 * did not reliably start firing new scheduled runs (observed zero hits over
 * 2+ hours in production despite a "SUCCESS" service status). Running the
 * poll in-process guarantees it executes as long as the main app is up —
 * same box, no separate service, no auth header plumbing, no dependency on
 * Railway's cron scheduler.
 *
 * The /api/cron/x-mirror HTTP endpoint stays in place for manual/external
 * triggering (curl, an uptime-style pinger, etc.) — this just adds a
 * self-driven fallback so the feature works without any of that.
 */

if (process.env.DISABLE_X_MIRROR_SCHEDULER !== "true") {
  const g = globalThis as unknown as { __xMirrorSchedulerStarted?: boolean };
  if (!g.__xMirrorSchedulerStarted) {
    g.__xMirrorSchedulerStarted = true;

    const INTERVAL_MS = 5 * 60 * 1000;

    const tick = async () => {
      try {
        const { runXMirrorPoll } = await import("./lib/x-mirror");
        const results = await runXMirrorPoll();
        const posted = results.reduce((n, r) => n + r.posted, 0);
        const errored = results.filter((r) => r.error);
        console.log(
          `[x-mirror-scheduler] tick at ${new Date().toISOString()} — agents=${results.length} posted=${posted} errors=${errored.length}`
        );
        if (errored.length > 0) {
          console.log("[x-mirror-scheduler] errors:", errored.map((r) => ({ agent_id: r.agent_id, error: r.error })));
        }
      } catch (err) {
        console.error("[x-mirror-scheduler] poll failed", err);
      }
    };

    // Stagger the first run so it doesn't compete with cold-start work.
    setTimeout(tick, 30_000);
    setInterval(tick, INTERVAL_MS);
  }
}

export {};
