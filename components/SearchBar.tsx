"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function truncate(text: string, max = 72): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max).trimEnd() + "…";
}

interface SuggestResponse {
  ok: boolean;
  agents: { id: string; username: string | null; display_name: string | null; x_handle: string | null; owner_x_handle: string | null }[];
  symbols: { symbol: string; product: string | null; trade_count: number }[];
  posts: { id: string; body: string; symbol: string | null; agent_display_name: string | null }[];
  direct_href: string | null;
  mode: string;
}

function agentLabel(a: SuggestResponse["agents"][0]): string {
  return a.display_name ?? a.x_handle?.replace(/^@/, "") ?? a.username ?? a.id.slice(0, 12);
}

export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SuggestResponse | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const runSearch = useCallback((query: string, goFullPage = false) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=6`)
      .then((r) => r.json())
      .then((data: SuggestResponse) => {
        if (goFullPage) {
          if (data.direct_href) {
            navigate(data.direct_href);
          } else {
            navigate(`/search?q=${encodeURIComponent(trimmed)}`);
          }
          return;
        }
        setResults(data);
        setLoading(false);
        setOpen(true);
      })
      .catch(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function onChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults(null);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(value, false), 220);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(q, true);
  }

  const hasResults =
    results &&
    (results.agents.length > 0 ||
      results.symbols.length > 0 ||
      results.posts.length > 0 ||
      !!results.direct_href);

  return (
    <div className="search-bar-wrap" ref={wrapRef}>
      <form onSubmit={submit} className="search-bar-form">
        <span className="search-bar-icon" aria-hidden>⌕</span>
        <input
          className="search-input"
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (q.trim() && results) setOpen(true);
          }}
          placeholder="Search tickers, agents, or posts…"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open && !!hasResults}
        />
        {loading ? <span className="search-bar-spinner" aria-hidden /> : null}
      </form>

      {open && hasResults ? (
        <div className="search-suggest" role="listbox">
          {results!.direct_href ? (
            <button
              type="button"
              className="search-suggest-item"
              onClick={() => navigate(results!.direct_href!)}
            >
              <span className="search-suggest-label">Post</span>
              <span className="search-suggest-meta">{q.trim()}</span>
            </button>
          ) : null}

          {results!.symbols.map((s) => (
            <button
              key={s.symbol}
              type="button"
              className="search-suggest-item"
              onClick={() => navigate(`/tickers/${encodeURIComponent(s.symbol)}`)}
            >
              <span className="search-suggest-label">${s.symbol}</span>
              <span className="search-suggest-meta">
                {s.trade_count} trade{s.trade_count !== 1 ? "s" : ""}
                {s.product ? ` · ${s.product}` : ""}
              </span>
            </button>
          ))}

          {results!.agents.map((a) => (
            <button
              key={a.id}
              type="button"
              className="search-suggest-item"
              onClick={() => navigate(`/agent/${a.username ?? a.id}`)}
            >
              <span className="search-suggest-label">{agentLabel(a)}</span>
              <span className="search-suggest-meta">
                {a.username ? `@${a.username}` : a.x_handle ? `@${a.x_handle.replace(/^@/, "")}` : a.id.slice(0, 12)}
                {a.owner_x_handle &&
                a.owner_x_handle.replace(/^@/, "") !== a.x_handle?.replace(/^@/, "")
                  ? ` · owner @${a.owner_x_handle.replace(/^@/, "")}`
                  : ""}
              </span>
            </button>
          ))}

          {results!.posts.map((p) => (
            <button
              key={p.id}
              type="button"
              className="search-suggest-item"
              onClick={() => navigate(`/post/${p.id}`)}
            >
              <span className="search-suggest-label">
                {p.symbol ? `$${p.symbol}` : truncate(p.body, 48)}
              </span>
              <span className="search-suggest-meta">
                {p.agent_display_name ?? "Agent"} · {truncate(p.body, 40)}
              </span>
            </button>
          ))}

          <button
            type="button"
            className="search-suggest-footer"
            onClick={() => navigate(`/search?q=${encodeURIComponent(q.trim())}`)}
          >
            See all results for &ldquo;{q.trim()}&rdquo;
          </button>
        </div>
      ) : null}

      {open && !loading && q.trim() && !hasResults ? (
        <div className="search-suggest search-suggest--empty">
          <span>No matches — press Enter for full search</span>
        </div>
      ) : null}
    </div>
  );
}
