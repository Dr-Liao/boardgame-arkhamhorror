// 06239 快手
// 卡面：每位调查员仅限 1 张。
//       [reaction] 你连续执行同一种行动两次后，横置快手：再执行一次该种行动
//       （行动种类包括激活、交战、躲避、攻击、调查、移动、打出、资源和抽取）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 已实现：每位调查员仅限 1 张（limitPerInvestigator 是 playAccess 的唯一读点）。
// 未实现（主效果，显式简化）：「连续两次同种行动后横置快手，再执行一次该种行动」——
//   引擎没有「本次行动类型」的行动级窗口上下文（investigation.afterAction 是收尾玩家窗口、
//   不带本次行动类型；actionLog 在动作提交后才写入），无法判定「连续同种行动」，也没有
//   「按行动类型受限的额外行动」原语。等待 P10 前的行动历史原语。

export default {
  code: '06239',
  simplified: true,
  note: '未实现（主效果）：「你连续执行同一种行动两次后，横置快手：再执行一次该种行动」——引擎没有行动类型历史/本次行动类型的窗口上下文，也没有「按行动类型受限的额外行动」原语。已实现：每位调查员仅限 1 张（limitPerInvestigator）。',
  limitPerInvestigator: true,
  abilities: [],
  modifiers: [],
}
