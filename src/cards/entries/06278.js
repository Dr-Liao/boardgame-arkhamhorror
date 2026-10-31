// 06278 惊喜的发现
// 卡面：多重。
//       [reaction]在你查找牌库，并且查找过的卡牌中有惊喜的发现时：将其放置入场，放到你的游戏区域。
//       在你执行的能够投入该卡牌的下一次技能检定中，你必须投入该卡牌。如果该技能检定成功，抽取1张卡牌。
//       (每次查找最多使用1次[[研究]]能力。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06278 惊喜的发现（技能卡，多重）：被「查找牌库」翻到时结算的效果由条目级 searchedCardRule 声明
// （读点 src/engine/deck-ops.js 的 searchedCardsWindow——牌还在牌库里时能力源枚举看不到它）。
// 显式简化：searchedCardRule 只支持 take / discard / cancelSearch / discoverClue / drawEncounter 固定动作，
//   没有「放入游戏区域 + 强制投入下一次检定 + 成功后抽 1」的自定义动作，因此用 take（加入手牌）近似
//   「放到你的游戏区域」，强制投入与成功抽牌未实现（见 note）。

export default {
  code: '06278',
  simplified: true,
  note: '未实现：被查找到时「放入游戏区域并强制投入下一次符合条件的技能检定；该检定成功则抽 1 张」'
    + '（searchedCardRule 只支持 take/discard/cancelSearch/discoverClue/drawEncounter 固定动作，'
    + '无自定义结算）。现近似为查找时可选择把这张牌加入手牌。',
  searchedCardRule: {
    mode: 'reaction',
    label: '查找牌库找到「惊喜的发现」：把它加入手牌',
    take: true,
  },
  modifiers: [],
}
