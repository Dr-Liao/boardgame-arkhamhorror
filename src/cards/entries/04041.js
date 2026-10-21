// 04041 被诅咒的命运
// 卡面：显现 - 受到2点恐惧。在剧本日志中，你的调查员取得的剧情支援/弱点下方，记录“时间到”。如果已经有此条记录，将被诅咒的命运从你的牌库中移除，查找收藏，找出丧钟敲响并将它放到你的牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04041',
  abilities: [
    { kind: 'weakness', label: '被诅咒的命运', weakness: { type: 'cursedFate' } },
  ],
  modifiers: [

  ],
}
