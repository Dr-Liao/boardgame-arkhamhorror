// 02305 黄金怀表
// 卡面：卓越。
// 卡面：[reaction]在一个阶段开始时，将黄金怀表从游戏中移除：跳过该阶段。
// 卡面：[reaction]在一个阶段结束后，将黄金怀表从游戏中移除：重复该阶段。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02305 黄金怀表：从游戏中移除它，跳过或重复当前阶段（读点在 useGoldPocketWatch）。
//
// 阶段开始/结束的窗口是条目级 read point 开出来的 `choose/reaction`（canSkip），没有反应描述子；
// 必须显式声明反应提示，否则卡面不会出现「快速反应」开关（窗口照常询问，玩家却无法关掉它）。
// 自动档不适用：触发要把怀表移出游戏，是有代价的关键决策，只保留 skip ↔ ask 两态。

export default {
  code: '02305',
  explicitReactionPrompt: true,
  skipOrRepeatPhase: true,
  abilities: [

  ],
  modifiers: [

  ],
}
