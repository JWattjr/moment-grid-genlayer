import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfiguration } from "./configuration";

describe("loadConfiguration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads the GenLayer-native match API defaults", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://localhost/moment-grid-test");

    expect(loadConfiguration()).toEqual({
      port: 4000,
      mongodbUri: "mongodb://localhost/moment-grid-test",
      corsOrigins: ["http://localhost:3003"],
      replaySeconds: 120,
      liveFeedUrl: undefined,
      liveFeedApiKey: undefined,
    });
  });

  it("normalizes configured CORS origins and replay settings", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://localhost/moment-grid-test");
    vi.stubEnv("PORT", "4100");
    vi.stubEnv("CORS_ORIGINS", "https://one.example, https://two.example ");
    vi.stubEnv("REPLAY_SECONDS", "90");

    const config = loadConfiguration();

    expect(config.port).toBe(4100);
    expect(config.corsOrigins).toEqual(["https://one.example", "https://two.example"]);
    expect(config.replaySeconds).toBe(90);
  });
});
