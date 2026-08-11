"use client";

import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Eye,
  Flame,
  Grid3X3,
  LockKeyhole,
  RotateCcw,
  Share2,
  ShieldCheck,
  Trophy,
  Zap,
} from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyGenLayerResolutions,
  completedLineIndexes,
  EVENT_LABELS,
  MatchEvent,
  MatchEventType,
  MatchSnapshot,
  matchScore,
  PREDICTION_POOLS,
  PREDICTIONS,
  PredictionId,
  qualifiesForJackpot,
  scoreGrid,
} from "@moment-grid/scoring";
import { useGenLayerResolution, type GenLayerResolutionPhase } from "@/lib/use-genlayer-resolution";
import { genLayerResolverConfig, type ResolverRecord } from "@/lib/genlayer-resolver";
import { formatGen, MINIMUM_STAKE_GEN } from "@/lib/genlayer-game";
import { useOnchainGame } from "@/lib/use-onchain-game";
import { useMatchSource } from "@/lib/use-match-source";
import { MomentHeader, MomentNav } from "./moment-chrome";

type Screen = "build" | "lock" | "watch" | "reveal" | "reward";
type Grid = Array<PredictionId | null>;
type FeedbackCue = "tap" | "confirm" | "lock" | "event" | "reveal" | "reward";
type OnchainGame = ReturnType<typeof useOnchainGame>;

const SCREEN_ORDER: Screen[] = ["build", "lock", "watch", "reveal", "reward"];
const TIER_NAMES = ["Common", "Medium", "Rare"];
const TIER_CODES = ["C", "M", "R"];
const WINDOW_LABELS = ["0–30", "30–60", "60–90+"];

const LINE_PATHS = [
  { cells: [0, 1, 2], d: "M 16.667 16.667 L 83.333 16.667" },
  { cells: [3, 4, 5], d: "M 16.667 50 L 83.333 50" },
  { cells: [6, 7, 8], d: "M 16.667 83.333 L 83.333 83.333" },
  { cells: [0, 3, 6], d: "M 16.667 16.667 L 16.667 83.333" },
  { cells: [1, 4, 7], d: "M 50 16.667 L 50 83.333" },
  { cells: [2, 5, 8], d: "M 83.333 16.667 L 83.333 83.333" },
  { cells: [0, 4, 8], d: "M 16.667 16.667 L 83.333 83.333" },
  { cells: [2, 4, 6], d: "M 83.333 16.667 L 16.667 83.333" },
] as const;

