// 10717 碱性柱丛（Alkaline Forest）· 地点 · 共享遭遇组 horrors_in_the_rock
// 归属：战役共用 · theFeastOfHemlockVale/_shared/horrors_in_the_rock。
// 卡面（cards-data 10717）：
//   强制 - 你揭示碱性柱丛后：你必须受到 1 点直接恐惧，或随机弃掉你 2 张卡牌。
//
// 读点（声明即接线）：地点卡自己的「揭示时」规则 = locationRule.onReveal
//   （locations.js#revealLocation 的唯一派发点，签名 (state, loc, api, seat)）。
//   二选一走 api.choice；直接恐惧走 api.directHorror（applyHorror(direct=true) 唯一入口）；
//   随机弃手牌走 api.discardRandom（deck-ops.js 的随机弃牌管线，含 wouldDiscardFromHand 窗口）。
const CODE = '10717'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Cave', 'Dark'],
    printedShroud: 2,
    printedClues: 2,
    quantity: 1,
    onRevealChoice: { directHorror: 1, discardRandom: 2 },
  },
  locationRule: {
    onReveal(state, location, api, seat) {
      const fallbackSeat = state?.campaign?.leadSeat
        ?? (state?.investigators || []).find(inv => inv && !inv.defeated && !inv.resigned)?.seat
      const who = Number.isInteger(seat) ? seat : fallbackSeat
      const inv = Number.isInteger(who) ? state?.investigators?.[who] : null
      if (!inv) return
      const hasHand = (inv.hand || []).length > 0
      const answer = hasHand
        ? String(api.choice({
          kind: 'effect', source: CODE, seat: who,
          prompt: '碱性柱丛：受到 1 点直接恐惧，或随机弃掉 2 张手牌。',
          options: [
            { id: 'horror', label: '受到 1 点直接恐惧' },
            { id: 'discard', label: '随机弃掉 2 张手牌' },
          ],
        }))
        : 'horror'
      if (answer === 'discard') {
        api.discardRandom(who, 2)
        api.info?.(`☠️ 「碱性柱丛」：${inv.name} 随机弃掉 2 张手牌。`)
      } else {
        api.directHorror(who, 1)
        api.info?.(`☠️ 「碱性柱丛」：${inv.name} 受到 1 点直接恐惧。`)
      }
    },
  },
  abilities: [],
  note: '揭示时二选一走 locationRule.onReveal（地点揭示唯一派发点）；空手时随机弃牌没有意义，'
    + '按「必须选择可结算项」处理为直接恐惧。',
}
