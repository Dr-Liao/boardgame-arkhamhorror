// 09766 基金会情报（Foundation Intel）· 弱点资产 · globetrotting
// 卡面：基金会情报不能离开你手中。
// 读点：
//   · weaknessStaysInHand —— deck-ops.js#resolveWeaknessDraw：抽到后留在手牌，不结算进弃牌堆；
//   · weaknessHandNote   —— 同一分支把「留在手牌」的提示写进抽牌日志（03142/04038/05012 同款）。
// 近似 / 缺读点：「不能离开你手中」的完整封锁（弃置、打出、被效果移出手牌）没有逐卡读点。
//   · 引擎唯一的「手牌封锁」读点 blocksCommitWhileInHand 是塔罗「高塔·XVI」的语义
//     （src/engine/tarot-slot.js#handCommitBlocker：手牌里有它时**你不能投入任何卡牌**），
//     与本题「这张卡自己不能离手」不是同一条规则，故不再声明该字段；
//   · 需要新增「这张卡不能离开手牌」的引擎读点（打出/弃置/被效果移出三条通道都可查询），见汇报。
const CODE = '09766'

export default {
  code: CODE,
  scope: 'card',
  implemented: true,
  weaknessStaysInHand: true,
  // 2026-11-13 P1-16：「不能离开你的手牌」——引擎四个通道读点：
  // engine.js#discardableHandCards（手牌上限/弃牌候选）、player-zones.js#discardPlayerCards（兜底）、
  // table-decisions.js#cardPlayBlockedReason（不能打出）、tests.js 投入候选（不能投入）。
  cannotLeaveHand: true,
  weaknessHandNote: '「基金会情报」不能离开你手中。',
  flags: { weakness: true, item: true, evidence: true },
  note: '引擎读点：weaknessStaysInHand + weaknessHandNote 留手；cannotLeaveHand 接入 4 个通道'
    + '（手牌上限/弃牌候选、player-zones 兜底、不能打出、投入候选），因此不能被弃置/打出/投入。',
}