const QUICK_GRID: PredictionId[] = [
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

export function GameShell() {
  const [screen, setScreen] = useState<Screen>("build");
  const [grid, setGrid] = useState<Grid>(() => Array(9).fill(null));
  const [pickerCell, setPickerCell] = useState<number | null>(null);
  const { snapshot, error: replayError, start: startMatch, reset: resetMatch } = useMatchSource();
  const genLayer = useGenLayerResolution();
  const onchainGame = useOnchainGame();
  const [stakeInput, setStakeInput] = useState(MINIMUM_STAKE_GEN);
  const [revealed, setRevealed] = useState(false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);

  const completeGrid = grid.every((prediction): prediction is PredictionId => prediction !== null);
  const localResult = useMemo(
    () => (completeGrid ? scoreGrid(grid as PredictionId[], snapshot.events) : { markedMask: 0, completedLines: 0 }),
    [completeGrid, grid, snapshot.events],
  );
  const result = useMemo(() => (
    onchainGame.configured
      ? localResult
      : applyGenLayerResolutions(
        grid.filter((prediction): prediction is PredictionId => prediction !== null),
        localResult,
        genLayer.record ? [genLayer.record] : [],
      )
  ), [genLayer.record, grid, localResult, onchainGame.configured]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFeedbackEnabled(window.localStorage.getItem("moment-grid-feedback") !== "off");
      setShowTutorial(!window.localStorage.getItem("moment-grid-tutorial-seen"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => { void audioContext.current?.close(); }, []);

  const playFeedback = useCallback((cue: FeedbackCue) => {
    if (!feedbackEnabled) return;

    const vibration: Record<FeedbackCue, number | number[]> = {
      tap: 12,
      confirm: [20, 25, 25],
      lock: [35, 30, 55],
      event: [20, 25, 20],
      reveal: [25, 20, 25, 20, 50],
      reward: [30, 20, 30, 20, 80],
    };
    window.navigator.vibrate?.(vibration[cue]);

    if (!("AudioContext" in window)) return;
    const context = audioContext.current ?? new AudioContext();
    audioContext.current = context;
    if (context.state === "suspended") void context.resume();
    const frequencies: Record<FeedbackCue, number[]> = {
      tap: [330],
      confirm: [392, 523],
      lock: [220, 165],
      event: [523, 659],
      reveal: [330, 440, 659],
      reward: [392, 523, 659, 784],
    };
    frequencies[cue].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * .075;
      oscillator.type = cue === "lock" ? "square" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.055, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .095);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + .11);
    });
  }, [feedbackEnabled]);

  const toggleFeedback = () => {
    const next = !feedbackEnabled;
    setFeedbackEnabled(next);
    window.localStorage.setItem("moment-grid-feedback", next ? "on" : "off");
    if (next) window.navigator.vibrate?.(18);
  };

  const closeTutorial = () => {
    window.localStorage.setItem("moment-grid-tutorial-seen", "1");
    setShowTutorial(false);
    playFeedback("confirm");
  };

  const handleEventFeedback = useCallback(() => playFeedback("event"), [playFeedback]);

  const selectPrediction = (prediction: PredictionId) => {
    if (pickerCell === null) return;
    playFeedback("tap");
    setGrid((current) => current.map((value, index) => (index === pickerCell ? prediction : value)));
    setPickerCell(null);
  };

  const startRound = async () => {
    playFeedback("lock");
    if (onchainGame.configured) {
      if (!onchainGame.entry && !(await onchainGame.enter(grid as PredictionId[], stakeInput))) return;
    } else if (!(await genLayer.lock(grid as PredictionId[]))) return;
    await startMatch();
    setScreen("watch");
  };

  const finishRound = useCallback(() => {
    playFeedback("reward");
    setScreen("reward");
  }, [playFeedback]);

  const playAgain = async () => {
    playFeedback("tap");
    await resetMatch();
    setGrid(Array(9).fill(null));
    setRevealed(false);
    setScreen("build");
  };

  return (
    <main className="app-stage theme-club">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="phone-shell">
        <MomentHeader feedbackEnabled={feedbackEnabled} onOpenTutorial={() => { playFeedback("tap"); setShowTutorial(true); }} onToggleFeedback={toggleFeedback} />
        <MomentNav />
        <Progress screen={screen} />

        <div className="screen-body" key={screen}>
          {screen === "build" && (
            <BuildScreen
              grid={grid}
              complete={completeGrid}
              onPick={(cell) => { playFeedback("tap"); setPickerCell(cell); }}
              onQuickFill={() => { playFeedback("confirm"); setGrid([...QUICK_GRID]); }}
              onContinue={() => { playFeedback("confirm"); setScreen("lock"); }}
            />
          )}
          {screen === "lock" && (
            <LockScreen grid={grid as PredictionId[]} error={onchainGame.error || genLayer.error || replayError} genLayerConfigured={genLayer.configured} phase={genLayer.phase} busy={onchainGame.busy || genLayer.busy} onchainGame={onchainGame} stakeInput={stakeInput} onStakeInput={setStakeInput} onBack={() => { playFeedback("tap"); setScreen("build"); }} onLock={startRound} />
          )}
          {screen === "watch" && <WatchScreen snapshot={snapshot} error={onchainGame.error || genLayer.error || replayError} phase={genLayer.phase} transactionHash={onchainGame.transactionHash || genLayer.transactionHash} busy={onchainGame.busy || genLayer.busy} onchain={onchainGame.configured} onEvent={handleEventFeedback} onContinue={async () => { if (onchainGame.configured) await onchainGame.refresh(); else if (!(await genLayer.resolve(grid as PredictionId[]))) return; playFeedback("confirm"); setScreen("reveal"); }} />}
          {screen === "reveal" && (
            <RevealScreen
              grid={grid as PredictionId[]}
              markedMask={result.markedMask}
              completedLines={result.completedLines}
              genLayerResolution={genLayer.record}
              genLayerPhase={genLayer.phase}
              transactionHash={genLayer.transactionHash}
              revealed={revealed}
              onReveal={() => { playFeedback("reveal"); setRevealed(true); }}
              onContinue={finishRound}
            />
          )}
          {screen === "reward" && <RewardScreen completedLines={result.completedLines} jackpotQualified={qualifiesForJackpot(result.markedMask)} resolution={genLayer.record} onchainGame={onchainGame} onAgain={playAgain} />}
        </div>

        <div className="home-indicator" />
      </section>

      {pickerCell !== null && (
        <PredictionPicker
          cell={pickerCell}
          selected={grid[pickerCell]}
          onSelect={selectPrediction}
          onClose={() => setPickerCell(null)}
        />
      )}
      {showTutorial && <FirstPlayTutorial onAdvance={() => playFeedback("tap")} onClose={closeTutorial} />}
    </main>
  );
}

