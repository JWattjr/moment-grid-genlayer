export type AppConfig = {
  port: number;
  mongodbUri: string;
  corsOrigins: string[];
  replaySeconds: number;
  liveFeedUrl?: string;
  liveFeedApiKey?: string;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required. Copy .env.example to .env and fill it in.`);
  return value;
};

export function loadConfiguration(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 4000),
    mongodbUri: required("MONGODB_URI"),
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3003")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    replaySeconds: Number(process.env.REPLAY_SECONDS ?? 120),
    liveFeedUrl: process.env.LIVE_FEED_URL,
    liveFeedApiKey: process.env.LIVE_FEED_API_KEY,
  };
}

export const CONFIG = "APP_CONFIG";
