export type RewardEvent =
  | { type: 'ACHIEVEMENT'; key: string; name: string; rewardBits: number }
  | { type: 'WEEKLY_TASK'; key: string; name: string; rewardBits: number }
  | { type: 'LEVEL_UP'; level: number; rewardBits: number };
