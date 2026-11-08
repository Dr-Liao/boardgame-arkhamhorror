// 亡命冰原 第 II 部分 · 引擎钩子（营地之夜、失踪队员、剧情卡与结局）。
//
// 约定同第 I 部分：behavior 只做章节分派与本章机制；逐卡规则在被附身队员/剧情单卡条目里。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor, entryFlags } from '../../../../../src/cards/card-rules.js'
import { initializeTekeliDeck, tekeliReturn, tekeliShuffleIn } from '../../../../../src/engine/eote-tekeli.js'
import {
  campLocationId, recordRevealedLocation, revealedLocations, setCampLocation,
} from '../../../../../src/engine/eote-camp.js'
import { locationShelter } from '../../../../../src/engine/eote-shelter.js'
import { partnerState, setPartnerStatus } from '../../../../../src/campaign/eote-partners.js'
import {
  CHAPTER_ID, CAMP_IDS, DEFAULT_CAMP, LOCATIONS, POSSESSED_ENEMY_CODES, POSSESSED_PARTNERS,
  RAW_CODES as RAW, SET_ASIDE_ALIASES, STORY_CODES, UNCHARTED_LOCATION_IDS, scenario,
} from './definition.js'
import { part2ChaosFailureSpec, part2ChaosTokenValue, shelterValueOf } from './chaos.js'

const codeOf = card => card?.originalCode || card?.code || card
const activeInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const recordsOf = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const leadSeat = state => Number(state.campaign?.leadSeat ?? 0)
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id)
const setAside = state => (state.scenarioZones ||= {}).setAside ||= []
const numInvestigators = state => Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1)
const partnerCodeOfEnemy = enemyCode => (POSSESSED_PARTNERS.find(([, enemy]) => enemy === enemyCode) || [])[0] || null
const isPossessedEnemy = code => POSSESSED_ENEMY_CODES.includes(code)

function campIdOf(state) {
  const record = recordsOf(state).camp || campLocationId(state)
  return CAMP_IDS.includes(record) ? record : DEFAULT_CAMP
}

function makeRuntimeLocation(state, id, revealed) {
  const data = LOCATIONS[id]
  const clueCount = data.cluesFixed != null ? data.cluesFixed : (data.cluesPerInvestigator || 0) * numInvestigators(state)
  return {
    ...structuredClone(data), id, revealed, clues: revealed ? clueCount : 0, maxClues: clueCount, doom: 0,
    connections: [...(data.connections || [])],
  }
}

const putLocation = (state, id, revealed = false) => {
  if (locationOf(state, id)) return locationOf(state, id)
  const placed = makeRuntimeLocation(state, id, revealed)
  if (placed) state.locations.push(placed)
  return placed
}

// Haskell#Setup：放营地与全部地点；把 Mia 队员敌人 + 8 张剧情卡洗成 9 张，压到未探索地点下。
export function setupScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  state.campaign ||= {}
  state.acts = structuredClone(scenario.acts)
  state.agendas = structuredClone(scenario.agendas)
  state.actIndex = 0
  state.agendaIndex = 0
  state.doom = 0
  state.round = 1
  state.locations = []
  const camp = campIdOf(state)
  const revealed = new Set([...(recordsOf(state).locationsRevealed || []), ...(revealedLocations(state) || [])])
  for (const id of CAMP_IDS) {
    const place = putLocation(state, id, revealed.has(id))
    if (id === camp) {
      place.revealed = true
      place.clues = 0
    }
  }
  try { setCampLocation(state, camp) } catch { /* 地点已重置时忽略 */ }
  state.scenarioFlags.camp = camp
  for (const inv of state.investigators || []) inv.location = camp

  // 队员状态：Mia 的队员变成被附身敌人放一边；其余队员从场上移除（由战役流程持有）。
  const miaEnemies = []
  const partners = state.campaign?.eote?.partners?.roster || []
  for (const partner of partners) {
    if (partner.status !== 'mia') continue
    const row = POSSESSED_PARTNERS.find(([asset]) => asset === partner.code)
    if (row) miaEnemies.push(row[1])
  }
  state.scenarioZones.setAside = [...new Set([...miaEnemies, ...STORY_CODES])]
  state.encounterDeck = [...scenario.encounterDeck]
  state.encounterDiscard ||= []
  state.victoryDisplay ||= []
  state.enemies ||= []
  initializeTekeliDeck(state, { cards: [...RAW.tekeliliFaces], copies: [...RAW.tekeliliCopies] })

  // 9 张（Mia 敌人 + 剧情卡）压到未探索地点下；其余放回「移出游戏」。
  const hidden = [...miaEnemies, ...STORY_CODES]
  const under = hidden.slice(0, 9)
  const removed = hidden.slice(9)
  const uncharted = UNCHARTED_LOCATION_IDS.map(id => locationOf(state, id)).filter(Boolean)
  under.forEach((code, index) => {
    const host = uncharted[index % Math.max(1, uncharted.length)]
    if (!host) return
    host.beneath ||= []
    host.beneath.push(code)
    host.beneathFaceDown ||= []
    host.beneathFaceDown.push(true)
  })
  state.scenarioZones.removed = [...(state.scenarioZones.removed || []), ...removed]
  // 压在地点下的卡已经不在「放一边」；放一边只留超过 9 张的余牌（Haskell removeEvery）。
  state.scenarioZones.setAside = [...removed]
  api.info?.(`🌌 亡命冰原 II：营地在「${LOCATIONS[camp]?.name || camp}」；${under.length} 张卡压在未探索地点下。`)
  return {
    camp, placed: CAMP_IDS.length, beneath: under.length, removed: removed.length,
    setAside: state.scenarioZones.setAside.length, encounterDeck: state.encounterDeck.length,
  }
}

