import { requestChoice } from '../../../../../src/engine/resolution.js'
import { encounterRules } from '../../encounter-rules.js'
import { carcosaChaosToken } from '../../carcosa-chaos.js'
import { storyText } from '../../story-text.js'
import { actTwoVariants } from './definition.js'

const POSSESSION_CODES = new Set(['03340', '03341', '03342'])
const HASTUR_CODES = new Set(['03332', '03333', '03334'])
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const clone = value => structuredClone(value)
const LOCATION_BACKS = {
  '03325': '03325b', '03326a': '03326b', '03326c': '03326d',
  '03327a': '03327b', '03327c': '03327d', '03327e': '03327f',
  '03328a': '03328b', '03328c': '03328d', '03328e': '03328f',
  '03329a': '03329b', '03329c': '03329d', '03330': '03330b', '03331': '03331b',
}

function random(api, state) {
  if (api?.random) return api.random()
  if (api?.randomValue) return api.randomValue(state)
  throw new Error('卡城幽影的随机布置必须在规则事务中执行')
}

function pick(api, state, values) {
  return values[Math.min(values.length - 1, Math.floor(random(api, state) * values.length))]
}

function hastur(state) {
  return state.enemies.find(enemy => HASTUR_CODES.has(enemy.code))
}

function strikeHastur(state, api, amount, exhaust = false) {
  const enemy = hastur(state)
  if (!enemy) return
  api.damageEnemy(enemy.id, amount * state.numInvestigators, state.campaign.leadSeat, 'encounter')
  if (exhaust && state.enemies.includes(enemy)) api.evadeEnemy(enemy)
}

function lockStory(location) {
  location.carcosaStoryResolved = true
  location.cannotFlipAgain = true
}

function replaceLocation(state, location, api, backCode) {
  const variants = state.scenario.locationVariants?.[location.id] || []
  const candidates = variants.filter(candidate =>
    candidate.originalCode !== location.originalCode
    && state.scenarioZones.setAside?.includes(candidate.originalCode))
  if (!candidates.length) { lockStory(location); return }
  const chosen = candidates.length === 1 ? candidates[0]
    : candidates[Math.min(candidates.length - 1, Math.floor(api.random() * candidates.length))]
  const setAsideIndex = state.scenarioZones.setAside.indexOf(chosen.originalCode)
  if (setAsideIndex >= 0) state.scenarioZones.setAside.splice(setAsideIndex, 1)
  state.scenarioZones.removed ||= []
  state.scenarioZones.removed.push(location.originalCode, backCode)
  const preserved = {
    id: location.id, revealed: true, attachments: location.attachments || [],
    connections: location.connections || chosen.connections || [],
  }
  Object.assign(location, clone(chosen), preserved)
  location.maxClues = chosen.cluesFixed ?? (chosen.cluesPerInvestigator || 0) * state.numInvestigators
  location.clues = location.maxClues
}

export function actTwoVersion(state, choose = null) {
  const doubt = Number(state.campaign.records.doubt || 0)
  const conviction = Number(state.campaign.records.conviction || 0)
  if (doubt + conviction <= 5) return 1
  if (doubt > conviction) return 2
  if (conviction > doubt) return 3
  const options = [
    { id: '2', label: '使用场景2—搜寻陌生人（版本二）' },
    { id: '3', label: '使用场景2—搜寻陌生人（版本三）' },
  ]
  const answer = choose
    ? choose({ kind: 'story', source: 'dimCarcosaAct2', seat: state.campaign.leadSeat, options })
    : requestChoice(state, {
      kind: 'story',
      source: 'dimCarcosaAct2',
      seat: state.campaign.leadSeat ?? active(state)[0]?.seat ?? 0,
      prompt: '疑惑与确信相等。由调查员队长选择场景2版本。',
      options,
    })
  if (!['2', '3'].includes(String(answer))) throw new Error('无效的卡城幽影场景2版本')
  return Number(answer)
}

