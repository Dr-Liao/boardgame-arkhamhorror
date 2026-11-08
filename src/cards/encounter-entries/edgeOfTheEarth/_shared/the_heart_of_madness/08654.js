// 08654 无光之海大厅（Hall of the Sunless Sea）· 地点（古代设施）· the_heart_of_madness
// 卡面：[action]如果你控制[seal_e]封印，位于无光之海大厅的调查员可以共同花费
//   1[per_investigator] 个线索并弃掉 2[per_investigator] 张手牌：激活[seal_e]封印。
// 读点：共同花费逐位走 runtime.spendClues；弃手牌走 api.discardChosen（每名本地调查员 2 张，
//   与卡面 per-investigator 口径一致）；激活走 campaign.seals.activate。
const CODE = '08654'
const SEAL = 'E'

function sealHeldBy(state, seat) {
  return state.campaign?.eote?.seals?.entries?.some(entry => entry.kind === SEAL
    && entry.active === false && entry.placedBySeat === seat && entry.locationId == null) || false
}

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, roomSeal: SEAL },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '控制封印 E：共同花费线索并弃手牌，激活封印 E',
    limit: { scope: 'perGame', owner: 'instance' },
    criteria: ({ state, inv }) => sealHeldBy(state, inv.seat),
    resolve: ({ state, inv, source, api }) => {
      const runtime = api.scenario || api
      const required = Math.max(1, Number(state.numInvestigators) || state.investigators.length || 1)
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === source.id)
      const total = mates.reduce((sum, other) => sum + (other.clues || 0), 0)
      if (total < required) {
        api.info('「无光之海大厅」：本地共同线索不足（需要 ' + required + '）。')
        return
      }
      let left = required
      for (const other of mates) {
        if (!left) break
        const pay = Math.min(left, other.clues || 0)
        if (pay > 0) runtime.spendClues(other.seat, pay)
        left -= pay
      }
      for (const other of mates) api.discardChosen(other.seat, 2, CODE)
      if (api.mechanics.eoteCampaign.seals.activate(SEAL)) {
        api.info('🔯 「无光之海大厅」：封印 E 被激活。')
      }
    },
  }],
}

