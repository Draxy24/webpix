import type { TFunction } from "i18next";

export type RewardEvent =
  | { type: "ACHIEVEMENT"; key: string; name: string; rewardBits: number }
  | { type: "WEEKLY_TASK"; key: string; name: string; rewardBits: number }
  | { type: "LEVEL_UP"; level: number; rewardBits: number };

export function eventToast(
  ev: RewardEvent,
  t: TFunction,
  reward: (title: string, message?: string) => void,
) {
  if (ev.type === "LEVEL_UP") {
    reward(
      String(t("rewards.toast.levelUp", { level: ev.level })),
      ev.rewardBits > 0
        ? String(t("rewards.toast.bits", { bits: ev.rewardBits }))
        : undefined,
    );
    return;
  }
  const nameKey =
    ev.type === "ACHIEVEMENT" ? "achievements.items." : "tasks.items.";
  const label = String(
    ev.type === "ACHIEVEMENT"
      ? t("rewards.toast.achievement")
      : t("rewards.toast.weeklyTask"),
  );
  const name = String(t(`${nameKey}${ev.key}.name`, { defaultValue: ev.name }));
  const sub =
    ev.rewardBits > 0
      ? `${label} · ${String(t("rewards.toast.bits", { bits: ev.rewardBits }))}`
      : label;
  reward(name, sub);
}

export type SocketNotification =
  | { kind: "FRIEND_REQUEST"; fromNickname: string }
  | { kind: "FRIEND_ACCEPTED"; nickname: string };

export function handleSocketNotification(
  payload: SocketNotification,
  t: TFunction,
  info: (title: string, message?: string) => void,
) {
  if (payload.kind === "FRIEND_REQUEST") {
    info(
      String(t("notifications.friendRequest", { nick: payload.fromNickname })),
    );
  } else if (payload.kind === "FRIEND_ACCEPTED") {
    info(String(t("notifications.friendAccepted", { nick: payload.nickname })));
  }
}
