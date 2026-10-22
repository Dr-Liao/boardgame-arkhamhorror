// 03255 颤栗水池
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：强制 - 你在颤栗水池结束回合后：你必须受到1点直接伤害或失去5资源。
// 卡面：强制 - 在颤栗水池揭示时：将地下墓穴牌库顶的1张地下墓穴放置入场，放在颤栗水池的下方或右方。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03255', scope: 'location',
  locationRule: {
    onTurnEnd(state, location, api, inv) {
      const answer = api.choose({
        kind: 'harm', source: location?.originalCode || location?.code, seat: inv.seat,
        prompt: '颤栗水池：选择受到1点直接伤害，或失去5资源。',
        options: [{ id: 'damage', label: '受到1点直接伤害' }, { id: 'resources', label: '失去5资源' }],
      })
      if (answer === 'damage') api.directDamage(inv.seat, 1)
      else inv.resources = Math.max(0, inv.resources - 5)
    },
  },
}
