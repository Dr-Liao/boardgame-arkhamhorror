// 08702 身陷疯狂 · 附属到附身敌人，增加对它攻击、躲避及谈判的检定难度。
import { ALL_CARDS, entryDistance } from '../../../_shared.js'

const CODE = '08702'
const isPossessedEnemy = code => ALL_CARDS[code]?.type === 'enemy'
  && ALL_CARDS[code].traits?.some(trait => trait.toLowerCase() === 'possessed')

function chooseEnemy(state, inv, api, enemies) {
  const nearest = Math.min(...enemies.map(enemy => entryDistance(state, inv.location, enemy.location)))
  const candidates = enemies.filter(enemy => entryDistance(state, inv.location, enemy.location) === nearest)
  if (candidates.length === 1) return candidates[0]
  const id = api.choice({
    kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择一个最近的附身敌人。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name, locationId: enemy.location })),
  })
  return candidates.find(enemy => enemy.id === id)
}

function searchAndDrawEnemy(state, inv, api) {
  const candidates = [...new Set([...(state.encounterDeck || []), ...(state.encounterDiscard || [])].filter(isPossessedEnemy))]
  if (!candidates.length) return null
  const code = candidates.length === 1 ? candidates[0] : api.choice({
    kind: 'card', source: CODE, seat: inv.seat, prompt: '选择要抽取的附身敌人。',
    options: candidates.map(code => ({ id: code, cardCode: code, label: ALL_CARDS[code].nameZh || ALL_CARDS[code].name })),
  })
  if (!candidates.includes(code)) return null
  const from = api.takeEncounterDeckCard(code) ? 'search' : api.takeEncounterDiscard(code) ? 'discard' : null
  if (!from) return null
  const existing = new Set(state.enemies.map(enemy => enemy.id))
  api.drawEncounter(inv.seat, { code, from })
  api.shuffleEncounterDeck()
  return state.enemies.find(enemy => !existing.has(enemy.id) && (enemy.originalCode || enemy.code) === code)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  enemyAttachmentTestDifficulty: 1,
  encounterResolve(state, inv, card, api) {
    const inPlay = state.enemies.filter(enemy => !enemy.defeated && !enemy.removedFromGame
      && isPossessedEnemy(enemy.originalCode || enemy.code))
    const enemy = inPlay.length ? chooseEnemy(state, inv, api, inPlay) : searchAndDrawEnemy(state, inv, api)
    if (!enemy || !api.attachEncounterToEnemy(CODE, enemy.id)) return false
    if (inPlay.length) api.doomOn(enemy, 1)
    return true
  },
}
