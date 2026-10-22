// 04324 恩凯联结点
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：强制 - 在你从恩凯联结点移动到一个[[异界]]地点，或从一个[[异界]]地点移动到恩凯联结点后：该[[异界]]地点上每有一个线索，受到1点恐惧。
// 卡面：[action]：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。在通过此效果移动时，不从上述强制能力受到恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 116 轮：破碎永世（失落时代第五章）的地点 / 幕 / 密谋规则。
// 幕/密谋通过 onReveal 的 hooks 参数编排章节实现；地点规则全部是数据 + 自带 helper。
// 恩凯联结点（04324）：从异界地点进出时，该地点的每个线索化作 1 点恐惧；并可「无视强制效果探索」。

export default {
  code: '04324', scope: 'location',
  locationRule: {
    nodeHazard: { withTrait: 'Otherworld', harm: 'horror', icon: '🌀', label: '恐惧' },
    actions({ location, moves, state }) {
      moves.push({
        action: 'scenarioAction', rule: 'exploreFromNode', locationId: location.id,
        label: `🧭 探索（无视「${location.name}」的强制效果）`,
        reason: (state.explorationDeck || []).length ? null : '探索牌库已空',
      })
    },
  },
}
