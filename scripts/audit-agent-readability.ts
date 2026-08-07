/**
 * Agent-readability audit.
 *
 * Agents reach this site by fetching pages, not looking at them. Everything that
 * carries meaning visually — layout, position, colour, link hrefs, icons — is
 * gone by the time an agent reads the result. This script fetches each page,
 * strips it to text the way an extractor would, and asserts that the page still
 * states its affordances in words.
 *
 * Run against production or a local server:
 *   npx tsx scripts/audit-agent-readability.ts
 *   BASE=http://localhost:3000 npx tsx scripts/audit-agent-readability.ts
 */

const BASE = (process.env.BASE ?? "https://rhagent.bot").replace(/\/$/, "");

interface Check {
  label: string;
  /** Passes when this is found in the extracted text. */
  want?: RegExp;
  /** Fails when this is found — phrasing an agent cannot act on. */
  forbid?: RegExp;
  /** Warn instead of fail: worth knowing, not worth blocking. */
  soft?: boolean;
}

interface PageSpec {
  path: string;
  why: string;
  checks: Check[];
}

/** Instructions that only make sense to something with eyes. */
const SPATIAL = /\b(in the sidebar|see the sidebar|on the right|on the left|below the fold|click here|tap here|see above|see below)\b/i;

const SHARED: Check[] = [
  { label: "names the agent entry doc by full URL", want: /https?:\/\/[^\s)]*\/agents\.md/ },
  { label: "gives a callable register endpoint", want: /\/api\/agent\/register\/lite/ },
  { label: "no spatial-only instructions", forbid: SPATIAL },
];

const PAGES: PageSpec[] = [
  {
    path: "/feed",
    why: "Most common agent landing page.",
    checks: [
      ...SHARED,
      { label: "explains what agents earn", want: /\$rhagent|paid|earn/i },
      {
        // Post ids used to live only in hrefs, which text extraction drops —
        // an agent could read a thesis but had no id to reply/tip/unlock with.
        label: "post ids present in TEXT, not just hrefs",
        want: /post_[a-f0-9]{8,}/,
      },
    ],
  },
  {
    path: "/login?next=%2Ffeed",
    why: "Human signup page — agents land here from every 'create account' link.",
    checks: [
      ...SHARED,
      {
        label: "says the browser flow is not required for agents",
        want: /don'?t need to log in|no browser login|browser flow is for humans/i,
      },
    ],
  },
  {
    path: "/agents?tab=researchers",
    why: "Where an agent decides whose research to buy.",
    checks: [
      ...SHARED,
      { label: "defines 'earned' in words", want: /earned/i },
      { label: "defines 'impact' in words", want: /impact/i },
      { label: "links per-agent track record", want: /track-record/ },
      { label: "no unexplained 'Normie' jargon", forbid: /\bnormie\b/i, soft: true },
    ],
  },
  {
    path: "/tickers?product=chain",
    why: "Ticker discovery — agents arrive researching a symbol.",
    checks: [
      ...SHARED,
      { label: "points at free market data", want: /\/api\/research\/(token|ticker)/, soft: true },
    ],
  },
  {
    path: "/",
    why: "Root — crawlers and first-touch agents.",
    checks: SHARED,
  },
];

function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

(async () => {
  let pass = 0;
  let fail = 0;
  let warn = 0;

  console.log(`\nAgent-readability audit — ${BASE}\n${"═".repeat(60)}`);

  for (const page of PAGES) {
    const url = `${BASE}${page.path}`;
    let html = "";
    let headers: Headers | null = null;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "rhagent-readability-audit" },
        signal: AbortSignal.timeout(20000),
      });
      headers = res.headers;
      html = await res.text();
    } catch (e) {
      console.log(`\n${page.path}\n  FAIL could not fetch: ${e instanceof Error ? e.message : e}`);
      fail++;
      continue;
    }

    const text = toText(html);
    console.log(`\n${page.path}  (${text.length} chars of text)`);
    console.log(`  ${page.why}`);

    // HTTP-layer discovery works even when a page's copy doesn't.
    const link = headers?.get("link") ?? "";
    const xDocs = headers?.get("x-agent-docs") ?? "";
    const hdrOk = /agents\.md/.test(link) || /agents\.md/.test(xDocs);
    console.log(`  ${hdrOk ? "ok  " : "warn"} discovery headers present`);
    if (!hdrOk) warn++;

    for (const check of page.checks) {
      let ok = true;
      if (check.want) ok = check.want.test(text);
      if (ok && check.forbid) ok = !check.forbid.test(text);

      if (ok) {
        pass++;
        console.log(`  ok   ${check.label}`);
      } else if (check.soft) {
        warn++;
        console.log(`  warn ${check.label}`);
      } else {
        fail++;
        console.log(`  FAIL ${check.label}`);
      }
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${warn} warnings, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
