import type { Post } from "./db";

export type OptionType = "call" | "put";

export type OptionTradeFields = {
  instrument_kind: "option";
  underlying_symbol: string;
  option_type: OptionType;
  strike_price: string;
  expiration_date: string;
};

export type OptionTradePost = Post & Partial<OptionTradeFields>;

const OPTION_CONTRACT_SYMBOL_RE =
  /^([A-Z]{1,5})\s+\$?([\d.]+)\s*([CP]|CALL|PUT)(?:\s+(.+))?$/i;

function normalizeOptionType(raw: string | null | undefined): OptionType | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "c" || t === "call" || t === "calls") return "call";
  if (t === "p" || t === "put" || t === "puts") return "put";
  return null;
}

function normalizeStrike(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/^\$/, "");
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  return s;
}

/** Normalize expiry to YYYY-MM-DD. */
export function normalizeExpirationDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const input = raw.trim();
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!slash) return null;
  const month = slash[1].padStart(2, "0");
  const day = slash[2].padStart(2, "0");
  let year = slash[3] ? Number(slash[3]) : new Date().getFullYear();
  if (year < 100) year += 2000;
  return `${year}-${month}-${day}`;
}

export function parseOptionContractSymbol(raw: string): OptionTradeFields | null {
  const input = raw.trim();
  const m = input.match(OPTION_CONTRACT_SYMBOL_RE);
  if (!m) return null;

  const underlying = m[1].toUpperCase();
  const strike = normalizeStrike(m[2]);
  const optionType = normalizeOptionType(m[3]);
  const expiration = normalizeExpirationDate(m[4] ?? null);
  if (!strike || !optionType || !expiration) return null;

  return {
    instrument_kind: "option",
    underlying_symbol: underlying,
    option_type: optionType,
    strike_price: strike,
    expiration_date: expiration,
  };
}

function readString(body: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = body[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function readOptionType(body: Record<string, unknown>): string | null {
  const explicit = readString(body, "option_type");
  if (explicit) return explicit;
  const rawType = readString(body, "type");
  if (rawType && !["trade_fill", "trade_intent"].includes(rawType.toLowerCase())) {
    return rawType;
  }
  return null;
}

/** Build option fields from trade-post JSON (explicit fields or encoded symbol string). */
export function parseOptionTradeInput(
  body: Record<string, unknown>,
  symbolInput: string | null,
): OptionTradeFields | null {
  const kind =
    (typeof body.instrument_kind === "string" && body.instrument_kind.toLowerCase() === "option") ||
    (typeof body.instrument_type === "string" && body.instrument_type.toLowerCase() === "option")
      ? "option"
      : null;

  const fromSymbol = symbolInput ? parseOptionContractSymbol(symbolInput) : null;

  const underlying =
    readString(body, "underlying_symbol", "underlying")?.toUpperCase() ??
    fromSymbol?.underlying_symbol ??
    null;
  const optionType =
    normalizeOptionType(readOptionType(body)) ?? fromSymbol?.option_type ?? null;
  const strike =
    normalizeStrike(body.strike_price ?? body.strike) ?? fromSymbol?.strike_price ?? null;
  const expiration =
    normalizeExpirationDate(
      readString(body, "expiration_date", "expiration", "expiry", "exp"),
    ) ?? fromSymbol?.expiration_date ?? null;

  const explicitOption = kind === "option" || optionType || strike || expiration;
  if (!explicitOption && !fromSymbol) return null;
  if (!underlying || !optionType || !strike || !expiration) return null;

  return {
    instrument_kind: "option",
    underlying_symbol: underlying,
    option_type: optionType,
    strike_price: strike,
    expiration_date: expiration,
  };
}

export function isOptionTrade(post: {
  instrument_kind?: string | null;
  option_type?: string | null;
  strike_price?: string | null;
  expiration_date?: string | null;
}): boolean {
  return (
    post.instrument_kind === "option" ||
    (!!post.option_type && !!post.strike_price && !!post.expiration_date)
  );
}

function formatStrike(strike: string): string {
  const n = parseFloat(strike);
  if (!Number.isFinite(n)) return strike;
  return n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
}

function formatExpiryLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatOptionContractLabel(fields: {
  underlying_symbol?: string | null;
  option_type?: string | null;
  strike_price?: string | null;
  expiration_date?: string | null;
}): string | null {
  if (!isOptionTrade(fields as OptionTradePost)) return null;
  const underlying = fields.underlying_symbol?.toUpperCase() ?? "";
  const side = fields.option_type === "put" ? "Put" : "Call";
  const strike = formatStrike(fields.strike_price!);
  const exp = formatExpiryLabel(fields.expiration_date!);
  return `${underlying} ${strike} ${side} · exp ${exp}`;
}

export function formatOptionContractShort(fields: {
  option_type?: string | null;
  strike_price?: string | null;
  expiration_date?: string | null;
}): string | null {
  if (!fields.option_type || !fields.strike_price || !fields.expiration_date) return null;
  const side = fields.option_type === "put" ? "Put" : "Call";
  return `${formatStrike(fields.strike_price)} ${side} · ${formatExpiryLabel(fields.expiration_date)}`;
}

export function getTradeDisplaySymbol(post: OptionTradePost): string | null {
  if (isOptionTrade(post) && post.underlying_symbol) return post.underlying_symbol.toUpperCase();
  return post.symbol?.toUpperCase() ?? null;
}

export function buildOptionTradeFillBody(
  fields: OptionTradeFields,
  side: "buy" | "sell",
  quantity: string,
  price_usd: string,
): string {
  const action = side === "buy" ? "Bought" : "Sold";
  const contract = formatOptionContractLabel(fields) ?? fields.underlying_symbol;
  return `${action} ${quantity} ${contract} at $${price_usd} via Robinhood Agentic`;
}

/** Parse legacy auto bodies that accidentally included contract text. */
export function parseOptionFromTradeBody(body: string): OptionTradeFields | null {
  const m = body.match(
    /(?:Bought|Sold)\s+[\d,.]+\s+([A-Z]{1,5})\s+\$?([\d.]+)\s*([CP]|call|put)\b[^0-9]*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  );
  if (!m) return null;
  const optionType = normalizeOptionType(m[3]);
  const expiration = normalizeExpirationDate(m[4]);
  const strike = normalizeStrike(m[2]);
  if (!optionType || !expiration || !strike) return null;
  return {
    instrument_kind: "option",
    underlying_symbol: m[1].toUpperCase(),
    option_type: optionType,
    strike_price: strike,
    expiration_date: expiration,
  };
}

export function inferOptionFieldsForDisplay(post: OptionTradePost): OptionTradeFields | null {
  if (isOptionTrade(post) && post.underlying_symbol && post.option_type && post.strike_price && post.expiration_date) {
    return {
      instrument_kind: "option",
      underlying_symbol: post.underlying_symbol,
      option_type: post.option_type as OptionType,
      strike_price: post.strike_price,
      expiration_date: post.expiration_date,
    };
  }
  if (post.symbol) {
    const parsed = parseOptionContractSymbol(post.symbol);
    if (parsed) return parsed;
  }
  if (post.body) return parseOptionFromTradeBody(post.body);
  return null;
}
