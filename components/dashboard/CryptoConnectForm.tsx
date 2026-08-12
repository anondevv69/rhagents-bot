"use client";

import { useState } from "react";
import { CopyBlock, Step } from "@/components/setup-ui";
import {
  CRYPTO_CONNECT_INTRO,
  CRYPTO_PENDING_NOTE,
  RH_CRYPTO_API_PATH,
} from "@/lib/dashboard-connect-copy";

export function CryptoConnectForm({
  pending,
  pendingPublicKey,
  connected,
  busy,
  onGenerate,
  onSaveKey,
  onPastePair,
  onDisconnect,
}: {
  pending: boolean;
  pendingPublicKey: string | null;
  connected: boolean;
  busy: boolean;
  onGenerate: () => Promise<string>;
  onSaveKey: (apiKey: string) => void;
  onPastePair: (apiKey: string, privateKeyBase64: string) => void;
  onDisconnect: () => void;
}) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  const displayPublicKey = publicKey ?? pendingPublicKey;
  const showFinishSteps = pending || Boolean(displayPublicKey);

  if (connected) {
    return (
      <div className="trading-dash-actions">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="trading-dash-stack-tight">
      <p className="owner-settings-note">{CRYPTO_CONNECT_INTRO}</p>

      {!showFinishSteps ? (
        <div className="trading-dash-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => onGenerate().then(setPublicKey).catch(() => undefined)}
          >
            Generate keypair
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setAdvanced((v) => !v)}>
            {advanced ? "Hide" : "Paste an existing key pair instead"}
          </button>
        </div>
      ) : null}

      {showFinishSteps ? (
        <div className="setup-section" style={{ marginTop: 8 }}>
          {!pending ? (
            <Step n={1}>
              <p>
                <strong>Keypair generated.</strong> Private key is encrypted in this bot — never share it.
              </p>
            </Step>
          ) : null}
          <Step n={pending ? 1 : 2}>
            <p>
              On a <strong>desktop browser</strong> (Robinhood blocks mobile): open{" "}
              <strong>{RH_CRYPTO_API_PATH}</strong>.
            </p>
          </Step>
          <Step n={pending ? 2 : 3}>
            <p>
              Paste this <strong>public key</strong> into Robinhood (safe — cannot move funds):
            </p>
            {displayPublicKey ? <CopyBlock text={displayPublicKey} label="Copy public key" /> : null}
          </Step>
          <Step n={pending ? 3 : 4}>
            <p>
              Click Save in Robinhood. They show a key starting with <code>rh-api-…</code> — copy it from{" "}
              <em>their</em> page.
            </p>
            <p className="setup-note">{CRYPTO_PENDING_NOTE}</p>
          </Step>
          <Step n={pending ? 4 : 5}>
            <p>Paste the rh-api-… key below and click Save key.</p>
          </Step>
        </div>
      ) : null}

      {showFinishSteps ? (
        <form
          className="trading-dash-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSaveKey(String(fd.get("apiKey") || ""));
          }}
        >
          <label>
            rh-api-… key (from Robinhood after you save the public key)
            <input name="apiKey" type="text" placeholder="rh-api-..." required disabled={busy} autoComplete="off" />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Save key
          </button>
        </form>
      ) : null}

      {advanced ? (
        <form
          className="trading-dash-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onPastePair(String(fd.get("apiKey") || ""), String(fd.get("privateKeyBase64") || ""));
            e.currentTarget.reset();
          }}
        >
          <p className="owner-settings-note muted">
            Already generated keys elsewhere? Paste both — skips the generate step above.
          </p>
          <label>
            rh-api-… key
            <input name="apiKey" type="text" placeholder="rh-api-..." required disabled={busy} autoComplete="off" />
          </label>
          <label>
            Private key (base64)
            <input name="privateKeyBase64" type="password" required disabled={busy} autoComplete="off" />
          </label>
          <button type="submit" className="btn btn-outline" disabled={busy}>
            Save pair
          </button>
        </form>
      ) : null}
    </div>
  );
}
