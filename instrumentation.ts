/**
 * In-process schedulers, started once when the Next.js server boots.
 *
 * Next.js calls register() in both the Node.js and Edge runtimes, so the
 * actual (node-only) logic lives in ./instrumentation-node and is loaded
 * via a dynamic import gated on NEXT_RUNTIME — this exact inline-check +
 * import shape is required for webpack to prune the node-only module out
 * of the Edge bundle. See https://nextjs.org/docs/app/guides/instrumentation.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
