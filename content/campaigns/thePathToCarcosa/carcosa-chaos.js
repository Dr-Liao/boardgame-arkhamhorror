import { ALL_CARDS } from '../../../src/cards/cards-data.js'

const hardSide = state => ['hard', 'expert'].includes(state.difficulty)
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const fx = (delta, extra = {}) => ({ delta, ...extra })
const hasTrait = (card, trait) => (card?.traits || []).some(value => String(value).toLowerCase() === trait.toLowerCase())
// 「场上的毁灭标记总数」：密谋 + 敌人 + 地点 + 调查员的支援/威胁（含所有卡上的毁灭）。
const doomInPlay = state => (state.doom || 0)
  + (state.enemies || []).reduce((sum, enemy) => sum + (enemy.doom || 0), 0)
  + (state.locations || []).reduce((sum, location) => sum + (location.doom || 0), 0)
  + (state.investigators || []).reduce((sum, inv) => sum + [...(inv.assets || []), ...(inv.threat || [])]
    .reduce((inner, card) => inner + (card.doom || 0), 0), 0)
const locationDistance = (state, from, targets) => {
  const queue = [[from, 0]]
  const seen = new Set([from])
  for (const [id, steps] of queue) {
    if (targets.includes(id)) return steps
    const location = state.locations.find(candidate => candidate.id === id)
    for (const next of location?.connections || []) {
      if (seen.has(next) || !state.locations.some(candidate => candidate.id === next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Infinity
}
const stepTowardNearestInvestigator = (state, enemy) => {
  const location = here(state, enemy)
  const investigatorLocations = active(state).map(inv => inv.location)
  if (!location || !investigatorLocations.length) return null
  const candidates = (location.connections || []).filter(id => state.locations.some(candidate => candidate.id === id))
  if (!candidates.length) return null
  const scored = candidates.map(id => ({ id, distance: locationDistance(state, id, investigatorLocations) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return null
  const best = Math.min(...scored.map(item => item.distance))
  return scored.find(item => item.distance === best)?.id || null
}

export function carcosaChaosToken(id, state, inv, token, api) {
  if (!['skull', 'cultist', 'tablet', 'elderthing'].includes(token)) return null
  const hard = hardSide(state)
  if (id === 'curtainCall') {
    if (token === 'skull') return fx(-Math.max(1, inv.horror + Number(hard)))
    if (token === 'cultist') return fx(hard ? -3 : -1)
    if (token === 'tablet') return fx(hard ? -4 : -2)
    return fx(hard ? -5 : -3)
  }
  if (id === 'theLastKing') {
    if (token === 'skull') return fx(hard ? -2 : -1, { drawAnother: true })
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -4 : -2)
    return fx(-(here(state, inv)?.shroud || 0) - Number(hard))
  }
  if (id === 'echoesOfThePast') {
    if (token === 'skull') return fx(-(state.enemies.filter(enemy => enemy.doom > 0).length + Number(hard)))
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -3 : -1)
    return fx(hard ? -5 : -3)
  }
  if (id === 'theUnspeakableOath') {
    if (token === 'skull') return fx(-(Math.max(1, state.scenarioFlags?.keysFound || 0) + Number(hard)))
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(0, { drawAnother: true })
    return fx(hard ? -5 : -3)
  }
  if (id === 'aPhantomOfTruth') {
    // [skull]：-X，X = 场上的毁灭标记总数（简单/普通封顶 5）。
    if (token === 'skull') return fx(-Math.min(hard ? Infinity : 5, doomInPlay(state)))
    if (token === 'cultist') return fx(-2)
    // [tablet]：取消投入本次检定的每张技能卡牌的效果和图标。
    if (token === 'tablet') return fx(hard ? -4 : -3, { cancelCommitted: true })
    return fx(hard ? -3 : -2)
  }
  if (id === 'thePallidMask') {
    // [skull]：-X，X = 到起始地点的地点数（简单/普通封顶 5）。
    if (token === 'skull') {
      const start = state.scenarioFlags?.startLocationId
      const distance = start && inv?.location ? locationDistance(state, start, [inv.location]) : 0
      return fx(-Math.min(hard ? Infinity : 5, Number.isFinite(distance) ? distance : 0))
    }
    // [cultist]：攻击期间揭示且检定成功时，本次攻击伤害减 1（困难/专家：不造成伤害）。
    if (token === 'cultist') {
      if (state.skillTest?.source?.label === '攻击') {
        state.skillTest.attackDamageReduction = hard ? 999 : 1
      }
      return fx(hard ? -3 : -2)
    }
    // [tablet]：所在地点重整中的食尸鬼/灵怪攻击你（困难/专家：先重整再攻击）。
    if (token === 'tablet') {
      const candidates = (state.enemies || []).filter(enemy => enemy.location === inv.location
        && (hasTrait(enemy, 'Ghoul') || hasTrait(enemy, 'Geist'))
        && (!enemy.exhausted || hard))
      if (candidates.length && typeof api?.attack === 'function') {
        let chosen = candidates[0]
        if (candidates.length > 1 && typeof api.choose === 'function') {
          const answer = api.choose({
            kind: 'enemy', source: 'pallidMaskTablet', seat: inv.seat,
            prompt: '选择攻击你的[[食尸鬼]]或[[灵怪]]敌人。',
            options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
          })
          chosen = candidates.find(enemy => enemy.id === answer) || chosen
        }
        if (hard) chosen.exhausted = false
        api.attack(chosen, inv)
      }
      return fx(hard ? -3 : -2)
    }
    return fx(hard ? -4 : -3)
  }
  if (id === 'blackStarsRise') {
    const opposingDoom = Number(state.scenarioFlags?.opposingAgendaDoom || 0)
    if (token === 'skull') return fx(-(opposingDoom + 1 + Number(hard)))
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -3 : -1)
    return fx(hard ? -5 : -3)
  }
  if (id === 'dimCarcosa') {
    const total = Number(state.campaign.records.doubt || 0) + Number(state.campaign.records.conviction || 0)
    if (token === 'skull') return fx(-(Math.max(1, total) + Number(hard)))
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -4 : -2)
    return fx(hard ? -6 : -4)
  }
  return null
}

// 03240 的 [elder_thing]：查找遭遇牌库与弃牌堆里的[[食尸鬼]]/[[灵怪]]敌人并抽取。
function searchGhoulOrGeist(state, inv, api) {
  const candidates = []
  for (const [pileName, pile] of [['encounterDeck', state.encounterDeck || []], ['encounterDiscard', state.encounterDiscard || []]]) {
    pile.forEach((code, index) => {
      const card = ALL_CARDS[code?.originalCode || code]
      if (!card || card.type !== 'enemy') return
      if (!(card.traits || []).some(trait => ['ghoul', 'geist'].includes(String(trait).toLowerCase()))) return
      candidates.push({ code, index, pileName, name: card.nameZh || card.name || code })
    })
  }
  if (!candidates.length) {
    api.info?.('遭遇牌库与弃牌堆里没有[[食尸鬼]]或[[灵怪]]敌人。')
    return false
  }
  let chosen = candidates[0]
  if (candidates.length > 1 && typeof api.choose === 'function') {
    const answer = api.choose({
      kind: 'card', source: 'pallidMaskElderThing', seat: inv.seat,
      prompt: '查找遭遇牌库与弃牌堆，选择要抽取的[[食尸鬼]]或[[灵怪]]敌人。',
      options: candidates.map((candidate, index) => ({
        id: String(index), cardCode: candidate.code,
        label: `${candidate.name}（${candidate.pileName === 'encounterDeck' ? '遭遇牌库' : '遭遇弃牌堆'}）`,
      })),
    })
    chosen = candidates[Number(answer)] || chosen
  }
  const pile = chosen.pileName === 'encounterDeck' ? state.encounterDeck : state.encounterDiscard
  const [code] = pile.splice(chosen.index, 1)
  state.encounterDeck.push(code)
  api.info?.(`${inv.name} 从${chosen.pileName === 'encounterDeck' ? '遭遇牌库' : '遭遇弃牌堆'}找出了「${chosen.name}」并抽取。`)
  if (typeof api.drawEncounter === 'function') api.drawEncounter(inv.seat)
  else {
    state.encounterDeck.push(code)
  }
  return true
}

export function carcosaChaosAfterTest(id, state, inv, result, api) {
  const tokens = result.drawn.filter(token => !result.cancelledTokens?.includes(token))
  const has = token => tokens.includes(token)
  const hard = hardSide(state)
  if (id === 'curtainCall' && !result.success) {
    const location = here(state, inv)
    if (has('cultist')) location.horror = (location.horror || 0) + 1
    if (has('tablet')) api.horror(inv.seat, 1)
    if (has('elderthing')) hard ? api.horror(inv.seat, 2) : (location.horror = (location.horror || 0) + 1)
  }
  if (id === 'theLastKing' && !result.success) {
    if (has('skull')) {
      const target = state.enemies.find(enemy =>
        enemy.traits?.some(trait => ['Lunatic', 'Possessed'].includes(trait)))
      if (target) target.doom = (target.doom || 0) + 1
    }
    if (has('cultist')) inv.clues = Math.max(0, inv.clues - (hard ? 2 : 1))
    if (has('tablet')) api.horror(inv.seat, hard ? 2 : 1)
    if (has('elderthing') && hard) api.damage(inv.seat, 1)
  }
  if (id === 'echoesOfThePast' && !result.success) {
    if (has('cultist')) state.doom++
    if (has('tablet')) api.horror(inv.seat, 1)
  }
  if (id === 'theUnspeakableOath' && !result.success) {
    if (has('cultist')) api.horror(inv.seat, 1)
    if (has('elderthing')) api.damage(inv.seat, hard ? 2 : 1)
  }
  if (id === 'aPhantomOfTruth' && !result.success) {
    if (has('cultist')) {
      // 场上每个未交战的[[拜亚基]]朝最近的调查员移动一次。
      for (const byakhee of state.enemies.filter(enemy => hasTrait(enemy, 'Byakhee') && enemy.engagedSeat == null)) {
        const destination = stepTowardNearestInvestigator(state, byakhee)
        if (destination) api.moveEnemy?.(byakhee, destination)
      }
    }
    if (has('elderthing')) {
      const loss = Math.max(0, result.difficulty - result.value)
      inv.resources = Math.max(0, (inv.resources || 0) - loss)
      if (loss) api.info?.(`${inv.name} 因「真相幻影」的[elder_thing]失去 ${loss} 资源。`)
    }
  }
  if (id === 'thePallidMask') {
    // [cultist] 的减伤在 token 结算时写入 state.skillTest（攻击成功时由攻击流程读取）。
    // [elder_thing]：失败时查找遭遇牌库与弃牌堆，抽一张[[食尸鬼]]或[[灵怪]]。
    if (!result.success && has('elderthing')) searchGhoulOrGeist(state, inv, api)
  }
  if (id === 'blackStarsRise' && !result.success && has('elderthing')) state.doom++
  if (id === 'dimCarcosa' && !result.success) {
    if (has('cultist')) api.horror(inv.seat, 1)
    if (has('tablet')) for (const target of active(state)) api.horror(target.seat, hard ? 2 : 1)
  }
}
