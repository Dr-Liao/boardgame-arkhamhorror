// 10719 蔓生隧道（Overgrown Tunnel）· 地点 · 共享遭遇组 horrors_in_the_rock
// 归属：战役共用 · theFeastOfHemlockVale/_shared/horrors_in_the_rock。
// 卡面（cards-data 10719）：
//   蔓生隧道有线索时，你必须花费额外 1 个行动以移动离开蔓生隧道。
//
// 读点（声明即接线）：地点卡自己的「离开后」规则 = locationRule.onLeave.effect
//   （movement.js#moveAfterCosts 的唯一派发点，签名 (state, prevLoc, api, inv)）。
//   「额外 1 个行动」走 api.loseActions（turn-flow / api-misc 的行动损失唯一入口，
//   含 wouldLoseActions 反应窗口；调查阶段直接扣 actionsLeft，其它阶段记 pendingActionLoss）。
//
// 近似：引擎没有「移动前先付额外行动」的前置读点，因此按「离开后损失 1 行动」结算；
//   若移动者此时已无行动，损失会被截到 0（印刷语义下该移动其实应不可执行）。
const CODE = '10719'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Cave', 'Dark'],
    printedShroud: 3,
    printedClues: 1,
    quantity: 1,
    extraActionToLeaveWhileClues: 1,
  },
  locationRule: {
    onLeave: {
      effect(state, location, api, inv) {
        if (!inv || (location?.clues || 0) <= 0) return
        api.loseActions(inv.seat, 1)
        api.info?.(`🌿 「蔓生隧道」仍有线索：${inv.name} 离开时额外花费 1 个行动。`)
      },
    },
  },
  abilities: [],
  note: 'approximation: 以 locationRule.onLeave.effect 在离开后扣 1 行动；引擎没有「移动前额外行动」'
    + '前置读点，行动不足时不会阻止该次移动（只会把行动扣到 0）。',
}