/** 议程 IV/V 背面（08523/08524）：选择一张压在某个地点底下正面朝下的遭遇卡，查看后放回。 */
function lookUnderLocation(state, api = {}) {
  const hosts = (state.locations || []).filter(location => (location.beneath || []).length)
  if (!hosts.length) return { looked: null }
  const hostId = hosts.length === 1 ? hosts[0].id : api.choice?.({
    kind: 'location', source: 'lookUnderLocation', seat: leadSeat(state),
    prompt: '选择一个底下压有正面朝下遭遇卡的地点。',
    options: hosts.map(location => ({ id: location.id, label: location.name || location.id })),
  })
  const host = hosts.find(location => location.id === hostId) || hosts[0]
  const codes = host.beneath || []
  const code = codes.length === 1 ? codes[0] : api.choice?.({
    kind: 'card', source: 'lookUnderLocation', seat: leadSeat(state),
    prompt: '选择一张正面朝下的遭遇卡查看（不结算其文字）。',
    options: codes.map((item, index) => ({ id: String(index), label: `正面朝下的遭遇卡 ${index + 1}`, cardCode: item })),
  })
  const beneath = codes.length === 1 ? codes[0] : codes[Number(code)] || codes[0]
  state.scenarioFlags ||= {}
  state.scenarioFlags.lookedAt = { locationId: host.id, code: beneath }
  api.cardReveal?.(beneath, ALL_CARDS[beneath]?.nameZh || beneath)
  api.info?.(`👁️ 查看「${host.name || host.id}」底下的一张卡（正面朝下放回，不结算文字）。`)
  return { looked: { locationId: host.id, code: beneath } }
}

/** 议程 VI 背面（08525）：剩下的每位调查员被击败并承受 1 点精神创伤，然后结算结局 1。 */
function madnessAndDeath(state, api = {}) {
  for (const inv of activeInvestigators(state)) {
    try { api.defeatInvestigator?.(inv.seat) } catch { /* 测试 stub 未提供时退化为直接标记 */ }
    if (!inv.defeated) inv.defeated = true
    api.addTrauma?.(inv.seat, 'mental', 1)
  }
  api.info?.('🌑 疯狂与死亡背面：剩下的调查员全部被击败（1 点精神创伤）。')
  api.finish?.('resolution1')
  return { defeated: activeInvestigators(state).length }
}

// 议程背面的分发表：条目 `agendaRule.onAdvance` 给出处理函数名（声明即读点），
// 未注册条目（部分单测直接 import 章节）时退回 definition 的 `chapterFlow`。
const AGENDA_BACK_HANDLERS = Object.freeze({
  lookUnderLocation,
  defeatRemainingAndResolve: madnessAndDeath,
})
const AGENDA_FLOW_HANDLERS = Object.freeze({
  aHarshWindBlows: 'lookUnderLocation',
  theChillOfNight: 'lookUnderLocation',
  madnessAndDeath: 'defeatRemainingAndResolve',
  [RAW.agendaHarshWind]: 'lookUnderLocation',
  [RAW.agendaChillOfNight]: 'lookUnderLocation',
  [RAW.agendaMadnessAndDeath]: 'defeatRemainingAndResolve',
})

