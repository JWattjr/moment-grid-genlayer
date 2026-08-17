"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { genLayerGameConfig } from "@/lib/genlayer-game";

export type GuideStep =
  | "pick"
  | "choose"
  | "fill"
  | "review"
  | "stake"
  | "sign"
  | "accepting"
  | "secured"
  | "claim"
  | "complete";

type GuideDefinition = {
  target?: string;
  title: string;
  copy: string;
  position: number;
};

const GUIDE_STEPS: Record<GuideStep, GuideDefinition> = {
  pick: {
    target: "pick-cell",
    title: "Choose your first square",
    copy: "Click the highlighted square. You will choose one match event for it.",
    position: 1,
  },
  choose: {
    target: "prediction-option",
    title: "Choose a prediction",
    copy: "Pick the event you think will happen. The guide will wait for your choice.",
    position: 2,
  },
  fill: {
    target: "random-fill",
    title: "Complete the grid",
    copy: "Click Random fill to complete the other eight squares quickly. You can edit them afterwards.",
    position: 3,
  },
  review: {
    target: "review-grid",
    title: "Review your nine picks",
    copy: "Your grid is complete. Click Review my grid to check it before staking.",
    position: 4,
  },
  stake: {
    target: "review-stake",
    title: "Review the stake",
    copy: "Check the amount and how it is shared across the nine pools, then click the highlighted button.",
    position: 5,
  },
  sign: {
    target: "sign-entry",
    title: "Sign when you are ready",
    copy: "Click the highlighted button to open your wallet. You decide whether to approve or reject the transaction.",
    position: 6,
  },
  accepting: {
    target: "sign-entry",
    title: "Complete the wallet request",
    copy: "Review the request in your wallet and approve it if you want to enter. We will wait for the real result.",
    position: 6,
  },
  secured: {
    target: "entry-secured",
    title: "Your entry is live",
    copy: `${genLayerGameConfig.validatorLabel} accepted your entry. This card will show your stake, result, and anything available to claim.`,
    position: 7,
  },
  claim: {
    target: "claim-payout",
    title: "Claim your winnings",
    copy: "The round is settled and funds are ready. Click the highlighted button, then approve the claim in your wallet.",
    position: 7,
  },
  complete: {
    title: "Guided play complete",
    copy: "You have completed the live game path. You can restart this guide anytime from the question-mark button.",
    position: 7,
  },
};

type TargetBox = { top: number; left: number; width: number; height: number; viewportWidth: number; viewportHeight: number };

export function GuidedPlay({ step, onExit, onPause, onComplete }: { step: GuideStep; onExit: () => void; onPause: () => void; onComplete: () => void }) {
  const definition = GUIDE_STEPS[step];
  const [targetBox, setTargetBox] = useState<TargetBox | null>(null);
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = window.requestAnimationFrame(() => {
      const target = definition.target
        ? document.querySelector<HTMLElement>(`[data-guide="${definition.target}"]`)
        : null;
      if (!target) {
        setTargetBox(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      setTargetBox({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    });
  }, [definition.target]);

  useEffect(() => {
    const target = definition.target
      ? document.querySelector<HTMLElement>(`[data-guide="${definition.target}"]`)
      : null;
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    measure();

    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-guide", "disabled"] });
    const resizeObserver = new ResizeObserver(measure);
    if (target) resizeObserver.observe(target);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [definition.target, measure]);

  const cardWidth = Math.min(310, (targetBox?.viewportWidth ?? 360) - 24);
  const estimatedCardHeight = step === "secured" || step === "complete" ? 190 : 165;
  const cardLeft = targetBox
    ? Math.max(12, Math.min(targetBox.left + targetBox.width / 2 - cardWidth / 2, targetBox.viewportWidth - cardWidth - 12))
    : `calc(50% - ${cardWidth / 2}px)`;
  const fitsBelow = targetBox ? targetBox.top + targetBox.height + 14 + estimatedCardHeight < targetBox.viewportHeight : false;
  const cardTop = targetBox
    ? fitsBelow ? targetBox.top + targetBox.height + 14 : Math.max(12, targetBox.top - estimatedCardHeight - 14)
    : undefined;

  return (
    <aside className="guided-play" aria-live="polite" aria-label="Guided play instructions">
      {targetBox && (
        <div
          className="guided-play-focus"
          style={{ top: targetBox.top - 6, left: targetBox.left - 6, width: targetBox.width + 12, height: targetBox.height + 12 }}
          aria-hidden="true"
        />
      )}
      <section
        className={`guided-play-card ${targetBox ? "has-target" : "is-waiting"}`}
        style={{
          width: cardWidth,
          left: cardLeft,
          ...(cardTop === undefined ? { bottom: 18 } : { top: cardTop }),
        }}
      >
        <header>
          <span>Guided play · {definition.position} of 7</span>
          <button type="button" onClick={onExit} aria-label="Exit guided play"><X size={14} /> Exit</button>
        </header>
        <h2>{definition.title}</h2>
        <p>{definition.copy}</p>
        {!targetBox && definition.target && <small>Finding the next button…</small>}
        {step === "secured" && <button className="guided-play-done" type="button" onClick={onPause}><Check size={15} /> Done for now</button>}
        {step === "complete" && <button className="guided-play-done" type="button" onClick={onComplete}><Check size={15} /> Finish guide</button>}
      </section>
    </aside>
  );
}
