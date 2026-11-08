// 08650 地热口（Geothermal Vent） · 地点（古代设施）· the_heart_of_madness
// 卡面：[action]如果你控制[seal_a]封印：检定[combat](3)。成功则位于本地的调查员
//   可以共同花费 1[per_investigator] 个线索来激活[seal_a]封印。然后，从混乱袋里移除 1 个[frost] 标记。
// 读点：共同花费逐位走 runtime.spendClues（先整体预检，不足不扣）；激活走 campaign.seals.activate
//   （P2 封印唯一写入口）。
const CODE = '08650'
const SEAL = 'A'

function sealHeldBy(state, seat) {
  return state.campaign?.eote?.seals?.entries?.some(entry => entry.kind === SEAL
    && entry.active === false && entry.placedBySeat === seat && entry.locationId == null) || false
}

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, roomSeal: SEAL },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '控制封印 A：检定 combat(3)，成功后共同花费线索激活该封印',
    limit: { scope: 'perGame', owner: 'instance' },
    criteria: ({ state, inv }) => sealHeldBy(state, inv.seat),
    resolve: ({ state, inv, source, api }) => {
      const runtime = api.scenario || api
      api.test(inv.seat, 'combat', 3, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        const required = Math.max(1, Number(state.numInvestigators) || state.investigators.length || 1)
        const contributors = state.investigators.filter(mate => !mate.defeated && !mate.resigned
          && mate.location === source.id && (mate.clues || 0) > 0)
        const total = contributors.reduce((sum, mate) => sum + (mate.clues || 0), 0)
        if (total < required) {
          api.info('「地热口（Geothermal Vent）」：本地共同线索不足（需要 ' + required + '）。')
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
          api.info('「地热口（Geothermal Vent）」：封印 A 当前不能激活。')
          return
        }
        api.info('🔯 「地热口（Geothermal Vent）」：封印 A 被激活。')
        api.mechanics.frost.pay(1);
      } })
    },
  }],
}

