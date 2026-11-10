// 09015 达雷尔·西蒙斯（Darrell Simmons）· 幸存者 · 记者
// 卡面：
//   你以「达雷尔的柯达相机」在场开始游戏。
//   [fast] 在你所在地点的一次技能检定期间，花费你控制的一张支援上的 1 个证据：
//     本次检定难度 -2。（每次检定限一次）
//   [elder_sign] 效果：+1。在你控制的一张支援上放置 1 个证据。
//
// 读点：证据 = 卡牌计数器 'evidence'（P2 卡牌计数器原语）；
//   难度 -2 = api.reduceTestDifficulty（api-test.js，与 addTestValue 分开的通用读点）。
export default {
  code: '09015',
  kind: 'investigator',
  investigator: {
    freeAction: {
      id: 'darrellSpendEvidence',
      cost: {},
      label: '⚡ 花费 1 个证据：本次检定难度 -2（每次检定限一次）',
      duringOwnSkillTest: true,
      resolve: ({ inv, api }) => {
        const sources = (inv.assets || []).filter(asset => api.cardCounterOf(asset, 'evidence') > 0)
        if (!sources.length) return
        const source = sources.length === 1 ? sources[0] : sources[Number(api.choice({
          kind: 'target', source: '09015', seat: inv.seat, prompt: '选择要花费证据的支援。',
          options: sources.map((asset, index) => ({ id: String(index), label: api.cardName(asset.code) })),
        }))]
        if (!source) return
        api.moveCardCounters(source, null, 'evidence', 1)
        const difficulty = api.reduceTestDifficulty(2)
        api.info(`📷 达雷尔花费 1 个证据：本次检定难度 -2（当前 ${difficulty}）。`)
      },
    },
 elderSign: { bonus: 1 }, startsWith: ['09016'] },
  elderSign: {
    id: '09015-eldersign',
    label: '达雷尔旧印：+1；在你控制的一张支援上放置 1 个证据',
    resolve: ({ state, inv, api }) => {
      const assets = inv.assets || []
      const target = assets.find(asset => asset.code === '09016') || assets[0]
      if (target) api.addCardCounter(target, 'evidence', 1)
      return { delta: 1 }
    },
  },
  abilities: [],
  modifiers: [],
}
