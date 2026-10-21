import { changeChaosBag } from '../../../../../src/engine/chaos-bag.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules } from '../../encounter-rules.js'
import { carcosaChaosToken, carcosaChaosAfterTest } from '../../carcosa-chaos.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => state.campaign.records ||= {}
const count = (state, key) => Number(recordsFor(state)[key] || 0)
const interviewed = (state, code) => (recordsFor(state).vipsInterviewed || []).includes(code)
const slain = (state, code) => (recordsFor(state).vipsSlain || []).includes(code)

function original(card) {
  return card?.originalCode || card?.code
}

function shuffleDeck(deck, api) {
  for (let index = deck.length - 1; index > 0; index--) {
    const other = Math.floor(api.random() * (index + 1))
    ;[deck[index], deck[other]] = [deck[other], deck[index]]
  }
}

function chooseVariant(state, id, helper) {
  const variants = state.scenario.locationVariants[id]
  const value = helper?.randomValue ? helper.randomValue(state) : 0
  const selected = variants[Math.floor(value * variants.length) % variants.length]
  state.locationVariants[id] = structuredClone(selected)
  return selected.originalCode
}

function distance(state, from, targets) {
  const queue = [[from, 0]], seen = new Set([from])
  for (const [id, steps] of queue) {
    if (targets.includes(id)) return steps
    const location = state.locations.find(candidate => candidate.id === id)
    for (const next of location?.connections || []) if (!seen.has(next)) {
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return -1
}

function moveOrganistAway(state, api) {
  const organist = state.enemies.find(enemy => ['03221', '03221b'].includes(enemy.code))
  if (!organist) return
  organist.engagedSeat = null
  const investigators = active(state).map(inv => inv.location)
  const here = state.locations.find(location => location.id === organist.location)
  const candidates = (here?.connections || []).filter(id => state.locations.some(location => location.id === id))
  if (!candidates.length) return
  const scored = candidates.map(id => ({ id, score: distance(state, id, investigators) }))
  const best = Math.max(...scored.map(item => item.score))
  const choices = scored.filter(item => item.score === best)
  const destination = choices.length === 1 ? choices[0].id : api.choose({
    kind: 'location',
    source: organist.id,
    seat: state.campaign.leadSeat,
    prompt: '选择风琴手远离最近调查员的移动地点。',
    options: choices.map(item => ({
      id: item.id,
      label: state.locations.find(location => location.id === item.id)?.name || item.id,
    })),
  })
  api.moveEnemy(organist, destination)
}

function replaceSymbols(state, token) {
  state.campaign.chaosBag ||= [...state.chaosBag]
  for (const face of ['cultist', 'tablet', 'elderthing']) {
    const amount = state.chaosBag.filter(value => value === face).length
    if (amount) changeChaosBag(state, face, -amount, { permanent: true })
  }
  changeChaosBag(state, token, 2, { permanent: true })
}

export function setupPlan(state) {
  const convictionRoute = count(state, 'conviction') > count(state, 'doubt')
  return {
    route: convictionRoute ? 'conviction' : 'doubt',
    actCodes: convictionRoute ? ['03205', '03207'] : ['03204', '03206'],
    organistCode: convictionRoute ? '03221' : '03221b',
    startLocation: interviewed(state, '03077') ? 'montparnasse' : 'gareDOrsay',
    removedEncounterCodes: convictionRoute ? ['03090', '01136'] : ['03223', '01135'],
  }
}

export const behavior = {
  ...encounterRules,
  id: 'aPhantomOfTruth',
  setupPlan,
  startLocation(state) {
    return setupPlan(state).startLocation
  },
  preScenarioSetup(state, events = [], api = {}) {
    state.scenarioFlags ||= {}
    if (state.scenarioFlags.preScenarioComplete) return state.scenarioFlags.dreamLog
    const records = recordsFor(state)
    const dreamLog = ['dream1']
    if (!state.standalone) {
      for (const inv of state.investigators) {
        const campaignInvestigator = state.campaign.investigators?.[inv.seat]
        if (campaignInvestigator && !campaignInvestigator.deck.includes('03227')) campaignInvestigator.deck.push('03227')
        if (Array.isArray(inv.deck) && !inv.deck.includes('03227')) inv.deck.push('03227')
      }
    }
    if (!records.theKingClaimedItsVictims) {
      if (records.youIntrudedOnASecretMeeting) dreamLog.push('dream3')
      else if (records.youSlayedTheMonstersAtTheDinnerParty) {
        dreamLog.push('dream4')
        for (const inv of state.investigators) api.trauma?.(inv.seat, 'mental', 1)
      }
      dreamLog.push('dream6')
      if (records.thePoliceAreSuspiciousOfYou) {
        dreamLog.push('dream7')
        const options = state.investigators.map(inv => ({ id: String(inv.seat), label: inv.name }))
        const seat = options.length === 1 ? options[0].id : api.choose({
          kind: 'investigator',
          source: 'aPhantomOfTruthDream7',
          seat: state.campaign.leadSeat,
          prompt: '选择获得妄想症弱点的调查员。',
          options,
        })
        const target = state.investigators.find(inv => String(inv.seat) === String(seat))
        const campaignInvestigator = state.campaign.investigators?.[target?.seat]
        if (campaignInvestigator && !campaignInvestigator.deck.includes('01097')) campaignInvestigator.deck.push('01097')
        if (target?.deck && !target.deck.includes('01097')) target.deck.push('01097')
      }
    }
    dreamLog.push('dream8')
    if (count(state, 'chasingTheStranger') <= 3) dreamLog.push('dream9', 'dream13')
    else {
      dreamLog.push('dream10')
      const answer = api.choose({
        kind: 'story',
        source: 'aPhantomOfTruthDream10',
        seat: state.campaign.leadSeat,
        prompt: '彩绘玻璃很漂亮，不是吗？',
        options: [
          { id: 'conviction', label: '这“一切”怎么会是漂亮的？' },
          { id: 'doubt', label: '我看见的到底是什么？' },
        ],
      })
      records[answer] = count(state, answer) + 1
      dreamLog.push(answer === 'conviction' ? 'dream11' : 'dream12', 'dream13')
    }
    if (interviewed(state, '03077')) {
      dreamLog.push('jordansInformation')
      for (const inv of state.investigators) inv.resources = (inv.resources || 0) + 3
    }
    state.scenarioFlags.preScenarioComplete = true
    state.scenarioFlags.dreamLog = dreamLog
    return dreamLog
  },
  setupLocations(state, events, helper) {
    const plan = setupPlan(state)
    state.scenarioFlags ||= {}
    state.scenarioFlags.route = plan.route
    state.scenarioFlags.organistCode = plan.organistCode
    state.scenarioFlags.actOneAdvancedWith = null
    state.scenarioZones = {
      setAside: [plan.organistCode],
      removed: [plan.organistCode === '03221' ? '03221b' : '03221'],
    }
    const selected = [
      chooseVariant(state, 'montmartre', helper),
      chooseVariant(state, 'operaGarnier', helper),
      chooseVariant(state, 'leMarais', helper),
    ]
    state.scenarioZones.removed.push(
      ...['03209', '03210', '03212', '03213', '03217', '03218'].filter(code => !selected.includes(code)),
    )
    state.acts = plan.actCodes.map(code =>
      structuredClone(state.scenario.acts.find(act => act.originalCode === code)))
    return Object.keys(state.scenario.locations)
  },
  modifyDeck(state, deck) {
    const removed = new Set(setupPlan(state).removedEncounterCodes)
    return deck.filter(code => !removed.has(code))
  },
  resolveChaosToken(state, inv, token, api) {
    return carcosaChaosToken('aPhantomOfTruth', state, inv, token, api)
  },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    carcosaChaosAfterTest('aPhantomOfTruth', state, inv, result, api)
    if (result.success && result.source?.label === '调查'
      && state.locations.find(location => location.id === inv.location)?.originalCode === '03215') {
      state.scenarioFlags.pereLachaiseLock = { seat: inv.seat, round: state.round }
    }
  },
  movementError(state, inv) {
    const lock = state.scenarioFlags?.pereLachaiseLock
    if (lock && lock.seat === inv.seat && lock.round === state.round
      && state.locations.find(location => location.id === inv.location)?.originalCode === '03215') {
      return '拉雪兹神父公墓：本回合不能离开'
    }
    const marais = state.scenarioFlags?.leMaraisLock
    if (marais && marais.seat === inv.seat && marais.round === state.round
      && state.locations.find(location => location.id === inv.location)?.originalCode === '03218') {
      return '玛黑区：本回合不能离开'
    }
    return null
  },
  locationEntered(state, inv, location, api) {
    encounterRules.locationEntered?.(state, inv, location, api)
    if (original(location) === '03218') state.scenarioFlags.leMaraisLock = { seat: inv.seat, round: state.round }
  },
  afterEvade(state, inv, enemy, result, api) {
    encounterRules.afterEvade?.(state, inv, enemy, result, api)
    if (!result?.success || original(state.locations.find(location => location.id === inv.location)) !== '03216') return
    if (state.scenarioFlags.canalMoveRound === state.round) return
    state.scenarioFlags.canalMoveRound = state.round
    const here = state.locations.find(location => location.id === inv.location)
    const destinations = (here?.connections || []).filter(id => state.locations.some(location => location.id === id))
    if (!destinations.length) return
    const destination = destinations.length === 1 ? destinations[0] : api.choose({
      kind: 'location', source: '03216', seat: inv.seat, prompt: '选择把敌人移动到的连接地点。',
      options: destinations.map(id => ({ id, label: state.locations.find(location => location.id === id)?.name || id })),
    })
    api.moveEnemy(enemy, destination)
  },
  turnBegins(state, inv, api) {
    if (original(state.locations.find(location => location.id === inv.location)) !== '03217') return
    if (state.scenarioFlags.leMaraisDrawRound === state.round) return
    state.scenarioFlags.leMaraisDrawRound = state.round
    api.drawCards(inv.seat, 1)
  },
  enemyConnections(state, enemy, location) {
    if (!enemy.traits?.some(trait => String(trait).toLowerCase() === 'byakhee')) return []
    if (location?.id === 'gardensOfLuxembourg') return []
    if (!state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === 'gardensOfLuxembourg')) return []
    return ['gardensOfLuxembourg']
  },
  resolveEncounter(state, inv, card, api) {
    const code = original(card)
    if (code === '03223') {
      api.test(inv.seat, 'intellect', 4, result => {
        if (result.success) return
        const failedBy = Math.max(1, result.difficulty - result.value)
        const options = state.doom > 0
          ? [{ id: 'doom', label: '从当前密谋移除 1 个毁灭' }, { id: 'horror', label: `承受 ${failedBy} 点恐惧` }]
          : [{ id: 'horror', label: `承受 ${failedBy} 点恐惧` }]
        const choice = options.length === 1 ? 'horror' : api.choose({
          kind: 'encounter', source: code, seat: inv.seat, prompt: '双生太阳：移除毁灭或承受恐惧。', options,
        })
        if (choice === 'doom') state.doom = Math.max(0, state.doom - 1)
        else api.horror(inv.seat, failedBy)
      })
      return false
    }
    if (code === '03227') {
      const doubt = count(state, 'doubt')
      const conviction = count(state, 'conviction')
      const doubtRoute = doubt >= conviction
      const skill = doubtRoute ? 'intellect' : 'willpower'
      const difficulty = doubtRoute ? (inv.willpower || 0) : (inv.intellect || 0)
      api.test(inv.seat, skill, difficulty, result => {
        if (!result.success) api.damage(inv.seat, 2)
      })
      return false
    }
    return encounterRules.resolveEncounter(state, inv, card, api)
  },
  locationRevealed(state, location, api) {
    if (location.originalCode !== '03211') return
    const answer = api.choose({
      kind: 'location',
      source: '03211',
      seat: state.currentSeat,
      prompt: '揭示大木偶剧场：选择受到2点恐惧，或洗回全部非弱点手牌并重抽。',
      options: [{ id: 'horror', label: '受到2点恐惧' }, { id: 'shuffle', label: '洗回并重抽手牌' }],
    })
    const inv = state.investigators[state.currentSeat]
    if (answer === 'horror') api.horror(inv.seat, 2)
    else {
      const cards = inv.hand.splice(0)
      inv.deck.push(...cards)
      api.drawCards(inv.seat, cards.length)
    }
  },
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    delete state.scenarioFlags?.pereLachaiseLock
    delete state.scenarioFlags?.leMaraisLock
    delete state.scenarioFlags?.canalMoveRound
    delete state.scenarioFlags?.leMaraisDrawRound
    if (state.actIndex === 0) {
      const doom = state.doom + state.locations.reduce((sum, location) => sum + (location.doom || 0), 0)
        + state.enemies.reduce((sum, enemy) => sum + (enemy.doom || 0), 0)
      if (doom >= 3) {
        state.scenarioFlags.actOneAdvancedWith = 'doom'
        api.advanceAct()
      }
    }
  },
  actReveal(state, act, api) {
    registeredEntry(act.originalCode)?.actRule?.onReveal?.(state, act, api)
  },
  agendaReveal(state, agenda, api) {
    registeredEntry(agenda.originalCode)?.agendaRule?.onReveal?.(state, agenda, api)
  },
  agendaWouldAdvance(state) {
    if (count(state, 'conviction') <= count(state, 'doubt')) return false
    const agenda = state.agendas[state.agendaIndex]
    const otherDoom = state.locations.reduce((sum, location) => sum + (location.doom || 0), 0)
      + state.enemies.reduce((sum, enemy) => sum + (enemy.doom || 0), 0)
      + state.investigators.flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])])
        .reduce((sum, card) => sum + (card.doom || 0), 0)
    return state.doom - otherDoom < agenda.doomThreshold
  },
  enemyAttackedSuccessfully(state, inv, enemy, api) {
    if (state.acts[state.actIndex]?.originalCode !== '03206' || !['03221', '03221b'].includes(enemy.code)
      || inv.clues < 1) return
    state.scenarioFlags.organistClueRound ||= {}
    const used = state.scenarioFlags.organistClueRound[state.round] || 0
    if (used >= state.numInvestigators) return
    if (api.choose({
      kind: 'reaction',
      source: '03206',
      seat: inv.seat,
      canSkip: true,
      prompt: '是否花费1个线索并放到风琴手上？',
      options: [{ id: 'skip', label: '不放置' }, { id: 'place', label: '放置1个线索' }],
    }) === 'place') {
      inv.clues--
      enemy.clues = (enemy.clues || 0) + 1
      state.scenarioFlags.organistClueRound[state.round] = used + 1
      if (enemy.clues >= 3 * state.numInvestigators) api.advanceAct()
    }
  },
  actions(state, inv) {
    const moves = []
    const location = state.locations.find(candidate => candidate.id === inv.location)
    const code = original(location)
    const perRoundKey = `${code}:${inv.seat}`
    if (code === '03208' && state.scenarioFlags[perRoundKey] !== state.round) {
      const discardable = inv.hand.some(card => !inv.hiddenCards?.includes(card))
      moves.push({ action: 'scenarioAction', rule: 'montparnasseDiscard', actions: 0,
        label: '弃掉1张手牌，获得等同其意志图标数量的资源',
        reason: discardable ? null : '需要 1 张可弃的手牌（隐藏的疯狂牌不能弃）' })
    }
    if (code === '03209' && state.scenarioFlags.montmartrePlayRound !== state.round) {
      moves.push({ action: 'scenarioAction', rule: 'montmartrePlay',
        label: '揭示每位调查员牌库顶牌并可打出一张支援' })
    }
    if (code === '03210' && state.scenarioFlags[perRoundKey] !== state.round) {
      const reloadable = inv.assets.some(asset =>
        ['ammo', 'supply', 'supplies'].includes(String(asset.usesType || '').toLowerCase()))
      moves.push({ action: 'scenarioAction', rule: 'montmartreReload',
        label: '花费1资源，为一张卡牌补充1补给或子弹',
        reason: inv.resources < 1 ? `需要 1 个资源（当前 ${inv.resources}）`
          : reloadable ? null : '需要一张带弹药或补给的支援' })
    }
    if (code === '03214' && state.locations.some(candidate =>
      candidate.id !== inv.location && ALL_CARDS[original(candidate)]?.traits?.includes('Rail'))) {
      moves.push({ action: 'scenarioAction', rule: 'gareRailMove',
        actionKind: 'move', label: '花费1资源，移动到任意轨道沿线地点',
        reason: inv.resources < 1 ? `需要 1 个资源（当前 ${inv.resources}）` : null })
    }
    if (code === '03219' && !state.scenarioFlags.notreDameUsed) {
      moves.push({ action: 'scenarioAction', rule: 'notreDameDoom',
        label: '检定意志（6），放置或移除1个毁灭' })
    }
    if (state.acts[state.actIndex]?.originalCode === '03207'
      && state.scenarioFlags.shadowActionRound !== state.round) {
      const teamClues = active(state).reduce((sum, candidate) => sum + candidate.clues, 0)
      moves.push({
        action: 'scenarioAction',
        rule: 'stalkedByShadows',
        actions: 0,
        scriptCard: 'act',
        label: `共同花费${state.numInvestigators}个线索，放置毁灭或自动躲避风琴手`,
        reason: teamClues >= state.numInvestigators ? null
          : `需要调查员共同花费 ${state.numInvestigators} 个线索（当前 ${teamClues}）`,
      })
    }
    return moves
  },
  performAction(state, inv, move, api) {
    const location = state.locations.find(candidate => candidate.id === inv.location)
    const code = original(location)
    const perRoundKey = `${code}:${inv.seat}`
    if (move.rule === 'montparnasseDiscard') {
      const options = inv.hand.flatMap((card, index) => inv.hiddenCards?.includes(card) ? [] : [{
        id: String(index), label: ALL_CARDS[card]?.nameZh || ALL_CARDS[card]?.name || card,
      }])
      if (code !== '03208' || state.scenarioFlags[perRoundKey] === state.round || !options.length) {
        throw new Error('蒙巴纳斯能力当前不可用')
      }
      const index = Number(api.choose({
        kind: 'discard', source: code, seat: inv.seat, prompt: '选择弃掉一张手牌。', options,
      }))
      const discarded = inv.hand.splice(index, 1)[0]
      inv.discard.push(discarded)
      inv.resources += ALL_CARDS[discarded]?.icons?.willpower || 0
      state.scenarioFlags[perRoundKey] = state.round
    } else if (move.rule === 'montmartrePlay') {
      if (code !== '03209' || state.scenarioFlags.montmartrePlayRound === state.round) {
        throw new Error('蒙马特尔能力当前不可用')
      }
      state.scenarioFlags.montmartrePlayRound = state.round
      const revealed = active(state).flatMap(owner => owner.deck.length
        ? [{ owner, code: owner.deck.at(-1) }] : [])
      api.info(`蒙马特尔揭示：${revealed.map(item =>
        `${item.owner.name}—${ALL_CARDS[item.code]?.nameZh || ALL_CARDS[item.code]?.name || item.code}`).join('；') || '没有可揭示的卡牌'}`)
      const playable = revealed.filter(item => api.canPlayAsset(inv.seat, item.code))
      const selected = playable.length ? api.choose({
        kind: 'search', source: code, seat: inv.seat, canSkip: true,
        prompt: '你可以支付费用，将其中一张支援放到你的控制之下。',
        options: [{ id: 'skip', label: '不打出' }, ...playable.map(item => ({
          id: `seat:${item.owner.seat}`, cardCode: item.code,
          label: `${ALL_CARDS[item.code]?.nameZh || item.code}（${ALL_CARDS[item.code]?.cost || 0}资源）`,
        }))],
      }) : 'skip'
      if (selected !== 'skip') {
        const item = playable.find(candidate => `seat:${candidate.owner.seat}` === selected)
        if (item && item.owner.deck.at(-1) === item.code) {
          item.owner.deck.pop()
          api.playAsset(inv.seat, item.code)
        }
      }
      for (const owner of active(state)) shuffleDeck(owner.deck, api)
    } else if (move.rule === 'montmartreReload') {
      const assets = inv.assets.filter(asset =>
        ['ammo', 'supply', 'supplies'].includes(String(asset.usesType || '').toLowerCase()))
      if (code !== '03210' || state.scenarioFlags[perRoundKey] === state.round
        || inv.resources < 1 || !assets.length) throw new Error('蒙马特尔补给能力当前不可用')
      const id = assets.length === 1 ? assets[0].id : api.choose({
        kind: 'target', source: code, seat: inv.seat, prompt: '选择补充1补给或子弹的卡牌。',
        options: assets.map(asset => ({
          id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || ALL_CARDS[asset.code]?.name || asset.code,
        })),
      })
      const asset = assets.find(candidate => candidate.id === id)
      if (!asset) throw new Error('必须选择一张使用补给或子弹的卡牌')
      inv.resources--
      asset.uses = (asset.uses || 0) + 1
      state.scenarioFlags[perRoundKey] = state.round
    } else if (move.rule === 'gareRailMove') {
      const destinations = state.locations.filter(candidate => candidate.id !== inv.location
        && ALL_CARDS[original(candidate)]?.traits?.includes('Rail'))
      if (code !== '03214' || inv.resources < 1 || !destinations.length) throw new Error('奥赛火车站能力当前不可用')
      const destination = destinations.length === 1 ? destinations[0].id : api.choose({
        kind: 'location', source: code, seat: inv.seat, prompt: '选择一个轨道沿线地点。',
        options: destinations.map(candidate => ({ id: candidate.id, label: candidate.name })),
      })
      inv.resources--
      api.moveInvestigator(inv.seat, destination)
    } else if (move.rule === 'notreDameDoom') {
      if (code !== '03219' || state.scenarioFlags.notreDameUsed) throw new Error('巴黎圣母院能力当前不可用')
      state.scenarioFlags.notreDameUsed = true
      api.test(inv.seat, 'willpower', 6, result => {
        if (!result.success) return
        const options = [{ id: 'place', label: '在当前密谋放置1个毁灭' }]
        if (state.doom > 0) options.push({ id: 'remove', label: '从当前密谋移除1个毁灭' })
        const answer = api.choose({
          kind: 'story', source: code, seat: inv.seat, prompt: '选择调整当前密谋的毁灭。', options,
        })
        if (answer === 'place') api.addDoom(1)
        else state.doom = Math.max(0, state.doom - 1)
      })
    } else if (move.rule === 'stalkedByShadows') {
      api.payClues(state.numInvestigators)
      state.scenarioFlags.shadowActionRound = state.round
      const organist = state.enemies.find(enemy => ['03221', '03221b'].includes(enemy.code))
      const options = [{ id: 'doom', label: '在当前密谋放置1个毁灭' }]
      if (organist) options.push({ id: 'evade', label: '自动躲避风琴手' })
      const answer = api.choose({
        kind: 'story',
        source: '03207',
        seat: inv.seat,
        prompt: '选择暗影缠身的效果。',
        options,
      })
      if (answer === 'doom') state.doom++
      else api.evadeEnemy(organist)
    } else throw new Error(`未知真相幻影行动：${move.rule}`)
  },
  resolution(state, key, events, api) {
    if (!['noResolution', 'r1', 'r2', 'r3'].includes(key)) throw new Error('未知真相幻影结局')
    const records = recordsFor(state)
    if (key === 'noResolution') records.youDidNotEscapeTheGazeOfThePhantom = true
    if (key === 'r1') records.youFoundNigelsHome = true
    if (key === 'r2') {
      records.youFoundNigelEngram = true
      for (const inv of state.investigators) api.trauma?.(inv.seat, 'mental', 1)
    }
    if (key === 'r3') records.youWereUnableToFindNigel = true
    replaceSymbols(state, key === 'r1' ? 'cultist' : key === 'r2' ? 'tablet' : 'elderthing')
    if (state.victoryDisplay.some(card => (card.originalCode || card.code) === '03066b')) {
      records.vipsSlain ||= []
      if (!records.vipsSlain.includes('03066')) records.vipsSlain.push('03066')
    }
    return { award: true, bonus: key === 'r2' ? 2 : 0 }
  },
}
