// 02305 黄金怀表
// 卡面：卓越。
// 卡面：[reaction]在一个阶段开始时，将黄金怀表从游戏中移除：跳过该阶段。
// 卡面：[reaction]在一个阶段结束后，将黄金怀表从游戏中移除：重复该阶段。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02305 黄金怀表：从游戏中移除它，跳过或重复当前阶段（读点在 useGoldPocketWatch）。

export default {
  code: '02305',
  skipOrRepeatPhase: true,
  abilities: [

  ],
  modifiers: [

  ],
}