/** 议程背面分派（引擎 phases.js#runAgendaReveal → behavior.agendaReveal）。 */
export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda) || String(agenda || '')
  const stage = (state.agendas || [])[state.agendaIndex] || (state.scenario?.agendas || [])[state.agendaIndex]
  const flow = agendaRuleFor(code)?.chapterFlow || stage?.chapterFlow || code
  const rule = agendaRuleFor(code)
  const handlerName = rule?.onAdvance || AGENDA_FLOW_HANDLERS[flow]
  const handler = handlerName && AGENDA_BACK_HANDLERS[handlerName]
  return handler ? handler(state, api) != null : false
}

/** 幕 08526 背面 (→结局 1)：由引擎 reveal.js#runActReveal 调用。 */
export function actReveal(state, act, api = {}) {
  const code = codeOf(act) || String(act || '')
  const stage = (state.acts || [])[state.actIndex] || (state.scenario?.acts || [])[state.actIndex]
  const flow = actRuleFor(code)?.chapterFlow || stage?.chapterFlow
  if (flow === 'theLostExpedition' || code === RAW.actLostExpedition) {
    api.finish?.('resolution1')
    return true
  }
  return false
}

const storyCard = code => ALL_CARDS[code] || {}

/** 剧情卡结算（08527–08534）：读条目 flags.storyEffect，执行后加入胜利区。 */
export function resolveStory(state, code, inv, api = {}) {
  const card = storyCard(code)
  const effect = entryFlags(code)?.storyEffect || null
  const active = inv || state.investigators?.[leadSeat(state)] || state.investigators?.[0]
  const tekeliliCodes = RAW.tekeliliFaces
  const removeFrost = () => api.removeChaosToken?.('frost')
  const toBottom = codes => {
    for (const item of codes) {
      const index = (active?.deck || []).indexOf(item)
      if (index >= 0) {
        active.deck.splice(index, 1)
        // P2 忒咳哩-哩原语：把卡放回忒咳哩-哩牌库底（不暴露牌序）。
        try { tekeliReturn(state, item, { destination: 'bottom' }) } catch { /* 牌库未初始化时由战役层另接 */ }
      }
    }
  }
  switch (effect) {
    case 'removeFrost':
      removeFrost()
      api.info?.(`🧊 「${card.nameZh || code}」：从混乱袋移除 1 个 [frost] 标记。`)
      break
    case 'tekeliliToBottom': {
      const found = (active?.deck || []).find(item => tekeliliCodes.includes(item))
      if (found) toBottom([found])
      api.info?.(`🧊 「${card.nameZh || code}」：把牌库中的 1 张忒咳哩-哩放到忒咳哩-哩牌库底。`)
      break
    }
    case 'tekeliliTopNineToBottom': {
      const top = (active?.deck || []).slice(0, 9)
      const found = top.filter(item => tekeliliCodes.includes(item))
      toBottom(found)
      api.info?.(`🧊 「${card.nameZh || code}」：查看牌库顶 9 张，把 ${found.length} 张忒咳哩-哩放到牌库底。`)
      break
    }
    case 'discardNonEliteEidolon': {
      const candidates = (state.enemies || []).filter(enemy => {
        const traits = (ALL_CARDS[codeOf(enemy)]?.traits || []).map(item => String(item).toLowerCase())
        return traits.includes('eidolon') && !traits.includes('elite')
      })
      if (candidates.length) {
        const chosen = candidates[0]
        state.enemies = state.enemies.filter(enemy => enemy !== chosen)
        api.info?.(`🧊 「${card.nameZh || code}」：弃掉幻灵敌人「${chosen.name || codeOf(chosen)}」。`)
      }
      break
    }
    case 'possessedDoomToClues': {
      const candidates = (state.enemies || []).filter(enemy => {
        const traits = (ALL_CARDS[codeOf(enemy)]?.traits || []).map(item => String(item).toLowerCase())
        return traits.includes('possessed') && !traits.includes('elite')
      })
      const chosen = candidates[0]
      if (chosen) {
        const host = locationOf(state, chosen.location)
        if (host) host.clues = (host.clues || 0) + (chosen.doom || 0)
        chosen.doom = 0
        state.enemies = state.enemies.filter(enemy => enemy !== chosen)
        api.info?.(`🧊 「${card.nameZh || code}」：控制「${chosen.name || codeOf(chosen)}」的毁灭并弃掉它。`)
      }
      break
    }
    default:
      api.info?.(`「${card.nameZh || code}」结算。`)
  }
  state.victoryDisplay ||= []
  const addToVictory = entryFlags(code)?.storyAddToVictory !== false
  if (addToVictory && !state.victoryDisplay.some(entry => (entry.code || entry) === code)) {
    state.victoryDisplay.push({ code, name: card.nameZh || card.name || code })
  }
  return { code, effect, victory: entryFlags(code)?.storyVictory ?? card.victory ?? 0 }
}

