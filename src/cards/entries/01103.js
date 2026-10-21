// 01103 固执的侦探
// 卡面：猎手。猎物。你控制的所有盟友的文本被视为空白。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01103',
  enemyWeakness: { hunter: true, prey: true, blanksInvestigatorText: true },
  abilities: [],
  modifiers: [],
}
