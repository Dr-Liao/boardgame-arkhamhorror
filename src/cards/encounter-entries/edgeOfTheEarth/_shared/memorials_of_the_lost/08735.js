// 08735 肯斯勒的日志（Kensler 的日志）· 剧情资产 · memorials_of_the_lost
// 卡面：快速。使用(2秘密)。[action]花费 1 秘密：调查。以基础值为 5 的[intellect]调查，或本次调查
//   得到 +2[intellect]。如果你检定成功，发现你所在地点额外 1 个线索。
// 读点：api.test 的 baseValue/skillBonus；线索走 api.discoverClue（调查 1 + 额外 1）。
const CODE = '08735'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  fast: true, uses: 2, usesType: 'secrets',
  flags: { memorial: true },
  abilities: [{
    kind: 'action', actionKind: 'investigate', label: '花费 1 秘密：基础值 5 的调查，或 +2 智力；成功额外发现 1 线索',
    cost: { action: 1, uses: 1 },
    resolve: ({ state, inv, api }) => {
      const location = state.locations.find(loc => loc.id === inv.location)
      if (!location || (location.clues || 0) <= 0) {
        api.info('「肯斯勒的日志」：所在地点没有线索。')
        return
      }
      const mode = api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择调查方式。',
        options: [{ id: 'base5', label: '以基础值 5 的智力调查' }, { id: 'bonus', label: '本次调查 +2 智力' }] })
      const choose = mode === 'base5' ? { baseValue: 5 } : { skillBonus: 2 }
      api.test(inv.seat, 'intellect', Number(location.shroud ?? 0), { ...choose,
        source: { type: 'asset', code: CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.discoverClue(inv.seat, 1, location.id)
          api.discoverClue(inv.seat, 1, location.id)
        } })
    },
  }],
}

