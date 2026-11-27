// 06122 斯凯王国（theSearchForKadath）· 幕 1（团队 2×人数线索，港口，轮末）
// 卡面：目标 - 当一轮结束时，位于[[港口]]地点的调查员可以共同花费所需数量的线索以推进。
// 卡面（背面「出海！」）：检索遭遇牌库、遭遇弃牌堆与所有场上区域，找出「乌撒之猫」、每张
//       「一群乌尼斯」、以及「祖格鼠」遭遇组的所有卡牌，移出游戏。
//       将每张放在一边的「千面祭司」连同遭遇弃牌堆一起洗入遭遇牌库。
//       调查员必须决定（选择一项）：南方奥瑞巴岛 / 西方米纳尔古地 / 北方禁闭之地 / 东方永恒之国的王国。
//
// 背面按顺序列出可前往的区域，由章节 actReveal 统一移除指定卡牌、洗牌并处理选择。
export default {
  code: '06122', scope: 'act', implemented: true,
  actRule: {
    regionOptions: ['oriab', 'mnar', 'forbiddenLands', 'timelessRealm'],
    removeFromGameCodes: ['06145', '06151', '06106', '06107', '06108', '06109'],
    setAsideIntoEncounterDeck: ['06149'],
  },
}
