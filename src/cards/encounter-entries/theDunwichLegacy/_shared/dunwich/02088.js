// 02088 不洁之地
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：dunwich
// 卡面：显现 - 将不洁之地放置入场，放到你的威胁区域。
// 卡面：你不能打出[[盟友]]支援。将你控制的每个[[盟友]]支援的印刷文本框视为如同空白。
// 卡面：强制 - 当你的回合结束时：检定[willpower](3)。如果你检定成功，弃掉不洁之地。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 卡号级规则（原 card-rules.js，REPORT.md 第 3 批）
// 不洁之地（02088）：使调查员身上的盟友文本空白，显现时放进威胁区。

export default {
  code: '02088', implemented: true, name: '不洁之地', scope: 'treachery',
  text: '你控制的所有盟友的文本被视为空白。', blanksTraits: ['ally'],
  // 回合结束意志（3）检定：引擎 runThreatEndTurn 统一结算，内容层不再逐卡循环。
  threatEffect: { endTurnTest: { skill: 'willpower', difficulty: 3 }, cannotPlayAllies: true, blanksAllies: true },
  encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, card.originalCode || card.code)
    return true
  },
}
