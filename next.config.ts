import type { NextConfig } from "next";
import path from "path";

// Privy dynamically imports optional Solana / Farcaster / AA peers we don't use.
// Stub them so webpack bundles an empty module instead of `require()` externals
// (which crash in the browser) or pulling in broken transitive deps.
const PRIVY_OPTIONAL_PEERS = [
  "@farcaster/mini-app-solana",
  "@abstract-foundation/agw-client",
  "permissionless",
  "@solana/kit",
  "@solana/sysvars",
  "@solana-program/memo",
  "@solana-program/system",
  "@solana-program/token",
  "@solana-program/token-2022",
];
const privyStub = path.join(process.cwd(), "lib/privy-empty-stub.js");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    // No includeSubDomains until doc.rhagent.bot has its own cert (Railway TXT verify).
    value: "max-age=63072000",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // challenges.cloudflare.com = Privy's captcha (Turnstile).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://unavatar.io https://pbs.twimg.com https://*.privy.io",
      // auth/api.privy.io = Privy embedded-wallet auth + key ceremony endpoints.
      "connect-src 'self' https://api.x.com https://auth.privy.io https://api.privy.io https://api.stripe.com https://crypto.stripe.com wss://relay.walletconnect.com wss://relay.walletconnect.org",
      // Privy renders its secure auth/signing UI in an iframe from auth.privy.io.
      "frame-src https://auth.privy.io https://challenges.cloudflare.com https://js.stripe.com https://crypto.stripe.com",
      "child-src https://auth.privy.io",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sharp"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "unavatar.io", pathname: "/**" }],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias as Record<string, string>),
      ...Object.fromEntries(PRIVY_OPTIONAL_PEERS.map((pkg) => [pkg, privyStub])),
    };
    return webpackConfig;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      // /setup and /docs used to be near-duplicate pages — /setup is now the Setup tab on /docs.
      { source: "/setup", destination: "/docs", permanent: true },
    ];
  },
  async rewrites() {
    return [
      // Crawlers (especially X) prefer image URLs with a file extension.
      { source: "/api/og/post/:id.png", destination: "/api/og/post/:id" },
      { source: "/api/og/post/:id.jpg", destination: "/api/og/post/:id" },
      { source: "/api/og/post/:id.jpeg", destination: "/api/og/post/:id" },
    ];
  },
};

export default config;
