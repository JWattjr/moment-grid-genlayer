"use client";

import { applyGenLayerResolutions, type PredictionId } from "@moment-grid/scoring";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ResolverRecord } from "@/lib/genlayer-resolver";

type DemoRecord = ResolverRecord & { transaction_hash: string | null };
type DemoResponse = {
  contract_address: string;
  network: string;
  records: DemoRecord[];
  error?: string;
  technical_error?: string;
};

const DEMO_GRID: PredictionId[] = [
  "HOME_TWO_SHOTS_30",
  "CARD_30_60",
  "TWO_SUBS_AFTER_60",
  "HOME_SCORES_FIRST",
  "VAR_30_60",
  "BOTH_SCORE_FULL_TIME",
  "PENALTY_BEFORE_30",
  "PENALTY_30_60",
  "GOAL_AFTER_80",
];

function safeSources(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((source) => typeof source === "string") : [];
  } catch {
    return [];
  }
}

function phaseFor(record: DemoRecord | null) {
  if (!record) return { label: "Awaiting contract state", tone: "pending" };
  if (record.status === "SETTLED" && record.result === "TRUE") return { label: "Settled TRUE", tone: "true" };
  if (record.status === "SETTLED" && record.result === "FALSE") return { label: "Settled FALSE", tone: "false" };
  if (record.result === "INVALID") return { label: "Unable to resolve · retryable", tone: "invalid" };
  if (record.match_status === "LIVE" || record.match_status === "SCHEDULED") return { label: "Awaiting match finality", tone: "pending" };
  return { label: "Ready for resolution", tone: "ready" };
}

async function fetchDemoResponse(): Promise<DemoResponse> {
  const result = await fetch("/api/genlayer/resolutions", { cache: "no-store" });
  const payload = await result.json() as DemoResponse;
  if (!result.ok) throw new Error(payload.technical_error || payload.error || "State read failed");
  return payload;
}

