// 10578 乱藻海滩（Weed-Choked Beach）· 岩穴地点
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：强制 - 在你于乱藻海滩尝试躲避时，技能检定失败后：失去 1 个行动。
//       强制 - 在你将要离开乱藻海滩时：揭示一个混乱标记。如果是[skull]/[tablet]/[elder_thing]/[auto_fail]，
//       你必须取消该次移动的效果，或弃掉一个你控制的[[道具]]支援。
//
// 一张卡一个文件：离场强制在 behavior.beforeMove（revealChaosToken + 取消移动或弃道具）。
export default {
  code: '10578',
  scope: 'location',
  implemented: true,
  abilities: [],
  flags: {
    forcedOnEvadeFailure: { loseActions: 1 },
    forcedOnLeave: {
      chaosToken: true,
      cancelMoveOrDiscardTrait: 'Item',
    },
    cluesPerInvestigator: 1,
    shroud: 3,
    traits: ['Coastal', 'Cave'],
  }
}
