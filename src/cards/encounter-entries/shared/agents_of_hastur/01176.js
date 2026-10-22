// 01176 黄色印记
// 归属：跨战役通用
// 遭遇组：agents_of_hastur
// 卡面：显现 - 检定[willpower](4)。如果你检定失败，受到2点恐惧并查找你的牌库，找出1张[[疯狂]]弱点。抽取该卡牌，并混洗你的牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '01176', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 4, result => {
      if (result.success) return
      api.horror(inv.seat, 2)
      if (!inv.defeated && !inv.resigned) api.drawMadnessWeakness(inv.seat)
    })
    return false
  },
}