export function GenLayerDemo() {
  const [response, setResponse] = useState<DemoResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [technicalError, setTechnicalError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchDemoResponse();
      setResponse(payload);
      setSelectedId((current) => current || payload.records[0]?.resolution_id || "");
    } catch (caught) {
      setError("GenLayer state is temporarily unavailable. Please retry shortly.");
      setTechnicalError(caught instanceof Error ? caught.message : "Unknown state read failure");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchDemoResponse()
      .then((payload) => {
        if (!active) return;
        setResponse(payload);
        setSelectedId(payload.records[0]?.resolution_id || "");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError("GenLayer state is temporarily unavailable. Please retry shortly.");
        setTechnicalError(caught instanceof Error ? caught.message : "Unknown state read failure");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const selected = response?.records.find((record) => record.resolution_id === selectedId)
    ?? response?.records[0]
    ?? null;
  const phase = phaseFor(selected);
  const sources = selected ? safeSources(selected.source_references_json) : [];
  const scored = useMemo(() => selected
    ? applyGenLayerResolutions(DEMO_GRID, { markedMask: 0, completedLines: 0 }, [selected])
    : { markedMask: 0, completedLines: 0 }, [selected]);
  const mappedCell = selected?.moment_type === "HOME_TEAM_SCORES_FIRST"
    ? 3
    : selected?.moment_type === "BOTH_TEAMS_SCORE_FULL_TIME"
      ? 5
      : 7;
  const cellMarked = (scored.markedMask & (1 << mappedCell)) !== 0;
  const transactionTemplate = process.env.NEXT_PUBLIC_GENLAYER_TX_URL_TEMPLATE ?? "";
  const transactionUrl = selected?.transaction_hash && transactionTemplate
    ? transactionTemplate.replace("{hash}", selected.transaction_hash)
    : "";

  return (
    <div className="genlayer-demo" data-testid="genlayer-demo">
      <section className="resolver-hero">
        <div><ShieldCheck size={20} /><span><b>Live resolver</b><small>{response?.network ?? "studionet"} · real contract state</small></span></div>
        <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={13} />{loading ? "Reading…" : "Refresh"}</button>
      </section>

      {error && (
        <section className="resolver-error" role="alert">
          <AlertTriangle size={18} /><span><b>Unable to load consensus state</b><small>{error}</small></span>
          <details><summary>Technical detail</summary><code>{technicalError}</code></details>
        </section>
      )}

      {!error && loading && <section className="resolver-loading"><Clock3 size={18} /> Reading Studionet history…</section>}

      {!error && !loading && selected && (
        <>
          <section className={`resolver-status tone-${phase.tone}`} data-testid="resolution-status">
            <span>{selected.result === "TRUE" ? <CheckCircle2 /> : selected.result === "FALSE" ? <XCircle /> : <Clock3 />}</span>
            <div><small>Current lifecycle</small><strong>{phase.label}</strong><p>{selected.status} · {selected.reason_code || "UNRESOLVED"} · {selected.match_status}</p></div>
          </section>

          <section className="resolver-match-card">
            <header><span>{selected.competition} · {selected.match_date}</span><b>{selected.home_team} <i>vs</i> {selected.away_team}</b></header>
            <div><small>Immutable criterion</small><strong>{selected.moment_statement}</strong><code>{selected.moment_type}</code></div>
          </section>

          <section className="resolver-evidence">
            <header><Database size={15} /><span><b>Consensus evidence</b><small>{selected.attempt_count} adjudication attempt{selected.attempt_count === 1 ? "" : "s"}</small></span></header>
            <p>{selected.evidence_summary || "This registered moment is waiting for an evidence-backed resolution."}</p>
            <div>{sources.map((source) => <a href={source} target="_blank" rel="noreferrer" key={source}>{new URL(source).hostname}<ExternalLink size={10} /></a>)}</div>
          </section>

          <section className="resolver-scoring" data-testid="scoring-impact" data-cell-state={cellMarked ? "marked" : "clear"}>
            <span>{cellMarked ? "CELL MARKED" : selected.result === "INVALID" || selected.result === "UNRESOLVED" ? "NO SCORE CHANGE" : "CELL CLEARED"}</span>
            <div><b>Moment Grid impact</b><small>Accepted facts enter the pure scoring adapter; LLM output never calculates lines or rewards.</small></div>
          </section>

          <details className="resolver-technical">
            <summary>Reviewer technical details</summary>
            <dl>
              <div><dt>Contract</dt><dd><code>{response?.contract_address}</code></dd></div>
              <div><dt>Resolution ID</dt><dd><code>{selected.resolution_id}</code></dd></div>
              <div><dt>Consensus</dt><dd>{selected.status === "SETTLED" ? "Accepted and stored" : "Pending / retryable"}</dd></div>
              <div><dt>Event minute</dt><dd>{selected.event_minute >= 0 ? `${selected.event_minute}′` : "No event recorded"}</dd></div>
              <div><dt>Resolved</dt><dd>{selected.resolved_at || "Not settled"}</dd></div>
              <div><dt>Transaction</dt><dd>{transactionUrl ? <a href={transactionUrl} target="_blank" rel="noreferrer">Open transaction <ExternalLink size={10} /></a> : <code>{selected.transaction_hash ?? "Available after settlement"}</code>}</dd></div>
            </dl>
          </details>
        </>
      )}

      {!error && !loading && response?.records.length === 0 && <section className="resolver-loading">No registered moments were found on the configured contract.</section>}

      {!error && !loading && (response?.records.length ?? 0) > 0 && (
        <section className="resolver-history" aria-label="GenLayer resolution history">
          <header><span>Resolution history</span><small>{response?.records.length} on-chain moments</small></header>
          {response?.records.map((record) => {
            const recordPhase = phaseFor(record);
            return <button type="button" className={record.resolution_id === selected?.resolution_id ? "is-active" : ""} onClick={() => setSelectedId(record.resolution_id)} key={record.resolution_id}>
              <span><b>{record.home_team} vs {record.away_team}</b><small>{record.moment_statement}</small></span><em className={`tone-${recordPhase.tone}`}>{record.result}</em>
            </button>;
          })}
        </section>
      )}
    </div>
  );
}
