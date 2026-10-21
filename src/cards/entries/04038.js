// 04038 黑暗契约
// 卡面：剧本模式专用。
// 卡面：对你所在地点的一位调查员造成2点伤害。
// 卡面：强制 - 在游戏结束或你退场时，如果黑暗契约仍在你手牌中：将黑暗契约从你的牌库中移除。查找收藏，找出失败的代价，并将其加入你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04038 离体体验：可作为弱点打出；弃牌堆/场上牌洗回牌库的事件链路。

export default {
  code: '04038',
  playableWeakness: true,
  abilities: [
    {
      kind: 'played', label: '离体体验',
      effect: { type: 'targetedEffect', target: 'location', effect: { type: 'takeDamage', amount: 2 } },
    },
    { kind: 'weakness', label: '离体体验（弱点）', weakness: { type: 'darkPact' } },
  ],
  modifiers: [

  ],
}
