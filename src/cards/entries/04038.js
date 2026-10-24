// 04038 黑暗契约
// 卡面：剧本模式专用。
// 卡面：对你所在地点的一位调查员造成2点伤害。
// 卡面：强制 - 在游戏结束或你退场时，如果黑暗契约仍在你手牌中：将黑暗契约从你的牌库中移除。查找收藏，找出失败的代价，并将其加入你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04038 黑暗契约：事件弱点。卡面没有 Revelation，抽到时应当留在手牌（而不是按“显现”结算后弃置）；
// 因此用条目级 weaknessStaysInHand 声明（读点 src/engine/deck-ops.js:369）。
// 抽到后可用 playableWeakness 支付 2 资源打出，结算卡面第一条“对你所在地点一位调查员造成 2 点伤害”。
// 卡面强制条款（游戏结束/退场时仍在手牌 → 换成失败的代价）由引擎读 darkPactForced + replacementCode
// 结算（src/engine/campaign-flow.js:121-131 剧本结束、src/engine/engine.js:1203-1213 撤退）；
// “被击败/疯狂退场”分支尚未接线，见 artifacts/tfa-fix/primitive-requests/player-1-04038.json。

export default {
  code: '04038',
  upgradesFrom: 'priceOfFailure',
  playableWeakness: true,
  // 事件弱点：抽到后进手牌（卡面无 Revelation），而不是结算后弃置。
  weaknessStaysInHand: true,
  weaknessHandNote: '黑暗契约留在手中：可支付 2 资源打出，对你所在地点一位调查员造成 2 点伤害；游戏结束或退场时若仍在手牌，换成「失败的代价」。',
  darkPactForced: true,
  replacementCode: '04039',
  abilities: [
    {
      kind: 'played', label: '黑暗契约',
      effect: { type: 'targetedEffect', target: 'location', effect: { type: 'takeDamage', amount: 2 } },
    },
    { kind: 'weakness', label: '黑暗契约（弱点）', weakness: { type: 'darkPact' } },
  ],
  modifiers: [

  ],
}