/** 受附身队员被击败：在战报日志划掉其名字（状态标记 eliminated）。 */
export function enemyDefeated(state, enemy, api = {}) {
  const code = codeOf(enemy)
  const partner = partnerCodeOfEnemy(code)
  if (!partner) return false
  try {
    setPartnerStatus(state, partner, 'eliminated')
  } catch {
    recordsOf(state)[`crossedOut_${partner}`] = true
  }
  recordsOf(state)[`crossedOutPartner_${partner}`] = true
  api.info?.(`✖️ 划掉「${enemy.name || code}」的名字。`)
  return true
}

export function actObjectiveMet(state) {
  const investigators = state.investigators || []
  const active = activeInvestigators(state)
  const resigned = investigators.filter(inv => inv.resigned).length
  if (!active.length && resigned > 0) return { met: true, reason: 'allResigned' }
  return { met: false, reason: null }
}

/** 引擎读点（act-agenda.js#checkLinearAct）：目标达成即由引擎推进场景（actReveal 写结局 1）。 */
export function checkObjectives(state, api = {}) {
  if (!actObjectiveMet(state).met) return false
  api.advanceAct?.()
  return true
}

// [fast] 同地点共同花费 1[per_investigator] 线索：抽取该地点底下的一张遭遇卡；[action] 在营地撤退。
export function actions(state, inv) {
  const here = locationOf(state, inv?.location)
  if (!here) return []
  const active = activeInvestigators(state)
  const out = []
  if ((here.beneath || []).length) {
    const total = numInvestigators(state)
    const available = active.filter(other => other.location === here.id)
      .reduce((sum, other) => sum + (other.clues || 0), 0)
    out.push({
      action: 'scenarioAction', rule: 'drawUnderLocation', actions: 0,
      label: `🔍 抽取「${here.name || here.id}」底下的遭遇卡（共同花费 ${total} 线索）`,
      ...(available < total ? { reason: `线索不足：需要共同花费 ${total} 个线索（当前 ${available}）` } : {}),
    })
  }
  if (here.id === campIdOf(state)) {
    const allAtCamp = active.every(other => other.location === here.id)
    out.push({
      action: 'scenarioAction', rule: 'campResign', actions: 1, label: '⛺ 回到营地，撤退',
      ...(allAtCamp ? {} : { reason: '所有未被击败的调查员必须都在营地才能撤退' }),
    })
  }
  return out
}

export function performAction(state, inv, move, api = {}) {
  if (move?.rule === 'drawUnderLocation') {
    const here = locationOf(state, inv?.location)
    if (!here || !(here.beneath || []).length) return false
    const group = activeInvestigators(state).filter(other => other.location === here.id)
    const total = numInvestigators(state)
    const available = group.reduce((sum, other) => sum + (other.clues || 0), 0)
    if (available < total) {
      api.info?.(`线索不足：需要共同花费 ${total} 个线索。`)
      return false
    }
    let left = total
    for (const other of group) {
      const spend = Math.min(left, other.clues || 0)
      other.clues -= spend
      left -= spend
    }
    const code = here.beneath.shift()
    ;(here.beneathFaceDown ||= []).shift()
    if (isPossessedEnemy(code)) {
      // 被附身队员按真实生成管线入场（会挂上单卡条目的谈判描述子）。
      const card = ALL_CARDS[code] || {}
      if (typeof api.spawnEngaged === 'function') {
        api.spawnEngaged(code, here.id, inv.seat)
      } else if (typeof api.spawn === 'function') {
        api.spawn(code, here.id, { engagedSeat: inv.seat })
      } else {
        state.enemies ||= []
        state.enemies.push({
          id: `${code}-${state.enemies.length + 1}`, code, originalCode: code,
          name: card.nameZh || card.name || code, location: here.id, engagedSeat: inv.seat,
          exhausted: false, damageTaken: 0, fight: card.fight, evade: card.evade, health: card.health,
          damage: card.damage || 0, horror: card.horror || 0, traits: [...(card.traits || [])],
        })
      }
      api.info?.(`👹 「${card.nameZh || code}」被附身的队员出现。`)
    } else {
      resolveStory(state, code, inv, api)
    }
    return true
  }
  if (move?.rule === 'campResign') {
    const camp = campIdOf(state)
    if (inv?.location !== camp) {
      api.info?.('只有在营地才能撤退。')
      return false
    }
    const active = activeInvestigators(state)
    if (!active.every(other => other.location === camp)) {
      api.info?.('所有未被击败的调查员必须都在营地才能撤退。')
      return false
    }
    for (const other of active) other.resigned = true
    api.info?.('⛺ 调查员们回到营地，熬过寒夜。')
    return true
  }
  return false
}

