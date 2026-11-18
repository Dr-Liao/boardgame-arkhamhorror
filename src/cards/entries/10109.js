// 10109 毛皮货（Pelt Shipment）· 潜袭者支援 · 0 经验 · 无槽位 · 道具/补给
// 卡面：毛皮货在你手牌中时，你的手牌上限减少3张。
//       [reaction] 在游戏结束或你撤退时，如果毛皮货仍在你手牌中：在下一场冒险之前，
//       你购买的下一张新卡牌经验值费用减少1点。
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「在手牌中时手牌上限 -3」：声明式修正 target:'handSize' + condition.sourceInHand。
//     modifiers.js 的 modifierSourceRows 已经把手中带 sourceInHand 的修正纳入来源枚举
//     （modifierTotal(state, inv, 'handSize') 能读到 -3），但 stats.js#handSize 还没有把
//     `modifierTotal(..., 'handSize')` 并入（MODIFIER_TARGETS 里有 handSize，handSize 计算却只读
//     passive.handSizeBonus / 威胁区 / 调查员规则）——这是缺的引擎读点，见 primitive-requests/10109.json。
//   · 「游戏结束或撤退时仍在手牌 → 下一次购牌经验 -1」：购买折扣本身有原语
//     （src/campaign/purchase-discount.js#grantPurchaseDiscount，`api.scenario.grantPurchaseDiscount`），
//     但撤退/游戏结束没有描述子窗口：doResign 只读 darkPactForced / replacementCode，
//     campaign-flow.finishScenario 的手牌扫描只读 traumaAtGameEndWhenInHand，没有通用的
//     「结算时扫描手牌 → 授予购牌折扣」读点。缺原语期间不写无人读取的字段，见请求文件。
const CODE = '10109'

export default {
  code: CODE,
  name: 'Pelt Shipment',
  simplified: true,
  note: 'approximation / blocked read point: (1) 手牌上限 -3 已按声明式修正 target:handSize + condition.sourceInHand 写入修正管线，但 stats.js#handSize 尚未读取 modifierTotal(...,\'handSize\')，实际手牌上限暂不变化；(2) 「游戏结束/撤退时仍在手牌 → 下一张新购卡经验 -1」没有描述子窗口（撤退与结局结算只读 darkPactForced / traumaAtGameEndWhenInHand 等专用字段），购买折扣原语 grantPurchaseDiscount 就绪但无触发读点。见 primitive-requests/10109.json。',
  modifiers: [
    // 手牌中时手牌上限 -3：修正来源枚举已支持 condition.sourceInHand。
    { target: 'handSize', amount: -3, condition: { sourceInHand: true } },
  ],
  abilities: [],
}
