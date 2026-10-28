// 02296 哭嚎仪式
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：显现 - 弃掉每位调查员牌库顶3张卡牌。每位在[[幻境]]地点的调查员将其弃牌堆的每张弱点洗回自己牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS, activeInvestigators } from '../../_shared.js'

export default {
  code: '02296', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    for (const target of activeInvestigators(state)) api.discardTop(target.seat, 3)
    for (const target of activeInvestigators(state).filter(other =>
      state.locations.find(loc => loc.id === other.location)?.traits
        ?.some(trait => trait.toLowerCase() === 'altered'))) {
      api.shuffleDiscardWeaknessesIntoDeck?.(target.seat)
    }
    return false
  },
}
