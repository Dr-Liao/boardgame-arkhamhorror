// 12006 死路（Dead Ends）· 中立 · 事件/失误 · 弱点。（乔·戴蒙德的签名弱点）
//
// 卡面：
//   强制 - 在你查找你的牌库时，若查找过的卡牌中有死路：将其抽取，取消该次查找的效果，
//     并混洗你的牌库。
//   强制 - 在游戏结束或你退场时，如果本卡牌在你手牌中：你少取得 2 点经验值。
//
// 引擎读点（批次 3 · B2 原语落地后）：
//   · 「查找牌库时被发现」走 P6 原语 `searchedCardRule`（读点 src/engine/deck-ops.js 的
//     searchedCardsWindow）：mode forced + take（抽到手）+ cancelSearch（取消本次查找，调用方洗回牌库）。
//     这一份规则同时覆盖 searchDeck / lookAt / searchTop / 支援检索等所有查找入口。
//   · 抽到后留在手牌：条目级 weaknessStaysInHand（读点 deck-ops.drawCards 弱点分支）——
//     这张事件弱点没有显现效果，落入手中等待结算。
//   · 「游戏结束时仍在手牌 → 少 2 经验」：条目级 `xpPenaltyInHand: 2`，读点
//     src/engine/campaign-flow.js#finishScenario 的经验结算（扫 inv.hand，amount - penalty，下限 0）。
//   · 「退场时」分支：现读点只覆盖游戏结束（finishScenario）；退场（eliminateInvestigator）尚未接
//     xpPenaltyInHand（该处本来就没有按手牌扣 XP 的结算点），已在报告里标注为剩余缺口。

const code = '12006'

export default {
  code,
  weaknessStaysInHand: true,
  weaknessHandNote: '「死路」留在手中：游戏结束或你退场时你少取得 2 点经验。',
  xpPenaltyInHand: 2,
  searchedCardRule: {
    mode: 'forced',
    label: '死路：将其抽取，取消本次查找的效果，并混洗你的牌库',
    take: true,
    cancelSearch: true,
  },
  abilities: [],
  modifiers: [],
}
