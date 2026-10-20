import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { requestChoice } from '../../../../../src/engine/resolution.js'
import { encounterRules } from '../../encounter-rules.js'
import { carcosaChaosToken, carcosaChaosAfterTest } from '../../carcosa-chaos.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const original = card => card?.originalCode || card?.code
const hardSide = state => ['hard', 'expert'].includes(state.difficulty)
const symbolFamily = new Set(['cultist', 'tablet', 'elderthing'])
const rememberedFacts = [
  'setAFireInTheKitchen',
  'incitedAFightAmongstThePatients',
  'distractedTheGuards',
  'releasedADangerousPatient',
  'knowTheGuardsPatrols',
  'recalledTheWayOut',
]
const isLunatic = enemy => enemy.traits?.some(trait => ['Lunatic', 'Possessed'].includes(trait))

function randomIndex(length, api) {
  return Math.floor(api.random() * length)
}

function replaceSymbols(state, token) {
  const replace = bag => [...(bag || []).filter(face => !symbolFamily.has(face)), token, token]
  state.chaosBag = replace(state.chaosBag)
  state.campaign.chaosBag = replace(state.campaign.chaosBag)
}

function remember(state, fact) {
  state.scenarioFlags.remembered ||= []
  if (!state.scenarioFlags.remembered.includes(fact)) state.scenarioFlags.remembered.push(fact)
}

function addVipSlain(state, code) {
  const slain = state.campaign.records.vipsSlain ||= []
  if (!slain.includes(code)) slain.push(code)
}

function stashRandomMonster(state, api) {
  const monsters = state.scenarioZones.monsters || []
  if (!monsters.length) return null
  const code = monsters.splice(randomIndex(monsters.length, api), 1)[0]
  if (state.agendaIndex === 2) {
    state.encounterDeck.push(code)
    api.shuffleEncounterDeck()
  } else {
    state.scenarioZones.underAct ||= []
    state.scenarioZones.underAct.push(code)
  }
  return code
}

function chooseKeys(state, api, skills = ['combat', 'agility', 'intellect']) {
  const options = [
    ...skills.map(skill => ({ id: skill, label: `由一位调查员进行 [${skill}]（4）检定` })),
    { id: 'force', label: '强行夺走钥匙' },
  ]
  const answer = api.choose({
    kind: 'story', source: '03163', seat: state.campaign.leadSeat,
    prompt: '选择取得地下室钥匙的方式。', options,
  })
  if (answer === 'force') {
    state.scenarioFlags.tookKeysByForce = true
    state.scenarioFlags.keysFound = 1
    return
  }
  const candidates = active(state)
  const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
    kind: 'target', source: `03163-${answer}`, seat: state.campaign.leadSeat,
    prompt: '选择进行检定的调查员。',
    options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
  }))
  api.test(seat, answer, 4, result => {
    if (result.success) {
      state.scenarioFlags.keysFound = 1
      return
    }
    chooseKeys(state, api, skills.filter(skill => skill !== answer))
  })
}

function unspeakableChaosToken(state, inv, token, api) {
  if (!symbolFamily.has(token) && token !== 'skull') {
    return carcosaChaosToken('theUnspeakableOath', state, inv, token, api)
  }
  const hard = hardSide(state)
  if (token === 'skull') return hard ? { delta: 0, drawAnother: true } : { delta: -1 }
  if (token === 'cultist') return { delta: -(inv.horror || 0) }
  if (token === 'tablet') {
    const location = state.locations.find(candidate => candidate.id === inv.location)
    return { delta: -(location?.shroud || 0) }
  }
  const monsters = state.scenarioZones.monsters || []
  if (!monsters.length) return { delta: 0, autoFail: true }
  const answer = api.choose({
    kind: 'chaos', source: '03159-elderthing', seat: inv.seat,
    prompt: '古神标记：将随机怪物放到场景牌库底下，或令本次检定自动失败。',
    options: [{ id: 'monster', label: '放置随机怪物' }, { id: 'fail', label: '本次检定自动失败' }],
  })
  if (answer === 'monster') {
    stashRandomMonster(state, api)
    return { delta: 0 }
  }
  return { delta: 0, autoFail: true }
}

function discardHidden(state, inv, code) {
  const handIndex = inv.hand.indexOf(code)
  if (handIndex >= 0) inv.hand.splice(handIndex, 1)
  const hiddenIndex = (inv.hiddenCards || []).indexOf(code)
  if (hiddenIndex >= 0) inv.hiddenCards.splice(hiddenIndex, 1)
  state.encounterDiscard.push(code)
}