export function setupPlan(state, api) {
  state.scenarioFlags ||= {}
  if (state.scenarioFlags.dimCarcosaPlan) return state.scenarioFlags.dimCarcosaPlan
  const version = actTwoVersion(state, api?.choose)
  const variants = {
    bleakPlains: pick(api, state, ['03326a', '03326c']),
    ruinsOfCarcosa: pick(api, state, ['03327a', '03327c', '03327e']),
    dimStreets: pick(api, state, ['03328a', '03328c', '03328e']),
    depthsOfDemhe: pick(api, state, ['03329a', '03329c']),
  }
  const all = {
    bleakPlains: ['03326a', '03326c'],
    ruinsOfCarcosa: ['03327a', '03327c', '03327e'],
    dimStreets: ['03328a', '03328c', '03328e'],
    depthsOfDemhe: ['03329a', '03329c'],
  }
  const plan = {
    version,
    variants,
    startLocation: state.campaign.records.youOpenedThePathBelow ? 'shoresOfHali' : 'darkSpires',
    locations: ['shoresOfHali', 'darkSpires', 'bleakPlains', 'ruinsOfCarcosa',
      'dimStreets', 'depthsOfDemhe', 'palaceOfTheKing'],
    setAside: [
      '03059', '03088', '03332', '03333', '03334',
      ...Object.entries(all).flatMap(([id, codes]) => codes.filter(code => code !== variants[id])),
    ],
  }
  state.scenarioFlags.dimCarcosaPlan = plan
  return plan
}

function addTrauma(state, api, seat, kind, amount) {
  if (api?.addTrauma) {
    api.addTrauma(state, seat, kind, amount, [])
    return
  }
  const record = state.campaign.investigators[seat]
  state.campaign.trauma[seat][kind] += amount
  record.trauma[kind] += amount
}

function stableInvestigatorId(state, inv) {
  return state.campaign.investigators?.[inv.seat]?.id || inv.campaignId
}

function recordPossessed(state) {
  const ids = state.investigators
    .filter(inv => inv.hand.some(code => POSSESSION_CODES.has(code)))
    .map(inv => stableInvestigatorId(state, inv))
    .filter(Boolean)
  state.campaign.records.possessed ||= []
  for (const id of ids) if (!state.campaign.records.possessed.includes(id)) {
    state.campaign.records.possessed.push(id)
  }
  state.campaign.privateEpiloguesByInvestigatorId ||= {}
  for (const id of ids) {
    state.campaign.privateEpiloguesByInvestigatorId[id] = clone(storyText.possessedEpilogue)
  }
  return ids
}

function driveAllInsane(state) {
  state.campaign.failed = true
  for (const record of Object.values(state.campaign.investigators || {})) {
    if (record.status === 'active') record.status = 'insane'
  }
}

