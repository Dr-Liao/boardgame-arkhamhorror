// 05121 隐士·IX（The Hermit · IX）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：每个非弱点敌人 +1 生命；反应 - 击败布朗·詹金/那赫卜得线索。背面 - 找鼠群/布朗·詹金。
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

// 上面的模板片段存在语法风险，改为完整手写 05121。
export default {
  code: '05121', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const jenkin = state.enemies.find(enemy => String(originalOf(enemy)) === '05148')
      let rats = findInEncounter(state, candidate => String(candidate) === '01159')
      if (jenkin) {
        spawnFromAside(state, api, rats || '01159', jenkin.location)
      } else {
        spawnFromAside(state, api, '05148', state.investigators[state.campaign?.leadSeat ?? 0]?.location)
        const found = state.enemies.find(enemy => String(originalOf(enemy)) === '05148')
        if (found) spawnFromAside(state, api, rats || '01159', found.location)
      }
      if (state.numInvestigators >= 3) {
        const witchHouse = state.locations.filter(location =>
          (ALL_CARDS[originalOf(location)]?.traits || []).some(trait => String(trait).toLowerCase() === 'witch house'))
        const target = witchHouse.length === 1 ? witchHouse[0]
          : witchHouse[Math.min(witchHouse.length - 1, Math.floor((api.random?.() ?? 0.5) * witchHouse.length))]
        rats = findInEncounter(state, candidate => String(candidate) === '01159')
        spawnFromAside(state, api, rats || '01159', target?.id)
      }
      return true
    },
  },
}
