// Shared encounter sets used by multiple chapters. These handlers receive the
// engine adapter and participate in its replayable choices and skill tests.
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { changeChaosBag } from '../../../src/engine/chaos-bag.js'
const textActive = (state, enemy) => !enemy.textBlanked || enemy.textBlanked.round !== state.round || enemy.textBlanked.phase !== state.phase

export const implementedTreacheries = new Set(['02081', '02082', '02083', '02084', '02085', '02088', '02091', '02092', '02093', '02096', '02099', '02100', '02101', '02102'])
export const encounterRules = {
  canPlayScenarioCard(state, inv, code) {
    return ['02040', '02061', '02080', '02140', '02217', '02218', '02219'].includes(code)
      && state.campaign.investigators[inv.seat]?.deck.includes(code)
  },
  assetEntered(state, inv, asset) {
    if (asset.code === '02219') asset.clues = ['drHenryArmitage', 'professorWarrenRice', 'drFrancisMorgan', 'zebulonWhateley', 'earlSawyer']
      .filter(key => state.campaign.records[`${key}SurvivedTheDunwichLegacy`]).length
  },
  spawnLocation(state, code, origin, seat, api) {
    let candidates = null
    const distance = target => {
      const queue = [[origin, 0]], seen = new Set([origin])
      for (const [id, n] of queue) {
        if (id === target) return n
        for (const next of state.locations.find(loc => loc.id === id)?.connections || [])
          if (!seen.has(next)) { seen.add(next); queue.push([next, n + 1]) }
      }
      return Infinity
    }
    if (code === '02086') { const most = Math.max(...state.locations.map(loc => loc.clues)); candidates = state.locations.filter(loc => loc.clues === most) }
    if (code === '02095') { const farthest = Math.max(...state.locations.map(loc => distance(loc.id))); candidates = state.locations.filter(loc => distance(loc.id) === farthest) }
    if (code === '02224') candidates = state.locations.filter(loc => !state.enemies.some(enemy => enemy.location === loc.id)
      && !state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === loc.id))
    if (code === '02183') return state.scenarioZones.train?.[state.scenarioZones.train.indexOf(origin) + 1] || origin
    if (code === '02294') candidates = state.locations.filter(loc => loc.originalCode === '02282')
    if (code === '02295') {
      const altered = state.locations.filter(loc => loc.traits?.includes('Altered'))
      const nearest = Math.min(...altered.map(loc => distance(loc.id)))
      candidates = altered.filter(loc => distance(loc.id) === nearest)
    }
    if (code === '02329') candidates = state.locations.filter(loc => loc.traits?.includes('Extradimensional'))
    if (code === '02330') candidates = state.locations.filter(loc => loc.originalCode === '02320')
    if (candidates == null) return origin
    if (!candidates.length) return null
    if (candidates.length === 1) return candidates[0].id
    return api.choose({ kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
      prompt: '选择符合生成条件的地点。', options: candidates.map(loc => ({ id: loc.id, label: loc.name })) })
  },
  statModifier(state, inv, skill) {
    const blank = inv.threat.some(item => item.code === '02088')
    const bonuses = { '02061': 'intellect', '02080': 'combat', '02217': 'willpower', '02218': 'agility', '02140': 'intellect' }
    return -state.enemies.filter(enemy => enemy.code === '02090' && enemy.location === inv.location && textActive(state, enemy)).length
      + inv.assets.filter(asset => bonuses[asset.code] === skill && (!blank || !ALL_CARDS[asset.code]?.traits?.includes('Ally'))).length
  },
  assetLeftPlay(state, inv, asset) {
    if (!['02138', '02139'].includes(asset.code) || inv.threat.some(item => item.code === '02088')) return
    asset.removedFromGame = true
    state.scenarioZones.removed.push(asset.code)
    changeChaosBag(state, 'tablet', 1, { permanent: true })
  },
  cardDrawn(state, inv, code, api) {
    const armitage = inv.assets.find(asset => asset.code === '02040' && !asset.exhausted)
    if (armitage && !inv.threat.some(item => item.code === '02088') && this.canGainResources(state, inv)) {
      if (api.choose({ kind: 'reaction', source: '02040', seat: inv.seat, canSkip: true,
        prompt: '横置阿米蒂奇并弃掉刚抽到的牌，获得 3 资源？',
        options: [{ id: 'skip', label: '保留卡牌' }, { id: 'trigger', label: '弃牌并获得资源' }] }) === 'trigger') {
        inv.hand.splice(inv.hand.lastIndexOf(code), 1); inv.discard.push(code); armitage.exhausted = true; inv.resources += 3
      }
    }
    // Wizard of Yog-Sothoth: "When the engaged investigator draws a [[Hex]] or
    // [[Pact]] card: Wizard of Yog-Sothoth attacks that investigator."
    if (ALL_CARDS[code]?.traits?.some(trait => ['Hex', 'Pact'].includes(trait))) {
      for (const wizard of state.enemies.filter(enemy => enemy.code === '02087'
        && enemy.engagedSeat === inv.seat && textActive(state, enemy))) api.attack(wizard, inv)
    }
  },
  cluesGained(state, inv, _amount, api) {
    const ally = inv.assets.find(asset => asset.code === '02061' && !asset.exhausted)
    if (!ally || inv.threat.some(item => item.code === '02088') || state.locations.find(loc => loc.id === inv.location)?.clues !== 0) return
    if (api.choose({ kind: 'reaction', source: '02061', seat: inv.seat, canSkip: true,
      prompt: '横置赖斯教授，抽 1 张牌？',
      options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '横置并抽牌' }] }) === 'trigger') { ally.exhausted = true; api.drawCards(inv.seat, 1) }
  },
  enemyDefeated(state, enemy, api) {
    const inv = state.investigators[enemy.defeatedBy]
    const ally = inv?.assets.find(asset => asset.code === '02080' && !asset.exhausted)
    if (ally && !inv.threat.some(item => item.code === '02088') && api.choose({ kind: 'reaction', source: '02080', seat: inv.seat, canSkip: true,
      prompt: '横置摩尔根博士，抽 1 张牌？', options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '横置并抽牌' }] }) === 'trigger') {
      ally.exhausted = true; api.drawCards(inv.seat, 1)
    }
    return false
  },
  canGainResources(state, inv) { return !state.enemies.some(enemy => enemy.code === '02097' && enemy.engagedSeat === inv.seat && textActive(state, enemy)) },
  enemyAttackStarted(state, enemy, inv, api) {
    if (enemy.code === '02104') api.discardTop(inv.seat, 2)
    if (enemy.code === '02330' && inv.discard.length > 10) enemy.doom = (enemy.doom || 0) + 1
  },
  enemyAttackResolved(state, enemy, inv) {
    if (enemy.code === '02098' && textActive(state, enemy)) inv.resources = Math.max(0, inv.resources - 1)
  },
  enemySpawned(state, enemy, api) {
    if (enemy.code === '02183') enemy.exhausted = true
    if (enemy.code === '02329') encounterRules.enemyMoved(state, enemy, null, api)
  },
  canPlayCard(_state, inv, card) {
    return !(inv.threat.some(item => item.code === '02088') && card.type === 'asset' && card.traits?.includes('Ally'))
  },
  turnEnded(state, inv, api) {
    for (const threat of [...inv.threat].filter(item => item.code === '02088')) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) { inv.threat.splice(inv.threat.indexOf(threat), 1); state.encounterDiscard.push(threat.code) }
      })
    }
  },
  locationEntered(state, inv, loc, api, companions = []) {
    for (const enemy of state.enemies.filter(item => item.location === loc?.id && !companions.includes(item.id))) {
      for (const code of enemy.attachedTreacheries || []) if (code === '02096') api.horror(inv.seat, 1)
    }
  },
  enemyMoved(state, enemy, _from, api, skipSeat = null) {
    if (enemy.code === '02329' && textActive(state, enemy)) {
      const loc = state.locations.find(item => item.id === enemy.location)
      if (loc?.clues > 0) loc.clues--
      enemy.doom = (enemy.doom || 0) + 1
    }
    for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned && item.seat !== skipSeat && item.location === enemy.location)) {
      for (const code of enemy.attachedTreacheries || []) if (code === '02096') api.horror(inv.seat, 1)
    }
  },
  beforeHarm(state, _inv, harm) {
    return { ...harm, direct: harm.direct || !!state.scenarioFlags.lightOfAforgomon?.length }
  },
  publicAttachments(state) {
    const result = { act: [], agenda: [], locations: {} }
    for (const item of state.scenarioFlags?.lightOfAforgomon || [])
      if (item.index === state[item.type === 'act' ? 'actIndex' : 'agendaIndex']) result[item.type].push('02085')
    return result
  },
  actLeftPlay(state) { discardAforgomon(state, 'act', state.actIndex) },
  agendaLeftPlay(state) { discardAforgomon(state, 'agenda', state.agendaIndex) },
  encounterDrawn(state, inv, code, api) {
    if (api && ALL_CARDS[code]?.traits?.some(trait => ['Hex', 'Pact'].includes(trait)))
      for (const enemy of state.enemies.filter(item => item.code === '02087' && item.engagedSeat === inv.seat && textActive(state, item))) api.attack(enemy, inv)
    if (code !== '02101') return
    const key = `terrorFromBeyond:${state.round}:${state.phase}`
    state.scenarioFlags[key] = (state.scenarioFlags[key] || 0) + 1
  },
  resolveEncounter(state, inv, card, api) {
    const code = card.originalCode || card.code
    if (!implementedTreacheries.has(code)) throw new Error(`遭遇效果尚未迁移：${code}`)
    if (code === '02081') {
      for (const seat of state.scenarioFlags.hadDrink || []) {
        const target = state.investigators[seat]
        if (target && !target.defeated && !target.resigned) target.actionsLeft = Math.max(0, target.actionsLeft - 1)
      }
      api.drawEncounter(inv.seat)
      return { placed: false, surgeHandled: true }
    } else if (code === '02082') {
      const criminals = state.enemies.filter(e => e.location === inv.location && e.traits?.includes('Criminal'))
      if (criminals.length) for (const enemy of criminals) enemy.doom = (enemy.doom || 0) + 1
      else inv.resources = Math.max(0, inv.resources - 2)
    } else if (code === '02083') {
      api.test(inv.seat, 'willpower', 5, result => {
        if (!result.success) api.discardTop(inv.seat, Math.max(0, 5 - result.value))
      })
    } else if (code === '02084') {
      const exists = inv.threat.some(t => t.code === code)
      if (!exists) api.threat(inv.seat, code)
      encounterRules.deckEmptied(state, inv, api)
      api.drawEncounter(inv.seat)
      return { placed: !exists, surgeHandled: true }
    } else if (code === '02085') {
      const attached = state.scenarioFlags.lightOfAforgomon || []
      const options = ['act', 'agenda'].filter(type => !attached.some(item => item.type === type
        && item.index === state[type === 'act' ? 'actIndex' : 'agendaIndex']))
      if (!options.length) return false
      const chosen = options.length === 1 ? options[0] : api.choose({ kind: 'encounter', source: code, seat: inv.seat,
        prompt: '将亚弗戈蒙之光附属到当前密谋或当前场景（每张限 1 张）。',
        options: ['agenda', 'act'].filter(type => options.includes(type))
          .map(type => ({ id: type, label: type === 'act' ? '当前场景' : '当前密谋' })) })
      state.scenarioFlags.lightOfAforgomon = [...attached,
        { type: chosen, index: state[chosen === 'act' ? 'actIndex' : 'agendaIndex'] }]
      return true
    } else if (code === '02102') {
      const loc = state.locations.find(item => item.id === inv.location)
      loc.arcaneBarriers = (loc.arcaneBarriers || 0) + 1
      return true
    } else if (code === '02088') {
      api.threat(inv.seat, code)
      return true
    } else if (code === '02096') {
      const enemies = state.enemies.filter(enemy => enemy.traits?.includes('Abomination'))
      if (!enemies.length) api.drawEncounter(inv.seat)
      else {
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choose({
          kind: 'target', source: code, seat: inv.seat, prompt: '选择一只憎恶，治疗其全部伤害并附属变异野兽。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const chosen = enemies.find(enemy => enemy.id === enemyId)
        if (!chosen) throw new Error('必须选择一只憎恶')
        chosen.damageTaken = 0
        chosen.attachedTreacheries = [...(chosen.attachedTreacheries || []), code]
        return true
      }
    } else if (code === '02099') {
      const enemies = state.enemies.filter(enemy => enemy.engagedSeat == null && enemy.traits?.includes('Criminal'))
      if (!enemies.length) api.drawEncounter(inv.seat)
      for (const enemy of enemies) {
        api.moveEnemy(enemy, api.stepToward(enemy.location, inv.location))
        if (enemy.engagedSeat === inv.seat) api.attack(enemy, inv)
      }
    } else if (code === '02091') {
      api.test(inv.seat, 'willpower', 2 + inv.damage, result => { if (!result.success) api.horror(inv.seat, 2) })
    } else if (code === '02092') { api.threat(inv.seat, code); return true }
    else if (code === '02100') {
      const assets = inv.assets.filter(asset => !state.scenario.storyAssets?.[asset.code]
        && !ALL_CARDS[asset.code]?.permanent)
      if (!assets.length) return false
      const choice = api.choose({ kind: 'target', source: code, seat: inv.seat,
        prompt: '选择一张非剧情支援洗入牌库，然后弃掉牌库顶 3 张。',
        options: assets.map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || asset.code })) })
      const returned = api.shuffleAssetIntoDeck(inv.seat, choice)
      if (api.discardTop(inv.seat, 3).includes(returned)) api.horror(inv.seat, 2)
    } else if (code === '02101') {
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
        const discarded = target.hand.filter(item => chosen.has(ALL_CARDS[item]?.type))
        target.hand = target.hand.filter(item => !chosen.has(ALL_CARDS[item]?.type))
        target.discard.push(...discarded)
      }
    } else if (code === '02093') {
      const token = state.chaosBag[Math.floor(api.random() * state.chaosBag.length)]
      if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token)) api.horror(inv.seat, 2)
      else if (/^[+-]?\d+$/.test(token) && Number(token) <= 0) api.damage(inv.seat, 1)
    }
    return false
  },
  deckEmptied(state, inv, api) {
    if (inv.deck.length || inv.defeated || inv.resigned) return
    const index = inv.threat.findIndex(t => t.code === '02084')
    if (index < 0) return
    inv.threat.splice(index, 1)
    state.encounterDiscard.push('02084')
    api.damage(inv.seat, 10)
  },
  afterTest(state, inv, result) {
    if (!result.success || result.value - result.difficulty < 1) return
    for (const threat of inv.threat.filter(t => t.code === '02092')) {
      inv.threat.splice(inv.threat.indexOf(threat), 1)
      state.encounterDiscard.push(threat.code)
    }
  },
}

function discardAforgomon(state, type, index) {
  const attached = state.scenarioFlags.lightOfAforgomon || []
  const leaving = attached.filter(item => item.type === type && item.index === index)
  state.scenarioFlags.lightOfAforgomon = attached.filter(item => !leaving.includes(item))
  state.encounterDiscard.push(...leaving.map(() => '02085'))
}
