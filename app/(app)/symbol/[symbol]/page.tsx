import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SymbolRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { symbol } = await params;
  const { tab } = await searchParams;
  const dest = `/tickers/${symbol}${tab ? `?tab=${tab}` : ""}`;
  redirect(dest);
}