function FirstPlayTutorial({ onAdvance, onClose }: { onAdvance: () => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: Grid3X3, tag: "01 · Build", title: "Fill all nine calls.", copy: "Columns are match windows. Rows are rarity tiers. Every cell needs one prediction." },
    { icon: LockKeyhole, tag: "02 · Lock", title: "Commit to your calls.", copy: "Lock the grid before the replay begins so every result is scored against the same picks." },
    { icon: Trophy, tag: "03 · Resolve", title: "Let consensus settle the moment.", copy: "GenLayer validators evaluate public evidence; deterministic scoring completes your rows, columns, and diagonals." },
  ] as const;
  const current = steps[step];
  const Icon = current.icon;
  const last = step === steps.length - 1;

  const next = () => {
    if (last) return onClose();
    onAdvance();
    setStep((value) => value + 1);
  };

  return (
    <div className="tutorial-backdrop" role="presentation">
      <section className="tutorial-card" role="dialog" aria-modal="true" aria-label="How to play Moment Grid">
        <div className="tutorial-top"><span>First match briefing</span><button type="button" onClick={onClose}>Skip</button></div>
        <div className="tutorial-visual"><span className="tutorial-orbit" /><div><Icon size={38} /></div></div>
        <span className="step-label">{current.tag}</span>
        <h2>{current.title}</h2>
        <p>{current.copy}</p>
        <div className="tutorial-dots" aria-label={`Tutorial step ${step + 1} of ${steps.length}`}>{steps.map((_, index) => <i className={index <= step ? "is-active" : ""} key={index} />)}</div>
        <button className="primary-button" type="button" onClick={next}>{last ? "Start calling" : "Next"}<ChevronRight size={18} /></button>
      </section>
    </div>
  );
}

function Progress({ screen }: { screen: Screen }) {
  const active = SCREEN_ORDER.indexOf(screen);
  return (
    <div className="progress-rail" aria-label={`Step ${active + 1} of 5: ${screen}`}>
      {SCREEN_ORDER.map((item, index) => <div key={item} className={`progress-segment ${index <= active ? "is-active" : ""}`} />)}
    </div>
  );
}

function MatchCard() {
  return (
    <div className="match-card">
      <div><span className="eyebrow">Premier League · 2 May 2023 · Emirates</span><strong>ARS <span>vs</span> CHE</strong></div>
      <div className="match-meta"><span>Studionet evidence demo</span><div className="match-window"><Clock3 size={13} /> 2 min / 90′</div></div>
    </div>
  );
}

function ResolutionLoop({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`reward-loop ${compact ? "is-compact" : ""}`} aria-label="Moment Grid resolution loop">
      <span><b>Pick</b><small>nine calls</small></span>
      <i>→</i>
      <span><b>Lock</b><small>fixed grid</small></span>
      <i>→</i>
      <span><b>Resolve</b><small>validator consensus</small></span>
      <i>→</i>
      <span className="reward-loop-ticket"><b>Score</b><small>completed lines</small></span>
    </div>
  );
}

function BuildScreen({ grid, complete, onPick, onQuickFill, onContinue }: { grid: Grid; complete: boolean; onPick: (cell: number) => void; onQuickFill: () => void; onContinue: () => void }) {
  return (
    <div className="screen-stack">
      <div className="title-row">
        <div><span className="step-label">01 · Build</span><h1>Call the match.</h1></div>
        <button className="text-button" onClick={onQuickFill}><Zap size={13} /> Quick fill</button>
      </div>
      <p className="lede">Build nine football predictions. Rows control rarity; columns decide when each call resolves.</p>
      <MatchCard />
      <ResolutionLoop compact />
      <GridBoard grid={grid} onPick={onPick} />
      <div className="privacy-note"><ShieldCheck size={16} /><span>GenLayer resolves registered moments from public evidence; line scoring stays deterministic.</span></div>
      <button className="primary-button" disabled={!complete} onClick={onContinue}>
        {complete ? "Review my grid" : `${grid.filter(Boolean).length} / 9 predictions picked`}<ChevronRight size={18} />
      </button>
    </div>
  );
}

