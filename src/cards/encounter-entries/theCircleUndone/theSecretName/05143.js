// 05143 好事魔宠（Meddlesome Familiar）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：显现 - 布朗·詹金不在场则找出并生成在你地点且你受 1 伤；否则找鼠群与你交战，然后你受 1 伤。
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
  code: '05143', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const jenkin = state.enemies.find(enemy => String(originalOf(enemy)) === '05148')
    if (!jenkin) {
      const target = spawnFromAside(state, api, '05148', inv.location)
      if (target) {
        api.damage?.(inv.seat, 1)
        api.info?.(`🐀 「好事魔宠」：布朗·詹金在 ${inv.name} 所在地点生成，${inv.name} 受到 1 点伤害。`)
      }
      return false
    }
    const rats = findInEncounter(state, candidate => String(candidate) === '01159') || '01159'
    const spawned = spawnFromAside(state, api, rats, inv.location)
    if (spawned) spawnFromAside(state, api, '01159', inv.location)
    api.engage?.(spawned, inv.seat)
    api.damage?.(inv.seat, 1)
    api.info?.('🐀 「好事魔宠」：鼠群与你交战，然后你受到 1 点伤害。')
    return false
  },
}
