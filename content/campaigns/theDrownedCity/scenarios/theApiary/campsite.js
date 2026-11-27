import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { MOTHER_CODE } from './definition.js'

const codeOf = card => card.originalCode || card.code
const isCultist = card => card?.type === 'enemy' && !card.subtype && card.traits?.includes('Cultist')
const campsite = state => state.locations?.find(location => location.id === 'lostCampsite')
export const campsiteDeck = state => state.scenarioZones?.apiaryLostCampsite || []

export function needsCampsiteSaveRepair(state) {
  return state.campaign?.phase === 'scenario'
    && state.scenarioFlags?.apiaryInterlude === 'lostPilgrims'
    && !Object.hasOwn(state.scenarioZones || {}, 'apiaryLostCampsite')
}

export function restoreCampsiteDeck(state, api) {
  const under = state.scenarioFlags.apiaryCultistsUnder || []
  // 原先的幕间把营地牌压在计分牌区域开头，入口行动从末尾追加计分牌。
  const record = state.log?.findLast(line => /^幕间：失落的朝圣者（叠在迷失营地下的异教徒 \d+ 张）。$/.test(line))
  const count = Number(record?.match(/\d+/)?.[0])
  const cards = Number.isInteger(count) ? under.slice(0, count)
    : under.filter(code => code === '11723' || code === '11724')
  state.scenarioFlags.apiaryCultistsUnder = Number.isInteger(count) ? under.slice(count)
    : under.filter(code => code !== '11723' && code !== '11724')
  const zones = state.scenarioZones ||= {}
  zones.apiaryLostCampsite = api.shuffle(cards)
}

export function prepareCampsiteDeck(state, api, shuffle) {
  const cards = [...campsiteDeck(state)]
  for (const enemy of [...(state.enemies || [])]) {
    if (!isCultist(ALL_CARDS[codeOf(enemy)])) continue
    if (api.discardEnemy) api.discardEnemy(enemy)
    else {
      state.enemies.splice(state.enemies.indexOf(enemy), 1)
      cards.push(codeOf(enemy))
    }
  }
  const zones = state.scenarioZones ||= {}
  for (const pile of [state.encounterDeck, state.encounterDiscard, zones.setAside, state.removedFromGame, state.setAsideEnemies, state.victoryDisplay]) {
    if (!Array.isArray(pile)) continue
    for (let index = pile.length - 1; index >= 0; index--) {
      const value = pile[index]
      const code = typeof value === 'string' ? value : codeOf(value)
      if (!isCultist(ALL_CARDS[code])) continue
      pile.splice(index, 1)
      cards.push(code)
    }
  }
  zones.apiaryLostCampsite = shuffle(cards)
  return zones.apiaryLostCampsite.length
}

export function campsiteDrawMove(state, inv) {
  const location = campsite(state)
  if (!location?.revealed || location.id !== inv.location || !campsiteDeck(state).length
    || !registeredEntry(codeOf(location))?.flags?.drawFromBeneathLostCampsite) return null
  return { action: 'scenarioAction', rule: 'apiaryDrawCampsite', locationId: location.id,
    actions: 1, label: '抽取迷失营地下方最上方的卡牌' }
}

export function drawCampsite(state, inv, api) {
  if (!campsiteDrawMove(state, inv) || !api.drawEncounter) return false
  api.drawEncounter(inv.seat, { code: campsiteDeck(state).pop(), from: 'search' })
  return true
}

export function chamberTurnEnded(state, inv, api = {}) {
  const location = state.locations.find(item => item.id === inv.location)
  const spec = location?.revealed && registeredEntry(codeOf(location))?.flags?.endTurnTest
  if (!spec || !api.test || inv.defeated || inv.resigned) return false
  api.test(inv.seat, spec.skill, spec.difficulty, result => {
    if (result.success) return
    const targets = (location.connections || []).filter(id => api.canMoveTo?.(inv.seat, id))
    const mother = state.enemies.find(enemy => codeOf(enemy) === MOTHER_CODE)
    const options = []
    if (targets.length) options.push({ id: 'move', label: '移动到一处相连地点' })
    if (mother) options.push({ id: 'attack', label: '主母攻击你' })
    if (!options.length) return
    const select = (choices, prompt) => choices.length === 1 ? choices[0].id
      : api.choose({ kind: 'choice', seat: inv.seat, source: location.id, prompt, options: choices })
    if (select(options, '选择中央腔室检定失败的后果') === 'attack') api.attack(mother, inv)
    else api.moveInvestigator(inv.seat, select(targets.map(id => ({ id, label: state.locations.find(item => item.id === id)?.name || id })), '选择相连地点'))
  })
  return true
}