/** 结局：把胜利区里的被附身队员对应伙伴标为 Safe，否则 Eliminated；写回已揭示地点。 */
export function scenarioResolution(state, key = 'resolution1', events = [], api = {}) {
  const records = recordsOf(state)
  const victoryCodes = new Set((state.victoryDisplay || []).flatMap(entry => [
    entry?.code, entry?.originalCode, typeof entry === 'string' ? entry : null,
  ].filter(Boolean)))
  const partnerResults = []
  for (const [asset, enemy] of POSSESSED_PARTNERS) {
    const partner = (() => { try { return partnerState(state, asset) } catch { return null } })()
    if (!partner || partner.status !== 'mia') continue
    const rescued = victoryCodes.has(enemy)
    const status = rescued ? 'safe' : 'eliminated'
    try { setPartnerStatus(state, asset, status) } catch { /* 未初始化名册时跳过 */ }
    records[`partnerResult${asset}`] = status
    partnerResults.push({ asset, enemy, status })
  }
  records.iceAndDeathPart2Resolution = key
  records.locationsRevealed = [...new Set([
    ...(revealedLocations(state) || []),
    ...((state.locations || []).filter(location => location.revealed === true).map(location => location.id)),
  ])]
  // 结算由引擎 finishScenario 驱动（本函数在 applyResolutionEffects 内执行；
  // 不能再调用 api.finish，否则会递归重入 finishScenario）。
  api.info?.(`📖 亡命冰原 II 结局：${key}；救回 ${partnerResults.filter(item => item.status === 'safe').length} 名队员。`)
  return { key, partnerResults, locationsRevealed: records.locationsRevealed }
}

export function canDiscoverClues() { return true }

export function afterTest(state, inv, result, api = {}) {
  if (!result || result.success) return []
  const failedBy = Math.max(0, Number(result.difficulty || 0) - Number(result.value || 0))
  const tokens = result.drawn || []
  const applied = []
  if (tokens.includes('cultist')) {
    const spec = part2ChaosFailureSpec(state, 'cultist', failedBy)
    if (spec) {
      const shuffled = tekeliShuffleIn(state, inv.seat, spec.count)
      const missing = spec.count - (shuffled ? Number(shuffled.length ?? spec.count) : 0)
      if (missing > 0) inv.horror = (inv.horror || 0) + missing
      applied.push({ token: 'cultist', count: spec.count })
    }
  }
  if (tokens.includes('tablet')) {
    const spec = part2ChaosFailureSpec(state, 'tablet', failedBy)
    // 真实 runtime 的「弃牌库顶」入口是 api.discardTop(seat, n)；弃到的弱点抽取回手牌。
    if (spec && typeof api.discardTop === 'function') {
      const discarded = api.discardTop(inv.seat, spec.count) || []
      for (const code of discarded) {
        if (!['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)) continue
        const index = (inv.discard || []).lastIndexOf(code)
        if (index < 0) continue
        inv.discard.splice(index, 1)
        api.putInHand?.(inv.seat, code)
      }
      applied.push({ token: 'tablet', count: spec.count, discarded })
    }
  }
  return applied
}

// 引擎读点：treachery-tokens.js#resolveSpecialToken → behavior.resolveChaosToken。
export function resolveChaosToken(state, inv, token) {
  return part2ChaosTokenValue(state, token, inv)
}

export const behavior = {
  id: CHAPTER_ID,
  preScenarioSetup() {},
  setupScenario,
  // 引擎真实路径：同 Part I，setupScenario 完成初始化后返回空数组，避免引擎重复放置地点。
  setupLocations(state, events, helper = {}) {
    setupScenario(state, { info: text => helper.info?.(state, events, text) })
    return []
  },
  setupEnemies() {},
  // 引擎读点：phases.js#runAgendaReveal / reveal.js#runActReveal。
  agendaReveal,
  actReveal,
  actObjectiveMet,
  checkObjectives,
  // 引擎读点：moves.js#legalMoves / dispatch.js#executeAction。
  actions,
  performAction,
  resolveStory,
  enemyDefeated,
  resolution: scenarioResolution,
  scenarioResolution,
  resolveChaosToken,
  canDiscoverClues,
  afterTest,
}

export const implementedEntryCodes = Object.freeze([
  '08523', '08524', '08525', '08526', '08527', '08528', '08529', '08530', '08531', '08532', '08533',
  '08534', '08535', '08536', '08537', '08538', '08539', '08540', '08541', '08542', '08543',
])
