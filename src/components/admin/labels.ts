import type { CampaignPhase } from "@/lib/schedule";

export const PHASE_TONE: Record<CampaignPhase, "green" | "blue" | "neutral" | "amber" | "red" | "violet"> = {
  live: "green",
  scheduled: "blue",
  waiting: "violet",
  draft: "neutral",
  paused: "amber",
  ended: "neutral",
  archived: "neutral",
};
