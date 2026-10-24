// 05133 凯夏的房间（Keziah’s Room）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[reaction] 成功调查后：不发现线索，改为放置未知地点牌库顶，然后可以移动过去；闹鬼：弃到巫术卡并抽取。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

const isEnemyCode = code => ALL_CARDS[code]?.type === 'enemy'
const findInEncounter = (state, predicate) => {
  for (let index = state.encounterDiscard.length - 1; index >= 0; index--) {
    const code = state.encounterDiscard[index]
    if (!predicate(code)) continue
    state.encounterDiscard.splice(index, 1)
    return code
  }
  for (let index = state.encounterDeck.length - 1; index >= 0; index--) {
    const code = state.encounterDeck[index]
    if (!predicate(code)) continue
    state.encounterDeck.splice(index, 1)
    return code
  }
  return null
}
const takeFromSetAside = (state, code) => {
  const list = state.scenarioZones?.setAside || []
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}
const spawnFromAside = (state, api, code, locationId) => {
  if (!locationId) return null
  takeFromSetAside(state, code)
  return api.spawn?.(code, locationId) || null
}
const traitsOf = card => (ALL_CARDS[originalOf(card)]?.traits || card?.traits || []).map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())

export default {
  code: '05133', scope: 'location', implemented: true,
  locationRule: {
    // behavior.investigateResult 读取；返回 false 表示「不发现线索」。
    onInvestigateSuccess({ state, location, inv, result, api }) {
      if (!result?.success) return undefined
      const id = api.cosmos?.({ id: 'unknownPlaces', draw: 1 })?.[0]
      if (!id) {
        api.info?.('🌫️ 未知地点牌库已空。')
        return false
      }
      api.place?.(id)
      const placed = state.locations.find(entry => entry.id === id)
      const here = state.locations.find(entry => entry.id === location.id)
      if (placed && here) {
        if (!here.connections.includes(id)) here.connections.push(id)
        if (!placed.connections.includes(location.id)) placed.connections.push(location.id)
      }
      api.info?.(`🌫️ 凯夏的房间：未知地点牌库顶的「${api.locName?.(id) || id}」以未揭示面入场。`)
      const answer = api.choose?.({
        kind: 'story', source: '05133', seat: inv.seat, canSkip: true,
        prompt: '是否移动到新放置的地点？',
        options: [{ id: 'stay', label: '留在凯夏的房间' }, { id: 'move', label: '移动到新地点' }],
      })
      if (answer === 'move') api.moveInvestigator?.(inv.seat, id)
      return false
    },
  },
}
