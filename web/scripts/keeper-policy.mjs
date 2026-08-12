export const KeeperAction = Object.freeze({
  WAIT: "WAIT",
  RESOLVE: "RESOLVE",
  DISPATCH: "DISPATCH",
  PROCESS: "PROCESS",
  REFUND: "REFUND",
});

function timestamp(value, field) {
  const milliseconds = Date.parse(value ?? "");
  if (!Number.isFinite(milliseconds)) throw new Error(`Invalid ${field} timestamp.`);
  return milliseconds;
}

export function decideKeeperAction(round, resolution, now = Date.now()) {
  if (!round || !round.status) return { action: KeeperAction.WAIT, reason: "Round is unavailable." };
  if (["SETTLED", "REFUNDING"].includes(round.status)) {
    return { action: KeeperAction.WAIT, reason: `Round is already ${round.status.toLowerCase()}.` };
  }

  const lockAt = timestamp(round.lock_at, "lock_at");
  const resolveNotBefore = timestamp(round.resolve_not_before, "resolve_not_before");
  const refundAt = timestamp(round.refund_at, "refund_at");

  if (now >= refundAt) return { action: KeeperAction.REFUND, reason: "The settlement deadline passed." };
  if (round.status === "OPEN" && now >= lockAt && !round.liquidity_ready) {
    return { action: KeeperAction.REFUND, reason: "The locked round missed its liquidity gate." };
  }
  if (round.status === "SCORING") {
    return { action: KeeperAction.PROCESS, reason: "The resolver callback opened deterministic scoring." };
  }
  if (now < resolveNotBefore) {
    return { action: KeeperAction.WAIT, reason: "The post-match evidence window has not opened." };
  }
  if (!resolution || resolution.status !== "SETTLED") {
    return { action: KeeperAction.RESOLVE, reason: "Evidence is eligible for validator adjudication or retry." };
  }
  if (!round.resolution_accepted_at) {
    return { action: KeeperAction.DISPATCH, reason: "Resolution is settled but the game callback is not recorded." };
  }
  return { action: KeeperAction.WAIT, reason: "No permissionless maintenance action is currently required." };
}
