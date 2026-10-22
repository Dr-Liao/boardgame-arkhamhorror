// 04330 时间之窗
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：强制 - 在你从时间之窗移动到一个[[破碎]]地点，或从一个[[破碎]]地点移动到时间之窗后：该[[破碎]]地点上每有一个线索，受到1点伤害。
// 卡面：[action]：探索。抽取探索牌顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。在通过此效果移动时，不从上述强制能力受到伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 时间之窗（04330）：从破碎地点进出时，该地点的每个线索化作 1 点伤害；并可「无视强制效果探索」。

export default {
  code: '04330', scope: 'location',
  locationRule: {
    nodeHazard: { withTrait: 'Shattered', harm: 'damage', icon: '⏳', label: '伤害' },
    actions({ location, moves, state }) {
      moves.push({
        action: 'scenarioAction', rule: 'exploreFromNode', locationId: location.id,
        label: `🧭 探索（无视「${location.name}」的强制效果）`,
        reason: (state.explorationDeck || []).length ? null : '探索牌库已空',
      })
    },
  },
}
