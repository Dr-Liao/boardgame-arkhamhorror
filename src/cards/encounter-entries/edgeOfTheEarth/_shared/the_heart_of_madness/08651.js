// 08651 被遗忘的神庙（Forsaken Temple） · 地点（古代设施）· the_heart_of_madness
// 卡面：[action]如果你控制[seal_c]封印：检定[willpower](3)。成功则位于本地的调查员
//   可以共同花费 1[per_investigator] 个线索来激活[seal_c]封印。然后，查看与被遗忘的神庙在同一辐条上的所有未揭示地点的已揭示面。
// 读点：共同花费逐位走 runtime.spendClues（先整体预检，不足不扣）；激活走 campaign.seals.activate
//   （P2 封印唯一写入口）。
const CODE = '08651'
const SEAL = 'C'

function sealHeldBy(state, seat) {
  return state.campaign?.eote?.seals?.entries?.some(entry => entry.kind === SEAL
    && entry.active === false && entry.placedBySeat === seat && entry.locationId == null) || false
}

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, roomSeal: SEAL },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '控制封印 C：检定 willpower(3)，成功后共同花费线索激活该封印',
    limit: { scope: 'perGame', owner: 'instance' },
    criteria: ({ state, inv }) => sealHeldBy(state, inv.seat),
    resolve: ({ state, inv, source, api }) => {
      const runtime = api.scenario || api
      api.test(inv.seat, 'willpower', 3, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        const required = Math.max(1, Number(state.numInvestigators) || state.investigators.length || 1)
        const contributors = state.investigators.filter(mate => !mate.defeated && !mate.resigned
          && mate.location === source.id && (mate.clues || 0) > 0)
        const total = contributors.reduce((sum, mate) => sum + (mate.clues || 0), 0)
        if (total < required) {
          api.info('「被遗忘的神庙（Forsaken Temple）」：本地共同线索不足（需要 ' + required + '）。')
          return
        }
        let left = required
        for (const mate of contributors) {
          if (!left) break
          const pay = Math.min(left, mate.clues || 0)
          runtime.spendClues(mate.seat, pay)
          left -= pay
        }
        if (!api.mechanics.eoteCampaign.seals.activate(SEAL)) {
          api.info('「被遗忘的神庙（Forsaken Temple）」：封印 C 当前不能激活。')
          return
        }
        api.info('🔯 「被遗忘的神庙（Forsaken Temple）」：封印 C 被激活。')
        api.info('「被遗忘的神庙」：查看同一辐条上所有未揭示地点的已揭示面（由章节地图数据结算）。');
      } })
    },
  }],
}

