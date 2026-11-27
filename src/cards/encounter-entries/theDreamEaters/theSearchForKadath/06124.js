// 06124 昔日厄运（theSearchForKadath）· 幕 2a（区域：米纳尔）
// 卡面：目标 - 在这个区域发现尽可能多的神迹。当一轮结束时，如果每位调查员都位于同一个[[港口]]地点，
//       你可以通过推进本幕移动到另一个区域。目标 - 如果调查员发现了10个神迹，进入（→结局1）。
// 卡面（背面「去哪里？」）：检索遭遇牌库、遭遇弃牌堆与所有场上区域，找出「伊伯生物」并移出游戏。
//       将遭遇弃牌堆洗入遭遇牌库。调查员必须决定（选择一项），不能选择已经造访过的地点：
//       南方奥瑞巴岛 / 北方禁闭之地 / 东方永恒之国的王国。
//
// 背面按顺序列出可前往的区域，由章节 actReveal 统一移除指定卡牌、洗牌并处理选择。
export default {
  code: '06124', scope: 'act', implemented: true,
  actRule: {
    regionOptions: ['oriab', 'forbiddenLands', 'timelessRealm'],
    removeFromGameCodes: ['06148'],
  },
}