function GridBoard({ grid, onPick, markedMask = 0, revealed = false, locked = false, showConsensus = false, lineCellOrder }: { grid: Grid; onPick?: (cell: number) => void; markedMask?: number; revealed?: boolean; locked?: boolean; showConsensus?: boolean; lineCellOrder?: number[] }) {
  return (
    <div className={`grid-board prediction-board ${locked ? "is-locked" : ""}`}>
      <div className="grid-corner" />
      {WINDOW_LABELS.map((window) => <div className="column-label" key={window}>{window}′</div>)}
      {TIER_NAMES.map((tier, row) => (
        <div className="contents" key={tier}>
          <div className={`tier-label tier-${row}`}><span>{TIER_CODES[row]}</span><small>{tier}</small></div>
          {[0, 1, 2].map((column) => {
            const cell = row * 3 + column;
            const predictionId = grid[cell];
            const definition = predictionId ? PREDICTIONS[predictionId] : null;
            const hit = (markedMask & (1 << cell)) !== 0;
            const ignitionOrder = lineCellOrder?.[cell] ?? -1;
            return (
              <button
                type="button"
                key={cell}
                className={`grid-cell prediction-cell tier-${row} ${definition ? "has-pick" : ""} ${revealed && hit ? "is-hit" : ""} ${revealed && !hit ? "is-miss" : ""} ${ignitionOrder >= 0 ? "is-line-cell" : ""}`}
                style={({
                  "--cell-index": cell,
                  ...(ignitionOrder >= 0 ? { "--line-order": ignitionOrder } : {}),
                }) as CSSProperties}
                onClick={() => onPick?.(cell)}
                disabled={!onPick}
                aria-label={`${tier}, ${WINDOW_LABELS[column]}: ${definition?.label ?? "empty"}`}
              >
                {locked && !revealed ? (
                  <><LockKeyhole size={17} /><small>Locked</small></>
                ) : definition ? (
                  <>
                    <span className="prediction-copy"><strong>{definition.label}</strong><small>{definition.deadline}</small></span>
                    {showConsensus && <ConsensusMeter support={definition.support} tier={row} />}
                    {revealed && <span className="result-dot">{hit ? <Check size={10} /> : "×"}</span>}
                  </>
                ) : (
                  <><span className="plus">+</span><small>Choose</small></>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ConsensusMeter({ support, tier }: { support: number; tier: number }) {
  const filledDots = Math.max(1, Math.min(5, Math.ceil(support / 20)));
  return (
    <span className={`consensus-meter meter-tier-${tier}`} aria-label={`${support}% crowd support`}>
      <span className="consensus-dots" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => <i className={index < filledDots ? "is-filled" : ""} key={index} />)}
      </span>
      <b>{support}%</b>
    </span>
  );
}

function LockScreen({ grid, error, genLayerConfigured, phase, busy, onchainGame, stakeInput, onStakeInput, onBack, onLock }: { grid: PredictionId[]; error: string; genLayerConfigured: boolean; phase: GenLayerResolutionPhase; busy: boolean; onchainGame: OnchainGame; stakeInput: string; onStakeInput: (value: string) => void; onBack: () => void; onLock: () => void }) {
  return (
    <div className="screen-stack">
      <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Edit grid</button>
      <div><span className="step-label">02 · Lock</span><h1>Commit to your calls.</h1></div>
      <p className="lede">Predictions cannot change after the replay begins. Registered match moments are verified before play.</p>
      <ResolutionJourney stage="locked" />
      {onchainGame.configured ? (
        <div className="stake-card" aria-label="On-chain stake allocation">
          <header><span>Stake on Bradbury</span><label><input aria-label="Stake in GEN" inputMode="decimal" min="10" step="1" value={stakeInput} onChange={(event) => onStakeInput(event.target.value)} /><b>GEN</b></label></header>
          <div><span><i className="tier-common" />Common pools</span><b>1.5 GEN / 15%</b></div>
          <div><span><i className="tier-medium" />Medium pools</span><b>3 GEN / 30%</b></div>
          <div><span><i className="tier-rare" />Rare pools</span><b>4.5 GEN / 45%</b></div>
          <div><span><Trophy size={13} />Jackpot</span><b>0.5 GEN / 5%</b></div>
          <div><span><ShieldCheck size={13} />Protocol</span><b>0.5 GEN / 5%</b></div>
          <p>Figures shown per 10 GEN. Larger stakes scale every allocation proportionally.</p>
        </div>
      ) : (
        <div className="privacy-proof" aria-label="GenLayer resolution path">
          <div><ShieldCheck size={18} /><span><b>Registered criterion</b><small>A precise football moment and evidence policy are stored on Studionet</small></span></div>
          <div><span><b>Validator consensus</b><small>Independent validators evaluate public match sources</small></span><em>GENLAYER</em></div>
          <div><span><b>Deterministic score</b><small>The finalized result maps back to the matching grid cell</small></span><em>TRUE / FALSE</em></div>
          <p>One adjudication record · reusable by any application</p>
        </div>
      )}
      <GridBoard grid={grid} locked />
      <div className="lock-card"><div className="lock-icon"><LockKeyhole size={20} /></div><div><strong>{onchainGame.configured ? "One signed entry, nine live pools" : "Grid fixed for this replay"}</strong><p>{onchainGame.configured ? "The payable transaction stores your grid and allocates your GEN on-chain." : "Your nine selections are now the immutable scoring input."}</p></div></div>
      {onchainGame.configured && <div className="privacy-note"><ShieldCheck size={16} /><span>Jackpot requires a correct horizontal row plus a correct diagonal · {onchainGame.config.network}.</span></div>}
      {!onchainGame.configured && genLayerConfigured && genLayerResolverConfig.moment && grid.includes(genLayerResolverConfig.moment.prediction_id as PredictionId) && <div className="privacy-note"><ShieldCheck size={16} /><span>{genLayerResolverConfig.moment.moment_statement} is pre-registered on {genLayerResolverConfig.network} · {phase === "READY" ? "ready" : "verified at lock"}.</span></div>}
      {error && <p className="error-message">{error}</p>}
      <button className="primary-button pulse-button" onClick={onLock} disabled={busy}>{busy ? (onchainGame.configured ? "Signing Bradbury entry…" : "Checking GenLayer registration…") : onchainGame.entry ? "Entry secured · start replay" : onchainGame.configured ? `Stake ${stakeInput || "0"} GEN & lock` : "Lock & start replay"} <LockKeyhole size={17} /></button>
    </div>
  );
}

function WatchScreen({ snapshot, error, phase, transactionHash, busy, onchain, onEvent, onContinue }: { snapshot: MatchSnapshot; error: string; phase: GenLayerResolutionPhase; transactionHash: `0x${string}` | null; busy: boolean; onchain: boolean; onEvent: (event: MatchEvent) => void; onContinue: () => void | Promise<void> }) {
  const [reaction, setReaction] = useState<MatchEvent | null>(null);
  const previousEventCount = useRef(snapshot.events.length);
  const minute = Math.min(90, Math.floor(snapshot.virtualMinute));
  const seconds = minute === 90 ? 0 : Math.floor((snapshot.virtualMinute % 1) * 60);
  const activeWindow = Math.min(2, Math.floor(snapshot.virtualMinute / 30));
  const score = matchScore(snapshot.events);
  const eventCount = snapshot.events.length;
  const latestEvent = eventCount > 0 ? snapshot.events[eventCount - 1] : null;
  const latestEventMinute = latestEvent?.minute;
  const latestEventType = latestEvent?.eventType;

  useEffect(() => {
    if (eventCount <= previousEventCount.current || latestEventMinute === undefined || latestEventType === undefined) return;
    previousEventCount.current = eventCount;
    const newest: MatchEvent = { minute: latestEventMinute, eventType: latestEventType };
    onEvent(newest);
    const majorMoment = ["HOME_GOAL", "AWAY_GOAL", "SUBSTITUTE_GOAL", "YELLOW_CARD", "RED_CARD", "PENALTY_AWARDED", "VAR_REVIEW", "GOAL_OVERTURNED"].includes(newest.eventType);
    if (!majorMoment) return;
    const showTimer = window.setTimeout(() => setReaction(newest), 0);
    const hideTimer = window.setTimeout(() => setReaction(null), 1450);
    return () => { window.clearTimeout(showTimer); window.clearTimeout(hideTimer); };
  }, [eventCount, latestEventMinute, latestEventType, onEvent]);

  const reactionTone = reaction && ["HOME_GOAL", "AWAY_GOAL", "SUBSTITUTE_GOAL"].includes(reaction.eventType) ? "goal" : reaction && ["YELLOW_CARD", "RED_CARD", "PENALTY_AWARDED", "VAR_REVIEW"].includes(reaction.eventType) ? "alert" : "pulse";
  return (
    <div className="screen-stack watch-screen">
      {reaction && <div className={`match-reaction reaction-${reactionTone}`} role="status" aria-live="assertive"><span>{Math.floor(reaction.minute)}′</span><div className="reaction-glyph"><EventGlyph eventType={reaction.eventType} /></div><strong>{EVENT_LABELS[reaction.eventType]}</strong><small>Match moment</small></div>}
      <div className="watch-head"><div><span className="step-label live-label"><span /> Live replay</span><h1>{minute}:{String(seconds).padStart(2, "0")}</h1></div><div className="score-bug" aria-label={`Arsenal ${score.home}, Chelsea ${score.away}`}><span>ARS</span><strong>{score.home}—{score.away}</strong><span>CHE</span></div></div>
      <div className="timeline">
        {WINDOW_LABELS.map((window, index) => (
          <div className={`timeline-window ${index < activeWindow || snapshot.phase === "complete" ? "is-done" : ""} ${index === activeWindow && snapshot.phase !== "complete" ? "is-live" : ""}`} key={window}>
            <span>{window}′</span><div><i style={{ width: index === activeWindow ? `${Math.min(100, ((snapshot.virtualMinute - index * 30) / 30) * 100)}%` : undefined }} /></div>
          </div>
        ))}
      </div>
      <div className="sealed-panel"><div className="sealed-orbit"><LockKeyhole size={26} /><span /></div><strong>Your predictions are locked</strong><p>Conditions resolve across all 90 minutes. The registered criterion is settled after full time.</p></div>
      <div className="feed-section"><div className="section-heading"><span>Match pulse</span><small>{snapshot.events.length} events</small></div><div className="event-feed">{snapshot.events.length === 0 && <div className="empty-event">Waiting for kickoff…</div>}{[...snapshot.events].reverse().slice(0, 4).map((event, index) => <EventRow event={event} newest={index === 0} key={`${event.minute}-${event.eventType}`} />)}</div></div>
      {transactionHash && <div className="privacy-note"><ShieldCheck size={16} /><span>{onchain ? "Bradbury entry" : "Studionet transaction"} {transactionHash.slice(0, 10)}…{transactionHash.slice(-6)} · {onchain ? "accepted" : phase.toLowerCase()}</span></div>}
      {error && <p className="error-message">{error}</p>}
      {snapshot.phase === "complete" ? <button className="primary-button" onClick={onContinue} disabled={busy}>{busy ? "Reading GenLayer state…" : onchain ? "Full time · preview result" : "Full time · resolve & reveal"} <Eye size={18} /></button> : <div className="countdown"><Clock3 size={14} /> {Math.ceil(snapshot.remainingSeconds)}s until reveal</div>}
    </div>
  );
}

function EventRow({ event, newest }: { event: MatchEvent; newest: boolean }) {
  return (
    <div className={`event-row ${newest ? "is-new" : ""}`}><span className="event-minute">{Math.floor(event.minute)}′</span><span className="event-glyph"><EventGlyph eventType={event.eventType} /></span><strong>{EVENT_LABELS[event.eventType]}</strong>{newest && <small>just now</small>}</div>
  );
}

function EventGlyph({ eventType }: { eventType: MatchEventType }) {
  const glyphs: Record<MatchEventType, string> = {
    HOME_SHOT: "◎", AWAY_SHOT: "◎", HOME_GOAL: "✦", AWAY_GOAL: "✦", CORNER: "⌞", YELLOW_CARD: "▯", RED_CARD: "▮", VAR_REVIEW: "V", GOAL_OVERTURNED: "×", PENALTY_AWARDED: "◉", SUBSTITUTION: "⇄", SUBSTITUTE_GOAL: "★", EXTRA_TIME: "+",
  };
  return <span className="moment-glyph">{glyphs[eventType]}</span>;
}

function RevealScreen({ grid, markedMask, completedLines, genLayerResolution, genLayerPhase, transactionHash, revealed, onReveal, onContinue }: { grid: PredictionId[]; markedMask: number; completedLines: number; genLayerResolution: ResolverRecord | null; genLayerPhase: GenLayerResolutionPhase; transactionHash: `0x${string}` | null; revealed: boolean; onReveal: () => void; onContinue: () => void }) {
  const lineIndexes = revealed ? completedLineIndexes(markedMask) : [];
  const lineCellOrder = Array<number>(9).fill(-1);
  lineIndexes.forEach((lineIndex, order) => {
    LINE_PATHS[lineIndex].cells.forEach((cell) => {
      if (lineCellOrder[cell] === -1) lineCellOrder[cell] = order;
    });
  });

  return (
    <div className="screen-stack reveal-screen">
      <div><span className="step-label">04 · Reveal</span><h1>{revealed ? "The crowd called it." : "Ready for the truth?"}</h1></div>
      <p className="lede">Five-dot meters show how strongly the locked crowd backed each prediction.</p>
      <ResolutionJourney stage={revealed ? "resolved" : "locked"} />
      {genLayerResolution?.status === "SETTLED" && <GenLayerResolutionProof resolution={genLayerResolution} phase={genLayerPhase} transactionHash={transactionHash} />}
      <div className={`reveal-wrap ${revealed ? "is-revealed" : ""}`}>
        <GridBoard grid={grid} locked={!revealed} revealed={revealed} markedMask={markedMask} showConsensus={revealed} lineCellOrder={lineCellOrder} />
        {revealed && <LineIgnitionOverlay lineIndexes={lineIndexes} />}
        {!revealed && <div className="reveal-scrim"><LockKeyhole size={28} /><span>Locked grid</span></div>}
      </div>
      {revealed && <div className="consensus-key"><span><i className="is-filled" />○○○○ Contrarian</span><span><i className="is-filled" /><i className="is-filled" /><i className="is-filled" /><i className="is-filled" /><i className="is-filled" /> Crowd favorite</span></div>}
      {revealed && <div className="line-result"><div><Flame size={22} /><span><strong>{completedLines}</strong> {completedLines === 1 ? "line" : "lines"} complete</span></div><small>Equal scoring</small></div>}
      <button className="primary-button" onClick={revealed ? onContinue : onReveal}>{revealed ? "View round result" : "Reveal predictions"}{revealed ? <Trophy size={18} /> : <Eye size={18} />}</button>
    </div>
  );
}

function GenLayerResolutionProof({ resolution, phase, transactionHash }: { resolution: ResolverRecord; phase: GenLayerResolutionPhase; transactionHash: `0x${string}` | null }) {
  const outcome = resolution.result === "TRUE" ? "Won" : resolution.result === "FALSE" ? "Lost" : "Unable to resolve";
  const sources = JSON.parse(resolution.source_references_json) as string[];
  return (
    <div className="privacy-proof" aria-label="GenLayer match moment resolution">
      <div><ShieldCheck size={18} /><span><b>GenLayer consensus · {outcome}</b><small>{resolution.moment_statement}</small></span></div>
      <div><span><b>{resolution.match_status} · {resolution.event_minute >= 0 ? `${resolution.event_minute}′` : "no event"}</b><small>{resolution.evidence_summary}</small></span><em>{phase}</em></div>
      <p>{genLayerResolverConfig.network} · {resolution.reason_code} · {resolution.resolved_at}{transactionHash ? ` · ${transactionHash.slice(0, 10)}…${transactionHash.slice(-6)}` : ""}</p>
      <p>{sources.map((source) => new URL(source).hostname).join(" + ")}</p>
    </div>
  );
}

function LineIgnitionOverlay({ lineIndexes }: { lineIndexes: number[] }) {
  if (lineIndexes.length === 0) return null;

  return (
    <div className="line-ignition-layer" aria-hidden="true">
      <svg className="line-ignition-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {lineIndexes.map((lineIndex, order) => {
          const line = LINE_PATHS[lineIndex];
          const delay = order * 0.78;
          return (
            <g key={lineIndex} style={{ "--line-order": order } as CSSProperties}>
              <path className="line-route" d={line.d} pathLength="1" />
              <path className="line-complete" d={line.d} pathLength="1" />
              <circle className="line-spark" cx="0" cy="0" r="2.1" style={{ "--line-order": order } as CSSProperties}>
                <animateMotion path={line.d} begin={`${delay + 0.08}s`} dur="0.62s" fill="freeze" />
              </circle>
            </g>
          );
        })}
      </svg>
      <div className="line-result-cues">
        {lineIndexes.map((lineIndex, order) => (
          <span key={lineIndex} style={{ "--line-order": order } as CSSProperties}>Line complete <b>verified</b></span>
        ))}
      </div>
    </div>
  );
}

function ResolutionJourney({ stage }: { stage: "draft" | "locked" | "resolved" }) {
  const active = { draft: 0, locked: 1, resolved: 2 }[stage];
  const stages = [
    { label: "Draft", icon: Grid3X3 },
    { label: "Locked", icon: LockKeyhole },
    { label: "Resolved", icon: ShieldCheck },
  ];
  return (
    <div className="privacy-journey" aria-label={`Grid resolution status: ${stage}`}>
      {stages.map(({ label, icon: Icon }, index) => <div className={`${index < active ? "is-done" : ""} ${index === active ? "is-current" : ""}`} key={label}><span><Icon size={12} /></span><small>{label}</small></div>)}
    </div>
  );
}

function RewardScreen({ completedLines, jackpotQualified, resolution, onchainGame, onAgain }: { completedLines: number; jackpotQualified: boolean; resolution: ResolverRecord | null; onchainGame: OnchainGame; onAgain: () => void }) {
  const [shareStatus, setShareStatus] = useState("Share result");

  const shareResult = async () => {
    const text = `I completed ${completedLines} ${completedLines === 1 ? "line" : "lines"} in Moment Grid with a GenLayer-resolved match moment.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Moment Grid result", text, url: window.location.origin });
        setShareStatus("Shared!");
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        setShareStatus("Copied!");
      }
    } catch {
      setShareStatus("Share result");
    }
  };

  return (
    <div className="screen-stack reward-screen">
      <div className="reward-burst"><span /><div><Trophy size={36} /></div></div>
      <div className="reward-copy"><span className="step-label">05 · Result</span><h1>{completedLines > 0 ? "Lines secured." : "Next call wins."}</h1><p>{completedLines > 0 ? `You completed ${completedLines} ${completedLines === 1 ? "line" : "lines"} across the match.` : "No complete line this time. Build a new grid and try another set of calls."}</p></div>
      <ResolutionLoop />
      {onchainGame.configured && <OnchainRoundPanel game={onchainGame} previewJackpotQualified={jackpotQualified} />}
      <div className="proof-card"><span>GenLayer proof</span><div><strong>{resolution?.status === "SETTLED" ? `${resolution.result} · ${resolution.reason_code}` : "Demo resolution"}</strong><small>{resolution?.status === "SETTLED" ? resolution.evidence_summary : "The reviewer page exposes the full reusable adjudication record."}</small></div></div>
      <button className="share-result-button" type="button" onClick={shareResult}><Share2 size={16} />{shareStatus}</button>
      <button className="primary-button" onClick={onAgain}>Build another grid <RotateCcw size={17} /></button>
      <p className="replay-footnote">Full-match replay · permissionless GenLayer resolution</p>
    </div>
  );
}

function OnchainRoundPanel({ game, previewJackpotQualified }: { game: OnchainGame; previewJackpotQualified: boolean }) {
  const round = game.round;
  const entry = game.entry;
  const canClaim = Boolean(entry && !entry.claimed && entry.claimable > 0n);
  return (
    <section className="onchain-round-card" aria-label="Bradbury game position">
      <header><span>Bradbury position</span><b>{round?.status ?? "LOADING"}</b></header>
      <dl>
        <div><dt>Your stake</dt><dd>{entry ? `${formatGen(entry.stake_amount)} GEN` : "No entry found"}</dd></div>
        <div><dt>Jackpot</dt><dd>{round ? `${formatGen(round.jackpot_pool)} GEN` : "—"}</dd></div>
        <div><dt>Your preview</dt><dd>{previewJackpotQualified ? "Horizontal + diagonal" : "Not jackpot-qualified"}</dd></div>
        <div><dt>Claimable</dt><dd>{entry ? `${formatGen(entry.claimable)} GEN` : "—"}</dd></div>
      </dl>
      {round?.status === "OPEN" && <button type="button" onClick={() => void game.resolve()} disabled={game.busy}>Resolve final match evidence</button>}
      {round?.status === "OPEN" && <p>Entries lock {new Date(round.lock_at).toLocaleString()}. The contract accepts resolution only after lock.</p>}
      {round?.status === "SCORING" && <button type="button" onClick={() => void game.process()} disabled={game.busy}>Process jackpot scoring batch</button>}
      {(round?.status === "SETTLED" || round?.status === "REFUNDING") && canClaim && <button type="button" onClick={() => void game.claim()} disabled={game.busy}>Claim {formatGen(entry!.claimable)} GEN</button>}
      <button className="onchain-refresh" type="button" onClick={() => void game.refresh()} disabled={game.busy}>Refresh chain state</button>
      {game.transactionHash && <p>Transaction {game.transactionHash.slice(0, 10)}…{game.transactionHash.slice(-6)} accepted.</p>}
      {game.error && <p className="error-message">{game.error}</p>}
    </section>
  );
}

function PredictionPicker({ cell, selected, onSelect, onClose }: { cell: number; selected: PredictionId | null; onSelect: (prediction: PredictionId) => void; onClose: () => void }) {
  const tier = Math.floor(cell / 3);
  const column = cell % 3;
  const pool = PREDICTION_POOLS[tier][column];
  return (
    <div className="picker-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="picker-sheet" role="dialog" aria-modal="true" aria-label="Choose a prediction">
        <div className="picker-handle" />
        <div className="picker-heading"><div><span className="step-label">{TIER_NAMES[tier]} · {WINDOW_LABELS[column]}′</span><h2>Choose your call</h2></div><button onClick={onClose}>×</button></div>
        <p className="picker-privacy">Crowd backing unlocks after all grids are sealed.</p>
        <div className="picker-options">
          {pool.map((predictionId) => {
            const definition = PREDICTIONS[predictionId];
            return <button className={selected === predictionId ? "selected" : ""} key={predictionId} onClick={() => onSelect(predictionId)}><span className={`prediction-swatch tier-${tier}`}><CircleDot size={16} /></span><div><strong>{definition.label}</strong><small>{definition.deadline}</small></div>{selected === predictionId && <Check size={17} />}</button>;
          })}
        </div>
      </div>
    </div>
  );
}