export const behavior = {
  ...encounterRules,
  id: 'dimCarcosa',
  locationsStartRevealed: true,
  setupPlan,
  startLocation(state) {
    return state.campaign.records.youOpenedThePathBelow ? 'shoresOfHali' : 'darkSpires'
  },
  resolveChaosToken(state, inv, token, api) {
    const base = carcosaChaosToken('dimCarcosa', state, inv, token, api)
    if (!base) return null
    const hard = ['hard', 'expert'].includes(state.difficulty)
    if (token === 'skull') {
      const sanity = Math.max(0, (inv.maxSanity || inv.sanity || 0)
        + inv.assets.reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0))
      const remaining = Math.max(0, sanity - (inv.horror || 0))
      return { delta: hard ? -(inv.horror || 0) : remaining === 0 ? -4 : -2 }
    }
    if (token === 'cultist') return { delta: 0, drawAnother: true }
    if (token === 'tablet') return { delta: hard ? -5 : -3 }
    const enemy = state.enemies.find(item => item.id === state.skillTest?.targetId)
    if (enemy && ['fight', 'evade'].includes(state.skillTest?.action)
      && enemy.traits?.some(trait => ['Monster', 'Ancient One'].includes(trait))) {
      inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
    }
    return { delta: hard ? -5 : -3 }
  },
  setupLocations(state, events, api) {
    state.scenarioFlags = {}
    const plan = setupPlan(state, api)
    state.scenarioFlags.actTwoVersion = plan.version
    state.scenarioZones.setAside = [...plan.setAside]
    for (const [id, code] of Object.entries(plan.variants)) {
      state.locationVariants[id] = clone(state.scenario.locationVariants[id]
        .find(location => location.originalCode === code))
    }
    const actTwo = clone(actTwoVariants[plan.version - 1])
    state.acts = [state.acts[0], actTwo, state.acts[2]]
    state.scenario.acts = clone(state.acts)
    const tallies = Number(state.campaign.records.chasingTheStranger || 0)
    state.doom = tallies <= 2 ? 3 : tallies <= 5 ? 2 : tallies <= 8 ? 1 : 0
    for (const inv of state.investigators) {
      inv.horror += Math.floor((inv.maxSanity || inv.sanity || inv.baseSanity || 0) / 2)
      for (const pile of [inv.deck, inv.discard]) {
        for (let index = pile.length - 1; index >= 0; index--) {
          if (pile[index] === '03059') {
            pile.splice(index, 1)
            state.scenarioZones.setAside.push('03059')
          }
        }
      }
    }
    return plan.locations
  },
  locationStory(state, location, api, revealingSeat = null) {
    const back = LOCATION_BACKS[location.originalCode]
    if (!back || location.carcosaStoryResolved) return
    const seat = revealingSeat ?? active(state).find(inv => inv.location === location.id)?.seat
      ?? state.campaign.leadSeat
    if (back === '03325b') {
      strikeHastur(state, api, 1, true)
      lockStory(location)
    } else if (back === '03326b') {
      for (const inv of active(state)) api.healHorror(inv.seat, 3)
      const enemies = state.enemies.filter(enemy => !HASTUR_CODES.has(enemy.code))
      if (enemies.length) {
        const id = enemies.length === 1 ? enemies[0].id : api.choose({
          kind: 'enemy', source: back, seat, prompt: '选择受到4点伤害的非哈斯塔敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        if (id) api.damageEnemy(id, 4, seat, 'encounter')
      }
      replaceLocation(state, location, api, back)
    } else if (back === '03326d') {
      strikeHastur(state, api, 2)
      lockStory(location)
    } else if (back === '03327b') {
      for (const inv of active(state)) api.healHorror(inv.seat, 3)
      replaceLocation(state, location, api, back)
    } else if (back === '03327d') {
      const affectedEnemies = state.enemies.filter(enemy => !enemy.exhausted || enemy.engagedSeat != null)
      const options = []
      if (affectedEnemies.length) options.push({ id: 'enemy', label: '选择一名敌人横置并解除交战' })
      if (state.investigators[seat]?.horror > 0) options.push({ id: 'heal', label: '你治愈5点恐惧' })
      const choice = options.length <= 1 ? options[0]?.id : api.choose({
        kind: 'story', source: back, seat, prompt: '短暂休憩：选择一项。', options,
      })
      if (choice === 'heal') api.healHorror(seat, 5)
      else if (choice === 'enemy') {
        const id = affectedEnemies.length === 1 ? affectedEnemies[0].id : api.choose({
          kind: 'enemy', source: back, seat, prompt: '选择横置并解除交战的敌人。',
          options: affectedEnemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = state.enemies.find(candidate => candidate.id === id)
        if (enemy) api.evadeEnemy(enemy)
      }
      replaceLocation(state, location, api, back)
    } else if (back === '03327f') {
      strikeHastur(state, api, 1)
      lockStory(location)
    } else if (back === '03328b') {
      api.test(seat, 'intellect', 3, result => {
        if (!result.success) api.horror(seat, Math.max(1, result.difficulty - result.value))
        strikeHastur(state, api, 1)
        lockStory(location)
      })
    } else if (back === '03328d') {
      api.test(seat, 'combat', 2, result => {
        if (result.success) {
          const enemy = hastur(state)
          if (enemy) api.evadeEnemy(enemy)
        }
        replaceLocation(state, location, api, back)
      })
    } else if (back === '03328f') {
      api.test(seat, 'willpower', 1, result => {
        if (result.success) for (const inv of active(state)) {
          api.healHorror(inv.seat, Math.max(0, result.value - result.difficulty))
        }
        replaceLocation(state, location, api, back)
      })
    } else if (back === '03329b') {
      for (const inv of active(state)) api.healHorror(inv.seat, 5)
      replaceLocation(state, location, api, back)
    } else if (back === '03329d') {
      strikeHastur(state, api, 1, true)
      lockStory(location)
    } else if (back === '03330b') {
      const choice = api.choose({
        kind: 'story', source: back, seat, prompt: '坠落：你是否履行自己的职责？',
        options: [{ id: 'refuse', label: '下不了狠心' }, { id: 'push', label: '上前把她推下去' }],
      })
      if (choice === 'push') {
        api.horror(seat, 2)
        strikeHastur(state, api, 2)
        lockStory(location)
      } else location.storyRefused = true
    } else if (back === '03331b') {
      state.campaign.records.knowTheSecret = true
      lockStory(location)
      const enemy = hastur(state)
      if (enemy) api.checkEnemyDefeat(enemy)
    }
  },
  resolveEncounter(state, inv, card, api) {
    const code = card?.originalCode || card?.code || card
    if (POSSESSION_CODES.has(code)) {
      inv.hand.push(code)
      inv.hiddenCards ||= []
      inv.hiddenCards.push(code)
      return true
    }
    return encounterRules.resolveEncounter(state, inv, card, api)
  },
  afterTest(state, inv, result, api) {
    const hard = ['hard', 'expert'].includes(state.difficulty)
    const tokens = result.drawn || []
    if (!result.success && tokens.includes('cultist')) api.horror(inv.seat, hard ? 2 : 1)
    if (!result.success && tokens.includes('tablet') && state.enemies.some(enemy => HASTUR_CODES.has(enemy.code))) {
      const location = state.locations.find(item => item.id === inv.location)
      if (location) location.clues++
    }
  },
  actReveal(state, act, api) {
    if (act.originalCode === '03320') {
      if (!state.enemies.some(enemy => enemy.code === '03059')) api.spawn('03059', 'palaceOfTheKing')
    } else if (act.originalCode === '03321a') {
      const man = state.enemies.find(enemy => enemy.code === '03059')
      if (man) api.removeEnemyFromGame(man)
      if (!state.investigators.some(inv => inv.assets.some(asset => asset.code === '03321b'))) {
        api.giveAsset(state.campaign.leadSeat, '03321b', { cannotLeavePlay: true, sanityModifier: -2 })
      }
      api.spawn('03334', 'palaceOfTheKing')
    } else if (act.originalCode === '03322a') {
      const man = state.enemies.find(enemy => enemy.code === '03059')
      if (man) api.removeEnemyFromGame(man)
      api.spawn('03332', 'palaceOfTheKing')
    } else if (act.originalCode === '03323a') {
      const man = state.enemies.find(enemy => enemy.code === '03059')
      const location = man?.location || 'palaceOfTheKing'
      if (man) api.removeEnemyFromGame(man)
      api.spawn('03333', location)
    } else if (act.originalCode === '03324') {
      const defeated = state.scenarioFlags.defeatedHastur
      api.finish(defeated === '03334' ? 'r1' : defeated === '03332' ? 'r2' : 'r3')
    }
  },
  agendaReveal(state, agenda, api) {
    if (agenda.originalCode === '03318') {
      if (!state.enemies.some(enemy => enemy.code === '03088')) api.spawn('03088', 'palaceOfTheKing')
      api.shuffleDiscard()
    } else if (agenda.originalCode === '03319') {
      api.finish(Number(state.campaign.records.conviction || 0) >= Number(state.campaign.records.doubt || 0) ? 'r4' : 'r5')
    }
  },
  actions(state, inv) {
    const moves = []
    if (state.actIndex === 1 && state.scenarioFlags.actTwoVersion === 1
      && inv.seat === state.campaign.leadSeat) {
      // 只有领队能与男子对话；男子就在此处时，唯一可变的缺口是本回合的行动点。
      const man = state.enemies.find(enemy => enemy.code === '03059' && enemy.location === inv.location)
      if (man) moves.push({
        action: 'scenarioAction', rule: 'confrontStranger', actions: 3,
        label: '花费3行动，直面苍白面具下的男子',
        reason: inv.actionsLeft >= 3 ? null : `需要 3 个行动点（当前 ${inv.actionsLeft}）`,
      })
    }
    return moves
  },
  encounterActions(state, inv) {
    const moves = encounterRules.encounterActions?.(state, inv) || []
    const location = state.locations.find(candidate => candidate.id === inv.location)
    const enemy = hastur(state)
    if (enemy?.code === '03332') {
      moves.push({
        action: 'encounterAction', rule: 'exhaustKingInYellow', enemyId: enemy.id,
        actions: 1, label: `检定意志（${enemy.fight + Math.min(2, state.agendaIndex)}），横置哈斯塔`,
        reason: enemy.exhausted ? '哈斯塔已经横置，需要等他重整后才能再次检定' : null,
      })
    }
    const palaceDamage = 5 * state.numInvestigators
    const palaceLocked = location?.originalCode === '03331'
      && (!enemy || (enemy.damageTaken || 0) < palaceDamage)
    if (location?.revealed && !location.cannotFlipAgain) {
      moves.push({
        action: 'encounterAction', rule: 'flipCarcosaLocation', locationId: location.id,
        actions: 0, label: `翻面「${location.name}」（移除所有调查员控制的线索）`,
        reason: location.clues ? `需要先取走此地的线索（还剩 ${location.clues} 个）`
          : !palaceLocked ? null
            : !enemy ? '哈斯塔不在场上，此处暂时无法翻面'
              : `需要先在哈斯塔上放置 ${palaceDamage} 点伤害（当前 ${Math.min(enemy.damageTaken || 0, palaceDamage)}）`,
      })
    }
    return moves
  },
  performEncounterAction(state, inv, move, api) {
    if (move.rule === 'exhaustKingInYellow') {
      const enemy = state.enemies.find(candidate => candidate.id === move.enemyId
        && candidate.code === '03332' && !candidate.exhausted)
      if (!enemy) throw new Error('黄衣之王哈斯塔当前不能被横置')
      api.test(inv.seat, 'willpower', api.enemyFight(enemy, inv.seat), result => {
        if (result.success && state.enemies.includes(enemy)) enemy.exhausted = true
      }, 0, { type: 'scenario', label: '直面黄衣之王', code: '03332' })
      return
    }
    if (move.rule !== 'flipCarcosaLocation') {
      return encounterRules.performEncounterAction?.(state, inv, move, api)
    }
    const location = state.locations.find(candidate => candidate.id === move.locationId)
    if (!location || location.id !== inv.location || location.clues || location.cannotFlipAgain) {
      throw new Error('当前地点不能翻面')
    }
    for (const investigator of active(state)) {
      if (investigator.clues > 0) api.spendClues(investigator.seat, investigator.clues)
    }
    api.flipLocation(location.id, inv.seat)
  },
  performAction(state, inv, move, api) {
    if (move.rule !== 'confrontStranger') throw new Error(`未知卡城幽影行动：${move.rule}`)
    api.advanceAct()
  },
  enemyDefeated(state, enemy, api) {
    if (HASTUR_CODES.has(enemy.code)) state.scenarioFlags.defeatedHastur = enemy.code
    if (enemy.code === '03059' && state.actIndex === 1) state.scenarioFlags.strangerDefeated = true
    return encounterRules.enemyDefeated?.(state, enemy, api) || false
  },
  enemyCanBeDefeated(state, enemy, source) {
    if (enemy.code === '03059' && state.actIndex === 1) {
      if (state.scenarioFlags.actTwoVersion === 1) return false
      if (state.scenarioFlags.actTwoVersion === 2) return source === '03059'
    }
    if (!HASTUR_CODES.has(enemy.code)) return true
    if (state.agendaIndex < 2) return false
    return Boolean(state.campaign.records.knowTheSecret)
  },
  investigatorCanBeDefeated(state, inv, cause) {
    return cause !== 'horror'
  },
  canPlayCard(state, inv, card) {
    const location = state.locations.find(candidate => candidate.id === inv.location)
    if (['03326a', '03326c'].includes(location?.originalCode)
      && card.type === 'asset' && card.traits?.some(trait => String(trait).toLowerCase() === 'ally')) return false
    if (['03329a', '03329c'].includes(location?.originalCode)
      && /\bFast[. ]/i.test(card.text || '')) return false
    return true
  },
  enemyStatModifier(state, enemy, stat) {
    const shared = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    return shared + (HASTUR_CODES.has(enemy.code) && stat === 'fight' ? Math.min(2, state.agendaIndex) : 0)
  },
  cluesGained(state, inv, amount, api) {
    const location = state.locations.find(candidate => candidate.id === inv.location)
    if (!amount || location?.clues !== 0) return
    if (['03327a', '03327c', '03327e'].includes(location.originalCode)) api.damage(inv.seat, 1)
    if (['03328a', '03328c', '03328e'].includes(location.originalCode)) api.loseActions(inv.seat, 1)
  },
  checkObjectives(state, api) {
    const hasturDamage = Math.max(0, ...state.enemies.filter(enemy => HASTUR_CODES.has(enemy.code))
      .map(enemy => enemy.damageTaken || 0))
    if (state.agendaIndex === 0 && hasturDamage >= 3 * state.numInvestigators) api.advanceAgenda()
    else if (state.agendaIndex === 1 && hasturDamage >= 5 * state.numInvestigators) api.advanceAgenda()
    if (state.actIndex === 1 && state.scenarioFlags.actTwoVersion !== 1 && state.scenarioFlags.strangerDefeated) {
      api.advanceAct()
    }
    if (state.actIndex === 2 && state.scenarioFlags.defeatedHastur) api.advanceAct()
  },
  storyResolutionKey(state, key) {
    return key === 'noResolution'
      ? Number(state.campaign.records.conviction || 0) >= Number(state.campaign.records.doubt || 0) ? 'r4' : 'r5'
      : key
  },
  resolution(state, key, events, api = {}) {
    if (key === 'noResolution') {
      key = Number(state.campaign.records.conviction || 0) >= Number(state.campaign.records.doubt || 0) ? 'r4' : 'r5'
    }
    if (!['r1', 'r2', 'r3', 'r4', 'r5'].includes(key)) throw new Error('未知卡城幽影结局')
    const records = state.campaign.records
    if (['r1', 'r2', 'r3'].includes(key)) {
      records.theInvestigatorsPreventedHasturFromEscapingHisPrison = true
      recordPossessed(state)
      for (const inv of state.investigators) {
        if (key === 'r1') {
          addTrauma(state, api, inv.seat, 'physical', 2)
          addTrauma(state, api, inv.seat, 'mental', 2)
        } else addTrauma(state, api, inv.seat, key === 'r2' ? 'mental' : 'physical', 2)
      }
      return { award: true, bonus: 5 }
    }
    if (key === 'r4') records.theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth = true
    else records.hasturHasYouInHisGrasp = true
    driveAllInsane(state)
    return { award: false }
  },
}
