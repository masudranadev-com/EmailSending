import { sendCampaignById } from "./campaign-sending";

const MAX_TIMEOUT_MS = 2_147_483_647;

declare global {
  var campaignSendTimers: Map<number, ReturnType<typeof setTimeout>> | undefined;
}

export function scheduleCampaignSend(campaignId: number, scheduleAt: Date) {
  const delay = scheduleAt.getTime() - Date.now();

  if (delay > MAX_TIMEOUT_MS) {
    return false;
  }

  const timers = (globalThis.campaignSendTimers ??= new Map());
  const existingTimer = timers.get(campaignId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    timers.delete(campaignId);
    void sendCampaignById(campaignId).catch((error) => {
      console.error(
        `Scheduled campaign ${campaignId} failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    });
  }, Math.max(delay, 0));

  timers.set(campaignId, timer);
  return true;
}

export function clearScheduledCampaignSend(campaignId: number) {
  const timer = globalThis.campaignSendTimers?.get(campaignId);

  if (!timer) {
    return false;
  }

  clearTimeout(timer);
  globalThis.campaignSendTimers?.delete(campaignId);
  return true;
}
