import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules } from '../../encounter-rules.js'
import { locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { carcosaChaosToken } from '../../carcosa-chaos.js'
import { agendaVariants } from './definition.js'

const clone = value => structuredClone(value)
const MONSTER_BONUS_AGENDAS = ['03279a', '03279b', '03280']
// 印着「[fast] 团队花费线索放 1 毁灭」的两条密谋牌堆的 1a/2a(2c) 卡。
const HASTEN_AGENDA_CODES = new Set(['03275', '03276a', '03276b', '03278', '03279a', '03279b'])
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const codeOf = card => card?.originalCode || card?.code
const interviewedAshleigh = state =>
  (state.campaign.records.vipsInterviewed || []).some(value =>
    value === '03080')
const ashleighSlain = state =>
  (state.campaign.records.vipsSlain || []).some(value =>
    value === '03069')

function random(api, state) {
  if (api?.random) return api.random()
  if (api?.randomValue) return api.randomValue(state)
  throw new Error('黑星升起的随机布置必须在规则事务中执行')
}

function pick(api, state, values) {
  return values[Math.min(values.length - 1, Math.floor(random(api, state) * values.length))]
}

const stageCards = {
  below: {
    a: ['03275', '03276b', '03277'],
    c: ['03278', '03279a', '03280'],
    pathLocation: 'chapelOfStAubert',
    act: '03281',
    resolution: 'r1',
  },
  above: {
    a: ['03275', '03276a', '03277'],
    c: ['03278', '03279b', '03280'],
    pathLocation: 'abbeyTower',
    act: '03282',
    resolution: 'r2',
  },
}

function definitionsFor(route, deck) {
  const source = deck === 'a' ? agendaVariants.tide : agendaVariants.ritual
  return stageCards[route][deck].map(code => clone(source.find(card => card.originalCode === code)))
    .map(card => ({ ...card, reveal: { type: 'campaignRule' } }))
}

export function setupPlan(state, api) {
  state.scenarioFlags ||= {}
  if (state.scenarioFlags.blackStarsPlan) return state.scenarioFlags.blackStarsPlan
  const route = pick(api, state, ['below', 'above'])
  const variants = {
    outerWall: pick(api, state, ['03285', '03286']),
    northTower: pick(api, state, ['03287', '03288']),
    brokenSteps: pick(api, state, ['03289', '03290']),
    choeurGothique: pick(api, state, ['03292', '03293']),
    chapelOfStAubert: route === 'below' ? '03296' : '03297',
    abbeyTower: route === 'above' ? '03298' : '03299',
  }
  const plan = {
    route,
    variants,
    locations: ['porteDeLAvancee', 'grandRue', 'outerWall', 'northTower', 'brokenSteps', 'abbeyChurch'],
    agendaDecks: {
      a: { id: 'a', index: 0, doom: 0, cards: [...stageCards[route].a] },
      c: { id: 'c', index: 0, doom: 0, cards: [...stageCards[route].c] },
    },
    setAside: ['03088', '03300', '03300', '03301', '03301', '03069b', '03281', '03282',
      variants.choeurGothique, variants.chapelOfStAubert, variants.abbeyTower],
    removed: [
      route === 'below' ? '03276a' : '03276b',
      route === 'below' ? '03279b' : '03279a',
      route === 'below' ? '03297' : '03296',
      route === 'below' ? '03298' : '03299',
    ],
  }
  state.scenarioFlags.blackStarsPlan = plan
  return plan
}

function addCampaignMark(state, key) {
  state.campaign.records[key] = Number(state.campaign.records[key] || 0) + 1
}

function syncMainAgenda(state) {
  const deck = state.scenarioFlags.agendaDecks?.a
  if (deck) deck.doom = Number(state.doom || 0)
}

const cardDoom = card => (card && typeof card === 'object' ? Number(card.doom) || 0 : 0)

// 密谋以外、仍在场上的毁灭：敌人、地点、地点附属、支援、威胁区、剧情支援。
// 规则：这些毁灭同时计入两套密谋的阈值；放在某一套密谋上的毁灭只计入那一套。
export function fieldDoom(state) {
  let sum = 0
  for (const enemy of state?.enemies || []) sum += cardDoom(enemy)
  for (const location of state?.locations || []) {
    sum += cardDoom(location)
    for (const attachment of location.attachments || []) sum += cardDoom(attachment)
  }
  for (const inv of state?.investigators || []) {
    for (const card of inv.assets || []) sum += cardDoom(card)
    for (const card of inv.threat || []) sum += cardDoom(card)
  }
  for (const asset of state?.storyAssets || []) sum += cardDoom(asset)
  for (const attachment of state?.playerLocationAttachments || []) sum += cardDoom(attachment)
  return sum
}

export function countedAgendaDoom(state, deck) {
  const onAgenda = Number(deck?.doom) || 0
  if (!deck || deck.removed || state?.scenarioFlags?.openPath) return onAgenda
  return onAgenda + fieldDoom(state)
}

function keepsOwnDoom(card) {
  return registeredEntry(codeOf(card))?.doomKeptOnAgendaAdvance === 'self'
}

function clearFieldDoom(state) {
  const wipe = card => {
    if (!card || typeof card !== 'object' || keepsOwnDoom(card)) return
    card.doom = 0
  }
  for (const enemy of state.enemies || []) wipe(enemy)
  for (const location of state.locations || []) {
    wipe(location)
    for (const attachment of location.attachments || []) wipe(attachment)
  }
  for (const inv of state.investigators || []) {
    for (const card of inv.assets || []) wipe(card)
    for (const card of inv.threat || []) wipe(card)
  }
  for (const asset of state.storyAssets || []) wipe(asset)
  for (const attachment of state.playerLocationAttachments || []) wipe(attachment)
}

function agendaIsReady(state, deck, deckId) {
  if (!deck || deck.removed || state.scenarioFlags?.openPath) return false
  const definition = definitionsFor(state.scenarioFlags.route, deckId)[deck.index]
  const threshold = definition?.doomThreshold
  return Number.isFinite(threshold) && countedAgendaDoom(state, deck) >= threshold
}

// 推进会改场上毁灭，放置毁灭的钩子可能再进来。用调用深度挡住重入。
let agendaCheckDepth = 0

function resolveReadyAgendas(state, api, preferId = null) {
  if (agendaCheckDepth > 0) return
  if (state.scenarioFlags?.openPath) return
  const decks = state.scenarioFlags?.agendaDecks
  if (!decks || !state.scenarioFlags?.route) return
  agendaCheckDepth += 1
  try {
    let guard = 0
    while (guard++ < 4) {
      const ready = ['a', 'c'].filter(id => agendaIsReady(state, decks[id], id))
      if (!ready.length) return
      const ordered = preferId && ready.includes(preferId)
        ? [preferId, ...ready.filter(id => id !== preferId)]
        : ready
      let deckId = ordered.length === 1 ? ordered[0] : null
      if (!deckId) {
        const answer = typeof api?.choose === 'function' ? api.choose({
          kind: 'agenda',
          source: 'blackStarsRise-threshold',
          seat: state.currentSeat ?? state.campaign?.leadSeat ?? 0,
          prompt: '两套密谋都达到了毁灭阈值。场上其他卡牌的毁灭同时计入两套。选择先推进哪一套。推进后那些卡牌上的毁灭会移除，另一套密谋上的毁灭保留。',
          options: ordered.map(id => ({ id, label: `“${id}”密谋（${countedAgendaDoom(state, decks[id])}）` })),
        }) : ordered[0]
        deckId = ready.includes(answer) ? answer : ordered[0]
      }
      preferId = null
      advanceAgendaDeck(state, deckId, api)
      if (state.scenarioFlags?.openPath) return
      if (state.status && state.status !== 'playing') return
    }
  } finally {
    agendaCheckDepth -= 1
  }
}

// 正确路线的场景牌开局只放在一边。道路开启时才把它放进当前幕，避免剧本书提前亮出通路。
function installPendingAct(state, routeAct) {
  const pending = state.scenarioFlags?.pendingAct
  if (pending && codeOf(pending) === routeAct) {
    state.acts = [clone(pending)]
    if (state.scenario) state.scenario.acts = clone(state.acts)
    state.actIndex = 0
    delete state.scenarioFlags.pendingAct
    return
  }
  const actIndex = (state.acts || []).findIndex(act => codeOf(act) === routeAct)
  if (actIndex >= 0) state.actIndex = actIndex
}

function presentStory(api, text, cue) {
  if (typeof api?.present === 'function') api.present(text, cue)
}

function printedAgenda(code) {
  const card = ALL_CARDS[code] || {}
  return {
    code,
    name: card.nameZh || card.name || code,
    text: card.textZh || card.text || '',
    backName: card.backNameZh || card.backName || card.nameZh || card.name || code,
    backText: card.backTextZh || card.backText || '翻开密谋，结算背面的剧情与效果。',
  }
}

function presentAgendaFlip(api, code) {
  const card = printedAgenda(code)
  presentStory(api, `翻开密谋「${card.name}」的背面。`, {
    kind: 'story', title: '密谋推进',
    code: card.code, face: 'back', name: card.backName, text: card.backText, flip: true,
  })
}

function presentRevealedCard(api, code, title) {
  const card = printedAgenda(code)
  presentStory(api, `${title}：「${card.name}」。`, {
    kind: 'story', title, code: card.code, name: card.name, text: card.text,
  })
}

function spawnAshleighAndBeast(state, deckId, api) {
  const location = deckId === 'a' ? 'abbeyTower' : 'chapelOfStAubert'
  if (!state.enemies.some(enemy => registeredEntry(codeOf(enemy))?.flags?.spawnGuard)) api.spawn('03088', location)
  if (!ashleighSlain(state) && !state.enemies.some(enemy => registeredEntry(codeOf(enemy))?.flags?.ashleigh)) {
    api.spawn('03069b', 'porteDeLAvancee')
  }
}

export function advanceAgendaDeck(state, deckId, api) {
  syncMainAgenda(state)
  const decks = state.scenarioFlags.agendaDecks
  const deck = decks?.[deckId]
  if (!deck || deck.removed) return null
  if (deck.index >= 3) throw new Error(`未知黑星升起密谋牌堆：${deckId}`)
  const code = deck.cards[deck.index]
  // 两条密谋牌堆都不走引擎的 advanceAgenda，推进时在这里补拍脸：
  // 先翻当前密谋背面，结算完再亮出下一张密谋或替换上来的场景。
  presentAgendaFlip(api, code)
  let ended = false
  if (deck.index === 0) {
    const opposing = decks[deckId === 'a' ? 'c' : 'a']
    // 03275/03278 背面：检查「另一条密谋」当前是否仍是 1a/1c。
    //  - 对立密谋上的毁灭 ≤2 记确信，≥3 记疑惑；
    //  - 若对立密谋已不是 1a/1c（index ≠ 0），本次不记任何疑惑/确信。
    // 卡面没有「每轮一次」限制，旧实现的 bsrMarkRound 守卫会吞掉合法记录，已移除。
    if (opposing.index === 0) addCampaignMark(state, opposing.doom >= 3 ? 'doubt' : 'conviction')
    const additions = deckId === 'a' ? ['03300', '03300'] : ['03301', '03301']
    state.encounterDeck.push(...state.encounterDiscard.splice(0), ...additions)
    api.shuffleEncounterDeck?.()
    deck.index = 1
    deck.doom = 0
  } else if (deck.index === 1) {
    // 卡背两种版本：
    //  b：把本密谋牌堆移出游戏，用放在一边的场景 3a/3c 替换并推进到该场景。
    //  a：把另一张场景 3a/3c 移出游戏，推进到 agendas 3a/3c，目标在另一密谋牌堆。
    const route = state.scenarioFlags.route
    const routeAct = stageCards[route].act
    const otherAct = stageCards[route === 'below' ? 'above' : 'below'].act
    // 放在一边的卡由引擎的 scenarioZones.setAside 承载（旧实现误写 scenarioFlags.setAside，
    // 那份数组从不存在，导致 removeSetAside 永远删不到东西）。
    const setAside = state.scenarioZones?.setAside || (state.scenarioZones.setAside = [])
    const removeSetAside = target => {
      const index = setAside.indexOf(target)
      if (index >= 0) setAside.splice(index, 1)
    }
    if (String(code).endsWith('b')) {
      // 正确路线（03276b/03279b「The Path to Carcosa」）：本密谋牌堆移出游戏，
      // 换成放在一边的 act 3a/3c，并「开启道路」——此后幕的目标才能被检查。
      removeSetAside(routeAct)
      installPendingAct(state, routeAct)
      state.scenarioFlags.openPath = true
      state.scenarioFlags.pathOpenedBy = deckId
      deck.index = 3
      deck.removed = true
      deck.doom = 0
      if (deckId === 'a') {
        state.doom = 0
        // 卡面：把本密谋牌堆剩下的部分移出游戏。换成克隆数组可让
        // advanceAgenda 的「reveal 期间牌堆被替换」判据生效，不再翻出已移除的 3a。
        // （与 TFA《边界之外》同类替换写法一致。）
        state.agendas = (state.agendas || []).slice(0, state.agendaIndex + 1)
          .map(card => structuredClone(card))
      }
      api.info?.(`🌑 本密谋牌堆移出游戏，改用场景卡「${routeAct}」继续；道路已经开启。`)
    } else {
      removeSetAside(otherAct)
      spawnAshleighAndBeast(state, deckId, api)
      state.scenarioFlags.wrongRoute = deckId
      deck.index = 2
      deck.doom = 0
      api.info?.(`🌒 另一本密谋牌堆才是目标；移除了场景卡「${otherAct}」。`)
    }
  } else {
    ended = true
    api.finish('r3')
  }
  if (deckId === 'a' && !deck.removed) {
    state.doom = deck.doom
    state.agendaIndex = deck.index
  }
  // 密谋推进后移除场上其他卡牌的毁灭。另一套密谋上的毁灭留着：
  // 1a/1c 背面要按「对面密谋上有几个毁灭」记确信或疑惑。
  clearFieldDoom(state)
  if (!ended && (state.status == null || state.status === 'playing')) {
    if (deck.removed && state.scenarioFlags.pathOpenedBy === deckId) {
      const act = state.acts?.[state.actIndex]
      if (act) presentRevealedCard(api, codeOf(act), '新的场景')
    } else if (!deck.removed && deck.cards[deck.index]) {
      presentRevealedCard(api, deck.cards[deck.index], '新的密谋')
    }
  }
  return code
}

export function placeAgendaDoom(state, deckId, amount, api) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('毁灭标记数量无效')
  syncMainAgenda(state)
  // 道路开启后两张密谋牌堆都已被替换，毁灭不再落在这两条牌堆上
  // （否则 03301/03284 等效果仍可把已移出的 3a/3c 推成 R3）。
  if (state.scenarioFlags?.openPath) return 0
  const deck = state.scenarioFlags.agendaDecks?.[deckId]
  if (!deck) throw new Error(`未知黑星升起密谋牌堆：${deckId}`)
  deck.doom += amount
  if (deckId === 'a') state.doom = deck.doom
  if (deckId === 'a') {
    const wall = state.locations.find(location => location.id === 'outerWall')
    if (registeredEntry(codeOf(wall))?.flags?.wall) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned && item.location === 'outerWall')) {
        api.damage?.(inv.seat, 1)
      }
    }
  }
  if (deckId === 'c') {
    const tower = state.locations.find(location => location.id === 'northTower')
    if (registeredEntry(codeOf(tower))?.flags?.tower) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned && item.location === 'northTower')) {
        api.horror?.(inv.seat, 1)
      }
    }
  }
  // 刚放上的毁灭，加上场上其他卡牌的毁灭，两套密谋各自和自己的阈值比。
  resolveReadyAgendas(state, api, deckId)
}

