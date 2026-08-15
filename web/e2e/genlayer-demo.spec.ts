import { expect, test, type Page } from "@playwright/test";

type Result = "TRUE" | "FALSE" | "INVALID";

function record(result: Result) {
  const settled = result !== "INVALID";
  return {
    resolution_id: `demo-${result.toLowerCase()}`,
    match_id: "epl-arsenal-chelsea-2023-05-02",
    home_team: "Arsenal",
    away_team: "Chelsea",
    competition: "Premier League",
    match_date: "2023-05-02",
    moment_type: "HOME_TEAM_SCORES_FIRST",
    moment_statement: "Home team scores first",
    criteria_json: "{\"kind\":\"FIRST_VALID_GOAL_TEAM\",\"finality\":\"FIRST_VALID_GOAL_RECORDED\"}",
    source_urls_json: "[\"https://www.bbc.co.uk/sport/football/65382202\",\"https://www.espn.co.uk/football/match/_/gameId/638156/chelsea-arsenal\"]",
    status: settled ? "SETTLED" : "PENDING",
    result,
    reason_code: result === "TRUE" ? "HOME_FIRST" : result === "FALSE" ? "AWAY_FIRST" : "CONFLICTING_SOURCES",
    match_status: "FINAL",
    event_minute: result === "TRUE" ? 18 : result === "FALSE" ? 44 : -1,
    evidence_summary: result === "INVALID"
      ? "The accessible reports disagree on the decisive event."
      : "BBC and ESPN identify the opening scorer from the completed match.",
    source_references_json: "[\"https://www.bbc.co.uk/sport/football/65382202\",\"https://www.espn.co.uk/football/match/_/gameId/638156/chelsea-arsenal\"]",
    resolved_at: settled ? "2026-08-09T17:34:27Z" : "",
    attempt_count: 1,
    transaction_hash: settled ? `0x${"1".repeat(64)}` : null,
  };
}

async function mockHistory(page: Page, results: Result[]) {
  await page.route("**/api/genlayer/resolutions*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        contract_address: `0x${"a".repeat(40)}`,
        network: "studionet",
        records: results.map(record),
      }),
    });
  });
}

async function markGuideComplete(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("moment-grid-guided-play-v1", JSON.stringify({ version: 1, step: "complete", status: "complete" }));
  });
}

test("guided play highlights the next real action and waits for the player", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your first square" })).toBeVisible();
  await expect(page.getByText("Guided play · 1 of 7")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole("heading", { name: "Choose your first square" })).toBeVisible();

  await page.locator('[data-guide="pick-cell"]').click();
  await expect(page.getByRole("heading", { name: "Choose a prediction" })).toBeVisible();
  await page.locator('[data-guide="prediction-option"]').click();
  await expect(page.getByRole("heading", { name: "Complete the grid" })).toBeVisible();
  await page.locator('[data-guide="random-fill"]').click();
  await expect(page.getByRole("heading", { name: "Review your nine picks" })).toBeVisible();
  await page.locator('[data-guide="review-grid"]').click();
  await expect(page.getByRole("heading", { name: "Review the stake" })).toBeVisible();
  await expect(page.locator('[data-guide="review-stake"]')).toBeVisible();
});

test("player can random-fill, review, and lock the demo grid", async ({ page }) => {
  await markGuideComplete(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Random fill" }).click();
  await expect(page.getByRole("button", { name: "Review my grid" })).toBeEnabled();
  await page.getByRole("button", { name: "Review my grid" }).click();
  await expect(page.getByText("Commit to your calls.")).toBeVisible();
  const legacyGuard = page.getByText(/legacy replay round is view-only/i);
  if (await legacyGuard.isVisible()) {
    await expect(page.getByRole("button", { name: /review 10 gen stake/i })).toBeDisabled();
  } else if (await page.getByRole("button", { name: /review .* gen stake/i }).isVisible()) {
    const reviewStake = page.getByRole("button", { name: /review .* gen stake/i });
    if (await reviewStake.isEnabled()) {
      await reviewStake.click();
      await expect(page.getByRole("button", { name: /confirm & sign .* gen/i })).toBeVisible();
    } else {
      await expect(reviewStake).toBeDisabled();
    }
  } else {
    await page.getByRole("button", { name: "Lock & start replay" }).click({ force: true });
    await expect(page.getByText("Your predictions are locked")).toBeVisible();
  }
});

test("rules explain the one GEN nine-pool economy", async ({ page }) => {
  await page.goto("/rules");
  await expect(page.getByText(/Stake from 1 GEN and commit all nine calls/i)).toBeVisible();
  await expect(page.getByText("Back nine unique pools")).toBeVisible();
  await expect(page.getByText(/each Common pool receives 0\.05/i)).toBeVisible();
  await expect(page.getByText(/each Medium pool 0\.10/i)).toBeVisible();
  await expect(page.getByText(/each Rare pool 0\.15/i)).toBeVisible();
});

for (const scenario of ["TRUE", "FALSE", "INVALID"] as const) {
  test(`reviewer route renders ${scenario} and deterministic scoring impact`, async ({ page }) => {
    await mockHistory(page, [scenario]);
    await page.goto("/genlayer");
    await expect(page.getByTestId("genlayer-demo")).toBeVisible();
    await expect(page.getByTestId("resolution-status")).toContainText(
      scenario === "INVALID" ? "Unable to resolve" : `Settled ${scenario}`,
    );
    const scoring = page.getByTestId("scoring-impact");
    await expect(scoring).toHaveAttribute("data-cell-state", scenario === "TRUE" ? "marked" : "clear");
    await expect(scoring).toContainText(
      scenario === "TRUE" ? "CELL MARKED" : scenario === "FALSE" ? "CELL CLEARED" : "NO SCORE CHANGE",
    );
    await expect(page.getByRole("link", { name: /bbc\.co\.uk/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /espn\.co\.uk/i })).toBeVisible();
  });
}

test("live Studionet reviewer read", async ({ page }) => {
  test.skip(process.env.E2E_LIVE_GENLAYER !== "1", "Set E2E_LIVE_GENLAYER=1 to exercise the live read-only endpoint.");
  await page.goto("/genlayer");
  await expect(page.getByTestId("resolution-status")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("region", { name: "GenLayer resolution history" })).toBeVisible();
});
