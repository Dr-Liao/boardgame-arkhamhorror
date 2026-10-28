// 02101 世外诡影
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：the_beyond
// 卡面：险境。
// 卡面：显现 - 选择以下一种卡牌类型(支援、事件，或技能)。每位玩家必须弃掉手牌中所选类型的每张卡牌。如果这不是本阶段抽出的第一张世外诡影，改为选择两种卡牌类型。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../../_shared.js'

export default {
  code: '02101', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const key = `terrorFromBeyond:${state.round}:${state.phase}`
    const needed = state.scenarioFlags[key] >= 2 ? 2 : 1
    const labels = { asset: '支援', event: '事件', skill: '技能' }
    const types = Object.keys(labels)
    const options = needed === 1 ? types.map(type => ({ id: type, label: labels[type] }))
      : [['asset', 'event'], ['asset', 'skill'], ['event', 'skill']].map(pair => ({ id: pair.join(','),
        label: pair.map(type => labels[type]).join('与') }))
    const answer = api.choose({ kind: 'encounter', source: code, seat: inv.seat,
      prompt: `世外诡影：选择 ${needed} 种牌型，所有调查员弃掉手中对应卡牌。`, options })
    const chosen = new Set(answer.split(','))
    for (const target of state.investigators.filter(other => !other.defeated && !other.resigned)) {
      api.discardHandOfTypes?.(target.seat, [...chosen])
    }
    return false
  },
}
