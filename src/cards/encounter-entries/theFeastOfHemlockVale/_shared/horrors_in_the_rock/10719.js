// 10719 蔓生隧道（Overgrown Tunnel）· 地点 · 共享遭遇组 horrors_in_the_rock
// 归属：战役共用 · theFeastOfHemlockVale/_shared/horrors_in_the_rock。
// 卡面（cards-data 10719）：
//   蔓生隧道有线索时，你必须花费额外 1 个行动以移动离开蔓生隧道。
//
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
    leaveActionCost: (_state, location) => location.clues > 0 ? 1 : 0,
  },
  abilities: [],
}