export const behavior = {
  ...encounterRules,
  id: 'blackStarsRise',
  countedAgendaDoom,
  setupPlan,
  // 开局没有场景牌。导入拍脸左侧是「a」密谋，右侧是「c」密谋。
  introSplash(state) {
    const decks = state.scenarioFlags?.agendaDecks
    const face = deck => {
      if (!deck || deck.removed) return null
      const code = deck.cards?.[deck.index]
      const card = code ? ALL_CARDS[code] : null
      if (!card) return null
      return { code, name: card.nameZh || card.name || code }
    }
    const left = face(decks?.a)
    const right = face(decks?.c)
    if (!left && !right) return null
    const primary = left || right
    return {
      code: primary.code,
      artName: primary.name,
      ...(right && (!left || right.code !== left.code)
        ? { asideCode: right.code, asideName: right.name } : {}),
    }
  },
  describe(state) {
    const decks = state.scenarioFlags?.agendaDecks
    if (!decks) return []
    const summary = deckId => {
      const deck = decks[deckId]
      if (!deck) return null
      if (deck.removed) return `“${deckId}”密谋牌堆已移出游戏`
      const card = ALL_CARDS[deck.cards?.[deck.index]]
      const threshold = card?.doom ?? '?'
      const doom = countedAgendaDoom(state, deck)
      const field = fieldDoom(state)
      const extra = field > 0 && !state.scenarioFlags.openPath ? `（含场上 ${field}）` : ''
      return `“${deckId}”密谋「${card?.nameZh || deck.cards?.[deck.index] || '?'}」毁灭 ${doom}/${threshold}${extra}`
    }
    const lines = [`【双密谋】${['a', 'c'].map(summary).filter(Boolean).join('；')}。往当前密谋放毁灭时选择其中一套。敌人、地点和其他卡牌上的毁灭同时计入两套密谋。`]
    if (!state.scenarioFlags.openPath) lines.push('场景牌仍放在一边。道路开启前不能按场景目标结束本关。')
    return lines
  },
  // 场景卡：每名调查员从收藏里随机获得 1 张「疯狂/契约/异教徒/侦探」基础弱点。
  preScenarioSetup(state, events, api) {
    const campaign = state.campaign ||= {}
    if (campaign.bsrWeaknessAdded) return
    campaign.bsrWeaknessAdded = true
    const traits = ['madness', 'pact', 'cultist', 'detective']
    for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
      const code = api?.addBasicWeakness?.(inv.seat, traits)
      if (!code) continue
      // 与幻影的 03227 同口径：这次加入的弱点留在战役牌组里。
      const record = campaign.investigators?.[inv.seat]
      if (record && Array.isArray(record.deck) && !record.deck.includes(code)) record.deck.push(code)
    }
  },
  // 场景卡：按难度调整混乱袋（Easy -3 / Standard -5 / Hard -6 / Expert -7）。
  afterChaosBagSetup(state) {
    const extra = { easy: '-3', standard: '-5', hard: '-6', expert: '-7' }[state.difficulty] || '-5'
    state.chaosBag.push(extra)
    state.scenarioFlags ||= {}
    state.scenarioFlags.temporaryChaosToken = extra
  },
  // 「在当前议程上放置毁灭」：本关有 a/c 两套密谋，由玩家选择其中一套
  // （参考实现同样用 PlaceDoomOnAgenda 询问）。返回 true = 本次放置已由本关接管。
  doomPlacementReplacement(state, amount, api) {
    if (!(amount > 0)) return false
    if (state.scenarioFlags?.openPath) return true
    const decks = Object.values(state.scenarioFlags?.agendaDecks || {}).filter(deck => deck && !deck.removed)
    if (!decks.length) return false
    if (decks.length === 1) {
      placeAgendaDoom(state, decks[0].id, amount, api)
      return true
    }
    const answer = api.choose({
      kind: 'agenda', source: 'blackStarsRise-doom',
      seat: state.currentSeat ?? state.campaign?.leadSeat ?? 0,
      prompt: '在当前议程上放置毁灭：选择 a 或 c 密谋。',
      options: decks.map(deck => ({ id: deck.id, label: `“${deck.id}” 密谋（毁灭 ${countedAgendaDoom(state, deck)}）` })),
    })
    placeAgendaDoom(state, answer === 'c' ? 'c' : 'a', amount, api)
    return true
  },
  resolveChaosToken(state, inv, token, api) {
    const base = carcosaChaosToken('blackStarsRise', state, inv, token, api)
    if (!base) return null
    syncMainAgenda(state)
    const decks = state.scenarioFlags.agendaDecks || { a: { doom: state.doom || 0 }, c: { doom: 0 } }
    const hard = ['hard', 'expert'].includes(state.difficulty)
    if (token === 'skull') return {
      delta: -(hard ? decks.a.doom + decks.c.doom : Math.max(decks.a.doom, decks.c.doom)),
    }
    if (token === 'cultist') {
      const enemy = state.enemies.find(item => item.location === inv.location && (item.doom || 0) > 0)
      const targetsDoomEnemy = enemy && ['fight', 'evade'].includes(state.skillTest?.action)
      return { delta: 0, drawAnother: true, autoFail: hard ? !!enemy : !!targetsDoomEnemy }
    }
    if (token === 'tablet') return { delta: 0, drawAnother: true }
    return { delta: hard ? -3 : -2 }
  },
  setupLocations(state, events, api) {
    state.scenarioFlags = {}
    const plan = setupPlan(state, api)
    state.scenarioFlags.route = plan.route
    state.scenarioFlags.agendaDecks = clone(plan.agendaDecks)
    state.scenarioFlags.ashleighDoomAbility = interviewedAshleigh(state)
    state.scenarioZones.setAside = [...plan.setAside]
    state.scenarioZones.removed = [...plan.removed]
    for (const [id, code] of Object.entries(plan.variants)) {
      state.locationVariants[id] = clone(state.scenario.locationVariants[id]
        .find(location => location.originalCode === code))
    }
    state.agendas = definitionsFor(plan.route, 'a')
    state.scenario.agendas = clone(state.agendas)
    state.agendaIndex = 0
    // 两张场景 3a/3c 开局都放在一边。正确密谋 2 的背面才会把对应那张换成当前场景。
    // 提前放进 acts 会让剧本书右页亮出「浪破路现 / 天开路现」，等于公开哪条路是对的。
    const routeAct = stageCards[plan.route].act
    const actSource = state.scenario?.acts || state.acts || []
    const actCard = actSource.find(act => codeOf(act) === routeAct)
    state.scenarioFlags.pendingAct = actCard ? clone(actCard) : null
    state.acts = []
    if (state.scenario) state.scenario.acts = []
    state.actIndex = 0
    return plan.locations
  },
  locationRevealed(state, location, api) {
    if (location.id === 'abbeyChurch') {
      for (const id of ['choeurGothique', 'cloister', 'knightsHall', 'chapelOfStAubert', 'abbeyTower']) api.place(id)
    }
  },
  investigationError(state, inv, location) {
    const code = codeOf(location)
    return locationRuleFor(code)?.investigationError?.(state, inv, location) ?? null
  },
  // 03295：线索取完后的「用敏捷调查、记住塔楼钥匙」仍是调查行动。
  investigateWithoutClues(state, inv, location) {
    return locationRuleFor(codeOf(location))?.investigateWithoutClues?.(state, inv, location) === true
  },
  investigateSkill(state, inv, location) {
    return locationRuleFor(codeOf(location))?.investigateSkill?.(state, inv, location) || null
  },
  investigateResult(state, inv, location, result, api) {
    const ruled = locationRuleFor(codeOf(location))?.investigateResult?.(state, inv, location, result, api)
    if (ruled === false) return false
  },
  encounterActions(state, inv) {
    const moves = encounterRules.encounterActions?.(state, inv) || []
    for (const enemy of state.enemies.filter(candidate =>
      codeOf(candidate) === '03301' && candidate.location === inv.location)) {
      moves.push({
        action: 'encounterAction', actionKind: 'parley', rule: 'parleyRiftSeeker',
        enemyId: enemy.id, actions: 1,
        label: '谈判裂缝探求者：在两个密谋上各放1毁灭并受到2点恐惧',
      })
    }
    return moves
  },
  performEncounterAction(state, inv, move, api) {
    if (move.rule !== 'parleyRiftSeeker') {
      return encounterRules.performEncounterAction?.(state, inv, move, api)
    }
    const enemy = state.enemies.find(candidate => candidate.id === move.enemyId
      && codeOf(candidate) === '03301' && candidate.location === inv.location)
    if (!enemy) throw new Error('裂缝探求者不在此处')
    api.horror(inv.seat, 2)
    for (const deckId of ['a', 'c']) placeAgendaDoom(state, deckId, 1, api)
    if (state.enemies.includes(enemy)) api.discardEnemy(enemy)
  },
  enemyAttackResolved(state, enemy, inv, api) {
    encounterRules.enemyAttackResolved?.(state, enemy, inv, api)
    if (codeOf(enemy) !== '03301' || inv.defeated || inv.resigned) return
    const choice = api.choose({
      kind: 'encounter',
      source: enemy.id,
      seat: inv.seat,
      prompt: '裂缝探求者攻击后：选择受到额外伤害与恐惧，或在两个密谋上各放1毁灭。',
      options: [
        { id: 'harm', label: '受到1点额外伤害和1点额外恐惧' },
        { id: 'doom', label: '在两个密谋上各放1点毁灭' },
      ],
    })
    if (choice === 'doom') {
      for (const deckId of ['a', 'c']) placeAgendaDoom(state, deckId, 1, api)
    } else {
      api.damage(inv.seat, 1)
      api.horror(inv.seat, 1)
    }
  },
  agendaReveal(state, agenda, api) {
    advanceAgendaDeck(state, 'a', api)
  },
  actions(state, inv) {
    const moves = []
    const location = state.locations.find(item => item.id === inv.location)
    const code = codeOf(location)
    const decks = state.scenarioFlags.agendaDecks || {}
    // 地点能力已经就位，只差"密谋上有毁灭""本地点线索已取空""手牌还有"这类能改变的条件。
    // 第 90 轮：03296/03298 的行动在地点条目声明。
    // 第 106 轮：03283/03292/03293 的行动在地点条目声明。
    locationRuleFor(code)?.actions?.({ state, inv, location, moves })
    const teamClues = active(state).reduce((sum, investigator) => sum + (investigator.clues || 0), 0)
    // 道路开启后两条密谋牌堆都已被替换，卡面上的 [fast] 不复存在：
    // 不再提供「花线索放毁灭」，否则会变成只拿奖励、不付代价的行动。
    if (!state.scenarioFlags.openPath) {
      const usedThisRound = state.scenarioFlags.hastenRound || {}
      for (const deckId of ['a', 'c']) {
        const deck = decks[deckId]
        if (!deck || deck.removed) continue
        // 卡面 [fast] 只印在 03275/03276a/b/03278/03279a/b 上；其它阶段的卡没有这条能力。
        if (!HASTEN_AGENDA_CODES.has(deck.cards?.[deck.index])) continue
        const used = usedThisRound[deckId] === state.round
        moves.push({
          action: 'scenarioAction',
          rule: 'hastenAgenda',
          deckId,
          actions: 0,
          used: used || undefined,
          scriptCard: 'agenda',
          label: `共同花费 ${state.numInvestigators} 线索，在“${deckId}”密谋上放置1毁灭，${
            deckId === 'a' ? '每位调查员获得2资源' : '每位调查员抽取1张牌'}`,
          reason: used ? '这张密谋卡本轮的团队能力已使用（团队每轮仅限一次）'
            : teamClues >= state.numInvestigators ? null
              : `需要共同花费 ${state.numInvestigators} 个线索（当前 ${teamClues}）`,
        })
      }
    }
    if (!state.scenarioFlags.openPath
      && state.scenarioFlags.ashleighDoomAbility && !state.scenarioFlags.ashleighDoomUsed) {
      // 每张有毁灭的密谋各给一条，并带上 deckId。合成一条不带牌堆的行动时，
      // 两堆都有毁灭会在执行阶段才失败。
      const doomed = ['a', 'c'].filter(deckId => {
        const deck = decks[deckId]
        return deck && !deck.removed && deck.doom > 0
      })
      if (!doomed.length) {
        moves.push({ action: 'scenarioAction', rule: 'ashleighDoom', actions: 0, label: '阿什莉提供的信息：移除1毁灭',
          reason: '“a”“c”两张密谋上都没有毁灭' })
      } else {
        for (const deckId of doomed) {
          moves.push({
            action: 'scenarioAction', rule: 'ashleighDoom', deckId, actions: 0,
            label: `阿什莉提供的信息：从“${deckId}”密谋移除1毁灭`,
          })
        }
      }
    }
    return moves
  },
  performAction(state, inv, move, api) {
    const location = state.locations.find(item => item.id === inv.location)
    const code = codeOf(location)
    // 第 90 轮：地点条目先接管自己的场景行动。
    if (locationRuleFor(code)?.performAction?.(state, inv, move, api)) return
    if (move.rule === 'shiftAgendaDoom') {
      const decks = state.scenarioFlags.agendaDecks
      const sources = Object.values(decks).filter(deck => deck.doom > 0)
      if (code !== '03283' || !sources.length) throw new Error('晋升之门能力当前不可用')
      const sourceId = sources.length === 1 ? sources[0].id : api.choose({
        kind: 'story', source: code, seat: inv.seat, prompt: '选择移出1个毁灭的密谋牌堆。',
        options: sources.map(deck => ({ id: deck.id, label: `“${deck.id}”密谋（${deck.doom}毁灭）` })),
      })
      const source = decks[sourceId]
      const destination = decks[sourceId === 'a' ? 'c' : 'a']
      source.doom--
      if (source.id === 'a') state.doom = source.doom
      placeAgendaDoom(state, destination.id, 1, api)
      location.clues = (location.clues || 0) + 2
    } else if (move.rule === 'choeurGothiqueHeal') {
      // 第 114 轮：密谋牌堆与治愈类型由地点条目的 locationRule.choeurGothique 声明。
      const rule = locationRuleFor(code)?.choeurGothique
      if (!rule || state.scenarioFlags.choeurGothiqueUsed) {
        throw new Error('哥特式唱诗台能力当前不可用')
      }
      state.scenarioFlags.choeurGothiqueUsed = true
      placeAgendaDoom(state, rule.deck, 1, api)
      if (rule.heal === 'damage') api.healDamage(inv.seat, 2)
      else api.healHorror(inv.seat, 2)
    } else if (move.rule === 'hastenAgenda') {
      if (state.scenarioFlags.openPath) throw new Error('密谋牌堆已被替换，卡面能力不可用')
      const deck = state.scenarioFlags.agendaDecks?.[move.deckId]
      if (!deck || deck.removed) throw new Error('该密谋牌堆已不在场上')
      if (!HASTEN_AGENDA_CODES.has(deck.cards?.[deck.index])) throw new Error('当前密谋卡没有这条能力')
      const used = state.scenarioFlags.hastenRound ||= {}
      if (used[move.deckId] === state.round) throw new Error('这张密谋卡本轮的团队能力已使用')
      api.payClues(state.numInvestigators)
      used[move.deckId] = state.round
      placeAgendaDoom(state, move.deckId, 1, api)
      if (move.deckId === 'a') for (const target of active(state)) target.resources += 2
      else for (const target of active(state)) api.drawCards(target.seat, 1)
    } else if (move.rule === 'ashleighDoom') {
      if (state.scenarioFlags.openPath) throw new Error('密谋牌堆已被替换，卡面能力不可用')
      const decks = state.scenarioFlags.agendaDecks
      const candidates = Object.values(decks).filter(deck => deck && !deck.removed && deck.doom > 0)
      if (!candidates.length || state.scenarioFlags.ashleighDoomUsed) throw new Error('阿什莉的能力当前不可用')
      const deck = move.deckId != null
        ? candidates.find(item => item.id === move.deckId)
        : (candidates.length === 1 ? candidates[0] : null)
      if (!deck) throw new Error('必须选择有毁灭标记的密谋牌堆')
      deck.doom--
      if (deck.id === 'a') state.doom = deck.doom
      state.scenarioFlags.ashleighDoomUsed = true
    } else throw new Error(`未知黑星升起行动：${move.rule}`)
  },
  encounterGainsSurge(state, code) {
    if (code !== '01136') return false
    const agenda = state.agendas?.[state.agendaIndex]
    return ['03276a', '03276b', '03277'].includes(codeOf(agenda))
  },
  enemyStatModifier(state, enemy, stat) {
    const base = encounterRules.enemyStatModifier(state, enemy, stat)
    if (stat !== 'fight') return base
    const decks = state.scenarioFlags?.agendaDecks
    const cCode = decks?.c ? decks.c.cards?.[decks.c.index] : null
    const agenda = codeOf(state.agendas?.[state.agendaIndex])
    const monster = enemy.traits?.some(trait => String(trait).toLowerCase() === 'monster')
    // c 牌堆的密谋不是主议程：怪物 +1 攻击需直接读 c 牌堆当前卡。
    const cMonsterBonus = MONSTER_BONUS_AGENDAS.includes(cCode)
    const aMonsterBonus = MONSTER_BONUS_AGENDAS.includes(agenda)
    return base + (monster && (aMonsterBonus || cMonsterBonus) ? 1 : 0)
  },
  commitIconMultiplier(state, inv, location) {
    if (codeOf(location) !== '03286') return 1
    const decks = state.scenarioFlags?.agendaDecks
    if (!decks) return 1
    return decks.c.doom > decks.a.doom ? 2 : 1
  },
  locationShroudModifier(state, location) {
    const code = codeOf(location)
    if (registeredEntry(code)?.flags?.abbeyChurch) {
      // 场上有两张编号不同的密谋：+2 帷幕。
      const decks = state.scenarioFlags?.agendaDecks
      return decks && decks.a.index !== decks.c.index ? 2 : 0
    }
    if (!registeredEntry(code)?.flags?.northTower) return 0
    const decks = state.scenarioFlags?.agendaDecks
    return decks && decks.a.doom > decks.c.doom ? -1 : 0
  },
  // 北部塔楼：「a」密谋上的毁灭多于「c」时，此地点的所有技能检定难度 -1。
  testDifficultyModifier(state, inv) {
    const location = state.locations.find(item => item.id === inv.location)
    if (!registeredEntry(codeOf(location))?.flags?.northTower) return 0
    const decks = state.scenarioFlags?.agendaDecks
    return decks && decks.a.doom > decks.c.doom ? -1 : 0
  },
  locationEntered(state, inv, location, api) {
    const code = codeOf(location)
    const trait = registeredEntry(code)?.flags?.stairsTrait
    if (!trait) return
    const discard = { id: 'discard', label: '弃掉一个你控制的支援' }
    const draw = { id: 'draw', label: trait === 'omen' ? '抽取遭遇弃牌堆顶的预兆诡计' : '抽取遭遇弃牌堆顶的异教徒敌人' }
    const options = inv.assets.length ? [discard, draw] : [draw]
    const choice = options.length === 1 ? options[0].id : api.choose({
      kind: 'encounter', source: code, seat: inv.seat,
      prompt: trait === 'omen' ? '垮塌的台阶：弃掉支援或抽取预兆诡计。' : '垮塌的台阶：弃掉支援或抽取异教徒敌人。',
      options,
    })
    if (choice === 'discard') {
      const chosen = inv.assets.length === 1 ? inv.assets[0].id : api.choose({
        kind: 'discard-asset', source: code, seat: inv.seat, prompt: '选择要弃掉的支援。',
        options: inv.assets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
      })
      const asset = inv.assets.find(item => item.id === chosen)
      if (asset) api.discardAsset(inv.seat, asset)
    } else {
      const index = state.encounterDiscard.findLastIndex(card => ALL_CARDS[codeOf(card)]?.traits
        ?.some(value => String(value).toLowerCase() === trait))
      if (index >= 0) {
        const card = state.encounterDiscard.splice(index, 1)[0]
        state.encounterDeck.push(card)
        api.drawEncounter(inv.seat)
      } else {
        api.loseActions(inv.seat, 1)
      }
    }
  },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    const here = state.locations.find(location => location.id === inv.location)
    if (result.success && result.source?.label === '调查' && codeOf(here) === '03284'
      && result.value - result.difficulty <= 1) {
      const decks = state.scenarioFlags.agendaDecks
      if (decks) {
        const target = decks.a.doom > decks.c.doom ? 'a' : decks.c.doom > decks.a.doom ? 'c'
          : api.choose({
            kind: 'agenda', source: '03284', seat: inv.seat,
            prompt: '环山大道：两张密谋的毁灭数相等，选择在其中一张上放置 1 个毁灭。',
            options: [{ id: 'a', label: 'a 密谋' }, { id: 'c', label: 'c 密谋' }],
          })
        placeAgendaDoom(state, target, 1, api)
      }
    }
    const hard = ['hard', 'expert'].includes(state.difficulty)
    const tokens = result.drawn || []
    if (tokens.includes('tablet') && (!result.success || (hard && result.value - result.difficulty < 1))) {
      for (const id of ['a', 'c']) placeAgendaDoom(state, id, 1, api)
    }
    if (!result.success && tokens.includes('elderthing')) {
      for (const pile of [state.encounterDeck, state.encounterDiscard]) {
        const index = pile.findIndex(code => ALL_CARDS[code]?.traits?.includes('Byakhee'))
        if (index < 0) continue
        state.encounterDeck.push(pile.splice(index, 1)[0])
        api.drawEncounter(inv.seat)
        break
      }
    }
  },
  checkObjectives(state, api) {
    // 只有「The Path to Carcosa」背面换成 act 3a/3c 之后（openPath）幕目标才可检查。
    if (!state.scenarioFlags.openPath) return
    const alive = active(state)
    if (!alive.length) return
    const route = stageCards[state.scenarioFlags.route]
    const location = state.locations.find(item => item.id === route.pathLocation)
    if (!location || (location.clues || 0) > 0) return
    if (alive.every(inv => inv.location === route.pathLocation)) api.finish(route.resolution)
  },
  // 场上出现毁灭时立刻重算两套阈值（引擎的 checkAgenda 只认主密谋）。
  doomPlaced(state, payload, api) {
    if (payload?.agenda || !(payload?.amount > 0)) return
    resolveReadyAgendas(state, api)
  },
  mythosDoomChecked(state, api) {
    resolveReadyAgendas(state, api)
  },
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    resolveReadyAgendas(state, api)
  },
  // 双密谋的阈值由本关结算。挡住引擎对主密谋的自动推进，避免它先清掉场上毁灭。
  // 道路开启后同样挡住：场景卡替换密谋牌堆之后，毁灭不再把 3a/3c 推进成结局 3。
  agendaWouldAdvance(state) {
    return state.scenarioFlags?.openPath === true || !!state.scenarioFlags?.agendaDecks
  },
  storyResolutionKey(_state, key) {
    return key === 'noResolution' ? 'r3' : key
  },
  resolution(state, key) {
    if (key === 'noResolution') key = 'r3'
    if (!['r1', 'r2', 'r3'].includes(key)) throw new Error('未知黑星升起结局')
    const records = state.campaign.records
    if (key === 'r1') records.youOpenedThePathBelow = true
    if (key === 'r2') records.youOpenedThePathAbove = true
    if (key === 'r3') {
      records.theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth = true
      state.campaign.failed = true
      for (const record of Object.values(state.campaign.investigators)) record.status = 'insane'
      return { award: false }
    }
    const kept = key === 'r1' ? ['cultist', 'cultist', 'tablet', 'tablet']
      : ['cultist', 'cultist', 'elderthing', 'elderthing']
    state.chaosBag = state.chaosBag.filter(token => !['cultist', 'tablet', 'elderthing'].includes(token)).concat(kept)
    state.campaign.chaosBag = [...state.chaosBag]
    if ((state.victoryDisplay || []).some(card => codeOf(card) === '03069b')) {
      records.vipsSlain ||= []
      if (!records.vipsSlain.includes('03069')) records.vipsSlain.push('03069')
    }
    return { award: true }
  },
}