export function setupPlan(state) {
  const halls = state.scenarioFlags?.oathHalls || {
    west: state.scenario.hallPools.west[0],
    east: state.scenario.hallPools.east[0],
  }
  return {
    locations: [
      halls.west, halls.east, 'messHall', 'kitchen', 'yard', 'garden',
      'infirmary', 'basementHall',
    ],
    setAside: ['03178', '03179', '03180', '03181', '03182a'],
    removed: state.scenarioZones?.removed || [],
  }
}

export const behavior = {
  ...encounterRules,
  id: 'theUnspeakableOath',
  spawnOverrides: { '03183': 'basementHall' },
  setupPlan,
  resolveChaosToken(state, inv, token, api) {
    return unspeakableChaosToken(state, inv, token, api)
  },
  setupLocations(state, _events, api) {
    state.scenarioFlags = { remembered: [], tookKeysByForce: false, keysFound: 0 }
    state.scenarioZones.removed = []
    state.scenarioZones.underAct = []
    state.scenarioFlags.oathHalls = {}
    for (const [side, ids] of Object.entries(state.scenario.hallPools)) {
      const shuffled = api.shuffle([...ids], () => api.randomValue(state))
      state.scenarioFlags.oathHalls[side] = shuffled[0]
      state.scenarioZones.removed.push(state.scenario.locations[shuffled[1]].originalCode)
    }
    const rng = () => api.randomValue(state)
    state.scenarioZones.monsters = api.shuffle([...state.scenario.monsterDeck], rng)
    state.scenarioZones.lunatics = api.shuffle([...state.scenario.lunaticsDeck], rng)
    const halls = Object.values(state.scenarioFlags.oathHalls)
    for (const inv of active(state)) inv.location = halls[Math.floor(api.randomValue(state) * halls.length)]
    const tookClasp = !!state.campaign.records.youTookTheOnyxClasp
    state.acts.splice(tookClasp ? 2 : 1, 1)
    return setupPlan(state).locations
  },
  afterChaosBagSetup(state) {
    const extra = { easy: '-2', standard: '-3', hard: '-4', expert: '-5' }[state.difficulty] || '-3'
    state.chaosBag.push(extra)
    state.scenarioFlags.temporaryChaosToken = extra
  },
  afterMulligan(state) {
    if (!(state.campaign.records.vipsInterviewed || []).includes('03076a')) return
    for (const inv of active(state)) {
      if (!inv.deck.length) continue
      const underlyingCode = inv.deck.pop()
      inv.assets.push({
        id: `courage-${inv.seat}-${state.round}`,
        code: 'xcourage',
        underlyingCode,
        name: '胆量',
        cost: 0,
        sanity: 2,
        exhausted: false,
        courage: true,
      })
    }
  },
  assetLeftPlay(_state, _inv, asset) {
    if (asset.code !== 'xcourage') return
    asset.code = asset.underlyingCode || asset.originalCode
    delete asset.underlyingCode
    delete asset.originalCode
  },
  investigatorEntryError(_state, location, inv) {
    if (location.enterClueCost && !location.revealed && inv.clues < location.enterClueCost) return '进入未揭示的病人拘禁室需要花费 1 个线索'
    return null
  },
  beforeMove(_state, inv, location) {
    if (location.enterClueCost && !location.revealed) inv.clues--
  },
  locationRevealed(state, location, api) {
    const code = original(location)
    if (code === '03177' && !state.scenarioFlags.cellsPlaced) {
      state.scenarioFlags.cellsPlaced = true
      const cells = ['danielsCell', 'occupiedCell', 'drearyCell', 'familiarCell']
      for (let i = cells.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1, api)
        ;[cells[i], cells[j]] = [cells[j], cells[i]]
      }
      for (const id of cells) api.place(id)
    }
    if (code === '03178' && ['03164', '03165'].includes(original(state.acts[state.actIndex]))) api.advanceAct()
  },
  actReveal(state, act, api) {
    if (act.originalCode === '03163') {
      chooseKeys(state, api)
    } else if (act.originalCode === '03164') {
      const atCell = active(state).filter(inv => inv.location === 'danielsCell')
      const seat = atCell.length === 1 ? atCell[0].seat : Number(api.choose({
        kind: 'storyAsset', source: '03182a', seat: state.campaign.leadSeat,
        prompt: '选择一位位于丹尼尔牢房的调查员控制丹尼尔。',
        options: atCell.map(inv => ({ id: String(inv.seat), label: inv.name })),
      }))
      api.giveAsset(seat, '03182a')
      state.encounterDeck.push(...state.scenarioZones.underAct.splice(0))
      api.shuffleDiscard()
    } else if (act.originalCode === '03165') {
      api.spawn('03182b', 'danielsCell')
    } else if (act.originalCode === '03166') {
      const underAct = state.scenarioZones.underAct.splice(0)
      const discardedMonsters = state.encounterDiscard.filter(code =>
        state.scenario.enemies[code]?.traits?.includes('Monster')).length
      if (underAct.length + discardedMonsters >= 3) {
        state.encounterDeck.push(...underAct)
        api.shuffleDiscard()
        const index = state.encounterDeck.findLastIndex(code =>
          state.scenario.enemies[code]?.traits?.includes('Monster'))
        if (index >= 0) {
          const monster = state.encounterDeck.splice(index, 1)[0]
          const lowest = Math.min(...active(state).map(inv => inv.willpower))
          const candidates = active(state).filter(inv => inv.willpower === lowest)
          const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
            kind: 'target', source: '03166', seat: state.campaign.leadSeat,
            prompt: '选择一位意志最低的调查员抽取怪物。',
            options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
          }))
          api.spawn(monster, state.investigators[seat].location)
        }
      } else {
        state.encounterDeck.push(...underAct)
        api.shuffleDiscard()
      }
    } else if (act.originalCode === '03167') {
      api.finish(state.scenarioFlags.tookKeysByForce ? 'r2' : 'r3')
    }
  },
  agendaReveal(state, agenda, api) {
    if (agenda.originalCode === '03160') {
      state.encounterDeck.push(...state.scenarioZones.lunatics.splice(0))
      api.shuffleDiscard()
      stashRandomMonster(state, api)
    } else if (agenda.originalCode === '03161') {
      const monsters = state.scenarioZones.monsters
      if (monsters.length) {
        state.encounterDeck.push(monsters.splice(randomIndex(monsters.length, api), 1)[0])
        api.shuffleEncounterDeck()
      }
      if (!(state.campaign.records.vipsSlain || []).includes('03065')) api.spawn('03065b', 'garden')
    } else if (agenda.originalCode === '03162') {
      for (const inv of active(state)) api.defeat(inv, null)
      api.finish(state.investigators.some(inv => inv.resigned)
        ? state.scenarioFlags.tookKeysByForce ? 'r2' : 'r3'
        : 'r1')
    }
  },
  checkObjectives(state, api) {
    if (original(state.acts[state.actIndex]) === '03166'
      && (state.scenarioFlags.remembered || []).filter(fact => rememberedFacts.includes(fact)).length >= 4) {
      api.advanceAct()
    }
  },
  canOpportunityAttack(_state, enemy) {
    return enemy.code !== '03183'
  },
  canFightEnemy(state, inv, enemy) {
    return !(inv.hiddenCards || []).includes('03186') || !isLunatic(enemy)
  },
  enemyMoved(state, enemy) {
    if (enemy.code === '03183' && state.phase === 'enemy') enemy.hunterMovedRound = state.round
  },
  enemyAttackModifier(state, enemy) {
    const base = enemy.code === '03183' && enemy.hunterMovedRound === state.round ? {
      damage: -enemy.damage, horror: -enemy.horror,
    } : {}
    if (enemy.location === 'westernHall169' && enemy.traits?.some(trait => String(trait).toLowerCase() === 'possessed')) {
      return { ...base, horror: (base.horror || 0) + 1 }
    }
    return base
  },
  enemyDefeated(state, enemy, api) {
    const shared = encounterRules.enemyDefeated?.(state, enemy, api) || false
    if (enemy.location === 'westernHall168'
      && enemy.traits?.some(trait => String(trait).toLowerCase() === 'possessed')
      && enemy.defeatedBy != null) {
      api.drawCards(enemy.defeatedBy, 1)
    }
    return shared
  },
  enemyDamaged(state, enemy, api) {
    if (enemy.code === '03184' && state.skillTest?.source?.enemyId === enemy.id && enemy.defeatedBy != null) {
      api.horror(enemy.defeatedBy, 1)
    }
  },
  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    const location = state.locations.find(candidate => candidate.id === inv.location)
    if (original(location) === '03171') {
      api.horror(inv.seat, 1)
      inv.resources += 2
    }
  },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    carcosaChaosAfterTest('theUnspeakableOath', state, inv, {
      ...result, drawn: result.drawn.filter(token => !symbolFamily.has(token) && token !== 'skull'),
    }, api)
    const tokens = result.drawn.filter(token => !result.cancelledTokens?.includes(token))
    if (!result.success) {
      if (tokens.includes('skull')) stashRandomMonster(state, api)
      if (hardSide(state) && tokens.includes('cultist')) api.horror(inv.seat, 1)
      if (hardSide(state) && tokens.includes('tablet')) api.horror(inv.seat, 1)
    }
    if (result.success && result.source?.label === '调查'
      && original(state.locations.find(location => location.id === inv.location)) === '03173'
      && inv.hand.length) {
      const choice = api.choose({
        kind: 'card', source: '03173', seat: inv.seat,
        prompt: '食堂：选择弃掉一张手牌。',
        options: inv.hand.map((code, index) => ({ id: String(index), label: ALL_CARDS[code]?.nameZh || code })),
      })
      inv.discard.push(inv.hand.splice(Number(choice), 1)[0])
    }
  },
  actions(state, inv) {
    const moves = []
    const location = state.locations.find(candidate => candidate.id === inv.location)
    const code = original(location)
    const noClues = (location?.clues || 0) === 0
    const facts = state.scenarioFlags.remembered || []
    if (code === '03172' && !facts.includes('setAFireInTheKitchen'))
      moves.push({ action: 'scenarioAction', rule: 'kitchenFire', label: '检定意志（2），在厨房放火',
        reason: noClues ? null : `需要先取走厨房的线索（还剩 ${location.clues || 0} 个）` })
    if (code === '03175' && !facts.includes('incitedAFightAmongstThePatients'))
      moves.push({ action: 'scenarioAction', rule: 'yardFight', label: '受到 1 点伤害，煽动病人互相攻击',
        reason: !noClues ? `需要先取走院子的线索（还剩 ${location.clues || 0} 个）`
          : inv.damage < inv.maxHealth ? null : '伤害已满，无法再承受 1 点伤害' })
    if (code === '03176' && !facts.includes('distractedTheGuards'))
      moves.push({ action: 'scenarioAction', rule: 'gardenGuards', label: '检定敏捷（2），分散守卫注意力',
        reason: noClues ? null : `需要先取走花园的线索（还剩 ${location.clues || 0} 个）` })
    if (code === '03179' && !facts.includes('releasedADangerousPatient'))
      moves.push({ action: 'scenarioAction', rule: 'occupiedCell', label: '检定战斗（2），释放危险病人' })
    if (code === '03180' && !facts.includes('knowTheGuardsPatrols'))
      moves.push({ action: 'scenarioAction', rule: 'drearyCell', label: '检定智识（2），获知守卫巡逻路线' })
    if (code === '03181' && !facts.includes('recalledTheWayOut'))
      moves.push({ action: 'scenarioAction', rule: 'familiarCell', label: '检定意志（等同恐惧），想起出去的路' })
    if (code === '03174') moves.push({ action: 'scenarioAction', rule: 'infirmary', label: '使用医务室' })
    if (code === '03170') for (const enemy of state.enemies.filter(candidate =>
      candidate.location === inv.location && isLunatic(candidate))) {
      moves.push({ action: 'scenarioAction', rule: 'eastHallEvade', enemyId: enemy.id, label: `承受 1 恐惧，自动躲避${enemy.name}` })
    }
    if (code === '03176' && original(state.acts[state.actIndex]) === '03167') {
      moves.push({ action: 'scenarioAction', rule: 'escapeGarden', label: '从花园撤退',
        reason: state.enemies.some(enemy => enemy.location === inv.location && !enemy.exhausted)
          ? '同地点还有未横置的敌人，需要先躲避或击败' : null })
    }
    if (inv.hiddenCards?.some(hidden => ['03186', '03187'].includes(hidden))) {
      for (const hidden of inv.hiddenCards.filter(card => ['03186', '03187'].includes(card))) {
        moves.push({ action: 'scenarioAction', rule: 'discardGift', hidden, label: '弃掉隐藏的疯狂馈赠' })
      }
    }
    for (const enemy of state.enemies.filter(candidate => candidate.code === '03182b'
      && candidate.location === inv.location)) {
      moves.push({ action: 'scenarioAction', actionKind: 'parley', rule: 'onyxParley',
        enemyId: enemy.id, label: '展示黑玛瑙扣环，与丹尼尔谈判',
        reason: inv.assets.some(asset => asset.code === '03142') ? null : '需要控制“黑玛瑙扣环”' })
    }
    const daniel = inv.assets.find(asset => asset.code === '03182a')
    if (daniel) {
      moves.push({ action: 'scenarioAction', rule: 'transferDaniel', actions: 0, label: '横置丹尼尔，将其交给同地点调查员',
        reason: daniel.exhausted ? '需要先重整“丹尼尔”先生'
          : active(state).some(other => other.seat !== inv.seat && other.location === inv.location) ? null
            : '需要同地点有另一名调查员' })
    }
    return moves.filter(move => !(inv.hiddenCards || []).includes('03187')
      || !['kitchenFire', 'yardFight', 'gardenGuards', 'occupiedCell', 'drearyCell', 'familiarCell', 'infirmary', 'eastHallEvade'].includes(move.rule))
  },
  performAction(state, inv, move, api) {
    const testFact = (skill, difficulty, fact) => api.test(inv.seat, skill, difficulty, result => {
      if (result.success) remember(state, fact)
    })
    if (move.rule === 'kitchenFire') testFact('willpower', 2, 'setAFireInTheKitchen')
    else if (move.rule === 'yardFight') {
      api.damage(inv.seat, 1)
      remember(state, 'incitedAFightAmongstThePatients')
    } else if (move.rule === 'gardenGuards') testFact('agility', 2, 'distractedTheGuards')
    else if (move.rule === 'occupiedCell') testFact('combat', 2, 'releasedADangerousPatient')
    else if (move.rule === 'drearyCell') testFact('intellect', 2, 'knowTheGuardsPatrols')
    else if (move.rule === 'familiarCell') testFact('willpower', inv.horror, 'recalledTheWayOut')
    else if (move.rule === 'infirmary') {
      const answer = api.choose({
        kind: 'location', source: '03174', seat: inv.seat, prompt: '选择医务室的治疗。',
        options: [{ id: 'damage', label: '治疗 1 伤害，受到 1 直接恐惧' }, { id: 'horror', label: '治疗 1 恐惧，受到 1 直接伤害' }],
      })
      if (answer === 'damage') {
        inv.damage = Math.max(0, inv.damage - 1)
        api.directHorror(inv.seat, 1)
      } else {
        inv.horror = Math.max(0, inv.horror - 1)
        api.directDamage(inv.seat, 1)
      }
    } else if (move.rule === 'eastHallEvade') {
      const enemy = state.enemies.find(candidate => candidate.id === move.enemyId && candidate.location === inv.location
        && isLunatic(candidate))
      if (!enemy) throw new Error('没有可由东区病房躲避的疯子敌人')
      api.horror(inv.seat, 1)
      api.evadeEnemy(enemy)
    } else if (move.rule === 'escapeGarden') api.resign(inv.seat)
    else if (move.rule === 'discardGift') {
      if (!(inv.hiddenCards || []).includes(move.hidden)) throw new Error('隐藏牌不在手中')
      stashRandomMonster(state, api)
      discardHidden(state, inv, move.hidden)
    } else if (move.rule === 'onyxParley') {
      const enemy = state.enemies.find(candidate => candidate.id === move.enemyId && candidate.code === '03182b'
        && candidate.location === inv.location)
      if (!enemy || !inv.assets.some(asset => asset.code === '03142')) throw new Error('无法与丹尼尔谈判')
      api.damageEnemy(enemy.id, 99, inv.seat, '03142')
    } else if (move.rule === 'transferDaniel') {
      const daniel = inv.assets.find(asset => asset.code === '03182a' && !asset.exhausted)
      const candidates = active(state).filter(other => other.seat !== inv.seat && other.location === inv.location)
      if (!daniel || !candidates.length) throw new Error('无法转交丹尼尔')
      const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
        kind: 'target', source: daniel.id, seat: inv.seat, prompt: '选择接管丹尼尔的调查员。',
        options: candidates.map(candidate => ({ id: String(candidate.seat), label: candidate.name })),
      }))
      inv.assets.splice(inv.assets.indexOf(daniel), 1)
      daniel.exhausted = true
      state.investigators[seat].assets.push(daniel)
    } else throw new Error(`未知邪秽誓约行动：${move.rule}`)
  },
  resolveEncounter(state, inv, card, api) {
    const code = original(card)
    if (code === '03185') {
      if (inv.threat.some(threat => threat.code === code)) return false
      for (const asset of [...inv.assets]) {
        const slots = ALL_CARDS[asset.code]?.slots || []
        if (!slots.some(slot => ['Body', 'Hand'].includes(slot))) continue
        api.removeAsset(inv.seat, asset.id)
        inv.hand.push(asset.code)
      }
      api.threat(inv.seat, code, {
        slots: ['Body', 'Hand x2'],
        cannotLeavePlay: true,
        threatEffect: {
          discardCost: { action: 2 },
          sameLocationAction: true,
        },
      })
      return true
    }
    if (code === '03186' || code === '03187') {
      inv.hand.push(code)
      inv.hiddenCards ||= []
      inv.hiddenCards.push(code)
      return true
    }
    if (code === '03188') {
      const location = state.locations.find(candidate => candidate.id === inv.location)
      api.test(inv.seat, 'willpower', location?.shroud || 0, result => {
        if (result.success) return
        const amount = Math.max(1, result.difficulty - result.value)
        const options = [{ id: 'horror', label: `受到 ${amount} 点恐惧` }]
        if (state.scenarioZones.monsters.length) options.push({ id: 'monster', label: '将随机怪物放到场景牌库底下' })
        const answer = api.choose({ kind: 'encounter', source: code, seat: inv.seat, prompt: '墙壁逼近', options })
        if (answer === 'monster') stashRandomMonster(state, api)
        else api.horror(inv.seat, amount)
      })
      return false
    }
    return encounterRules.resolveEncounter.call(this, state, inv, card, api)
  },
  allResigned(state, api) {
    api.advanceAct()
  },
  resolution(state, key, events, api) {
    if (!['noResolution', 'r1', 'r2', 'r3'].includes(key)) throw new Error('未知邪秽誓约结局')
    const addTrauma = (seat, kind, amount) => {
      if (!(amount > 0)) return
      if (api.addTrauma) api.addTrauma(state, seat, kind, amount, events)
      else if (api.trauma) api.trauma(seat, kind, amount)
      else state.campaign.trauma[seat][kind] += amount
    }
    if (state.victoryDisplay.some(card => original(card) === '03065b')) addVipSlain(state, '03065')
    const records = state.campaign.records
    const danielAllyEscaped = state.investigators.some(inv =>
      inv.resigned && inv.assets.some(asset => asset.code === '03182a'))
    const danielWasPossessed = state.enemies.some(enemy => enemy.code === '03182b')
      || state.victoryDisplay.some(card => original(card) === '03182b')
    records.danielStatus = danielAllyEscaped ? 'survived'
      : danielWasPossessed ? 'possessed' : 'didNotSurvive'
    for (const inv of state.investigators.filter(candidate => candidate.defeated)) {
      const trauma = state.campaign.trauma[inv.seat]
      const amount = Math.max(0, (inv.maxSanity || inv.sanity || 0) - trauma.mental)
      addTrauma(inv.seat, 'mental', amount)
    }
    if (key === 'r1' || key === 'noResolution') {
      records.theKingClaimedItsVictims = true
      const owner = Object.values(state.campaign.investigators).find(record => record.deck.includes('03142'))
      const candidates = Object.values(state.campaign.investigators)
        .filter(record => record.status === 'active' && record.seat !== owner?.seat)
      if (owner && owner.status !== 'active' && candidates.length) {
        const request = {
          kind: 'storyCard', source: '03142', seat: state.campaign.leadSeat,
          prompt: '选择一位新的调查员持有黑玛瑙扣环。',
          options: candidates.map(record => ({ id: String(record.seat), label: record.name })),
        }
        const answer = candidates.length === 1 ? String(candidates[0].seat)
          : api.choose ? api.choose(request) : requestChoice(state, request)
        campaignCardChange(state.campaign, owner.seat, '03142', 'remove', 'theUnspeakableOath')
        campaignCardChange(state.campaign, Number(answer), '03142', 'add', 'theUnspeakableOath')
      }
      replaceSymbols(state, 'cultist')
    } else if (key === 'r2') {
      records.theInvestigatorsWereAttackedAsTheyEscapedTheAsylum = true
      for (const inv of state.investigators) addTrauma(inv.seat, 'physical', 1)
      replaceSymbols(state, 'tablet')
    } else {
      records.theInvestigatorsEscapedTheAsylum = true
      replaceSymbols(state, 'elderthing')
    }
    return { bonus: 0, award: true }
  },
}
