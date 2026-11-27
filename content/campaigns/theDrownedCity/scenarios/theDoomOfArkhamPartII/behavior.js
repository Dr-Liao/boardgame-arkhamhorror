// 阿卡姆的毁灭 第二部分（theDoomOfArkhamPartII · 11688a）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheDoomOfArkhamPartII.hs +
//       .../TheDoomOfArkhamPartII/Helpers.hs（克苏鲁面板/怒气/牌库/废墟替换）+
//       Act|Agenda|Enemy|Location|Story|Treachery Cards/TheDrownedCity/TheDoomOfArkham/*.hs +
//       frontend/src/locales/en/theDrownedCity/theDoomOfArkhamPartII.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / introduction → 按战役记录选幕（反击！/放逐他！）、记录分支、怒气初值
//   setupLocations / afterDeckSetup → 午夜假面废墟地图 + 屋顶、克苏鲁面板（多部位敌人 linkEnemyParts）、
//     克苏鲁独立牌库（18 张 action 卡）、未划除神器、淹没街区继承、盟友
//   phaseBegan（神话阶段=敌军阶段结束）→ 议程强制：提高克苏鲁所在地点水位 + 抽克苏鲁牌
//   roundEnded → 议程「完全淹没 → 1 伤 1 恐」、幕目标（胜利区 3 名克苏鲁）、最终封印目标
//   actions / performAction → 最终封印「放置印记」
//   agendaReveal → 议程 11689 背面（废墟替换 / 7 废墟全灭 / 补线索 / 星之眷族回洗）、
//     特殊议程 11691b 背面（毁灭阈值推进 → 全灭；否则结局 2/3，含勘误）
//   actReveal → 反击！/放逐他！背面（克苏鲁部位回面板、怒气 +1、翻回 1a 或结局/最终封印）
//   enemyStatModifier → 克苏鲁部位战斗/躲避/生命 = 狂怒值
//   resolveChaosToken / applyTokenEffect → 11688a 四档混乱标记
//   resolution → 结局 1/2/3 与无结局（战役记录 + 创伤 + 经验）
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.campaign.records（纯 JSON）。
// 所有卡面细节的近似见 artifacts/migration/tdc/p7/workers/scenario-epsilon.md。
import { spliceHand } from '../../../../../src/engine/hand-icons.js'
import { ruinedLocationEnemyEntry } from './location-reactions.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  CHAPTER_ID, REFERENCE_CODE, ACT_FIGHT_BACK_CODE, ACT_BANISH_HIM_CODE, ACT_CODES,
  AGENDA_DOOM_CODE, AGENDA_DOOM_BACK_CODE, AGENDA_FINAL_SEAL_CODE, AGENDA_CODES,
  RESOLUTION_KEYS, CTHULHU_RAGE_MAX, CTHULHU_BANISH_RAGE_THRESHOLD, CTHULHU_FIGHT_BACK_RAGE_THRESHOLD,
  SIGIL_REQUIRED, RUINED_LOCATION_LIMIT, CTHULHU_BODY_CODE, CTHULHU_FACET_CODES, CTHULHU_FACET_PAIRS,
  CTHULHU_ENEMY_CODES, CTHULHU_STORY_CODES, CTHULHU_DECK_ID, CTHULHU_DECK, DEMOLITION_CODE,
  FIFTH_EYE_CODE, HOPE_FADES_CODE, TREACHERY_CODES, ALLY_CODES, IMPLEMENTED_ENTRY_CODES,
  RUINED_SWAP_CODES, SET_ASIDE_STAR_SPAWN_CODES, START_LOCATION, BASE_LOCATION_IDS,
  ROOFTOP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, LOCATION_VARIANTS, LOCATIONS,
  LOCATION_COORDINATES, LOCATION_CONNECTIONS, GATHER_GROUPS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  SET_ASIDE_CARDS, SCENARIO_TEXT, STAGE_CARDS, ACT_STAGES, AGENDA_STAGES, RUINED_TRAIT,
  ROOFTOP_TRAIT, NON_FULLY_FLOODABLE_IDS, UNFLOODABLE_IDS,
} from './definition.js'
import {
  cthulhuRage, setCthulhuRage, increaseCthulhuRage, skullValue, isHardSide, hasTrait, codeOf,
  doomOfArkhamPartTwoChaosToken, doomOfArkhamPartTwoChaosTokenValue, CHAOS_TOKEN_FACES,
  canDrawCthulhuFromToken, markCthulhuDrawnFromToken, fullyFloodedLocationIds,
} from './chaos.js'
import { STORY } from './story.js'
import { tdcCannotGainUpkeepResources } from '../../campaign-rules.js'

// ---------------------------------------------------------------------------
// 跨章规则：Good Money（11611）playBothSides 失败 → 下一章补给阶段不能获得资源。
// 读点：phases.js#201 的 scenarioBehavior(state).canGainResources（引擎补给阶段收入分支）。
// ---------------------------------------------------------------------------
export function canGainResources(state, inv) {
  return !tdcCannotGainUpkeepResources(state, inv)
}

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, message) => api?.info?.(message)
const clone = value => structuredClone(value)
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => {
  flagsFor(state)[key] = value
  return value
}
const randomValue = (api, fallback = 0.5) => {
  if (typeof api?.random === 'function') return Number(api.random())
  if (typeof api?.randomValue === 'function') return Number(api.randomValue())
  return fallback
}
const shuffleWith = (api, list) => (typeof api?.shuffle === 'function' ? api.shuffle([...list]) : [...list])
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const currentAct = state => (state?.acts || [])[state.actIndex ?? 0] || null
const currentActCode = state => codeOf(currentAct(state))
const currentAgenda = state => (state?.agendas || [])[state.agendaIndex ?? 0] || null
const currentAgendaCode = state => codeOf(currentAgenda(state))
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOfCode = code => entryOf(code)?.flags || {}
const leadSeat = state => Number(state?.currentSeat ?? state?.campaign?.leadSeat ?? 0)
const isRuined = location => hasTrait(ALL_CARDS[location?.originalCode || location?.code] || location, RUINED_TRAIT)
  || location?.ruined === true || flagsOfCode(location?.originalCode || location?.code).ruined === true
const isRooftop = location => hasTrait(ALL_CARDS[location?.originalCode || location?.code] || location, ROOFTOP_TRAIT)
  || flagsOfCode(location?.originalCode || location?.code).rooftop === true

// ---------------------------------------------------------------------------
// 淹没
// ---------------------------------------------------------------------------
export function floodLevelOf(state, locationId, api = {}) {
  if (api?.mechanics?.water?.level) return Number(api.mechanics.water.level(locationId)) || 0
  return Number(mechanicState(state)?.flood?.[locationId]) || 0
}
export function changeFloodLevel(state, locationId, delta, api = {}) {
  if (api?.mechanics?.water?.change) return api.mechanics.water.change(locationId, delta) !== false
  const data = mechanicState(state, true)
  data.flood ||= {}
  const before = Number(data.flood[locationId]) || 0
  const after = Math.max(0, Math.min(2, before + delta))
  data.flood[locationId] = after
  return after !== before
}
export function fullyFloodedIds(state, api = {}) {
  return fullyFloodedLocationIds(state, id => floodLevelOf(state, id, api))
}

// ---------------------------------------------------------------------------
// 克苏鲁面板 / 怒气
// ---------------------------------------------------------------------------
export function cthulhuLocationId(state) {
  const body = (state.enemies || []).find(enemy => codeOf(enemy) === CTHULHU_BODY_CODE)
  return body?.location || null
}
export function facetsInPlay(state) {
  return (state.enemies || []).filter(enemy => CTHULHU_ENEMY_CODES.includes(codeOf(enemy)))
}
export function cthulhuEnemiesInVictory(state) {
  return (state.victoryDisplay || []).filter(entry => CTHULHU_ENEMY_CODES.includes(String(entry?.originalCode || entry?.code)))
}
export function enragedFacets(state) {
  return facetsInPlay(state).filter(enemy => String(codeOf(enemy)).endsWith('b'))
}

/** 建立/重建 Cthulhu 主体与 3 张部位的链接（同地点、未交战）。 */
export function linkCthulhuParts(state, api = {}) {
  const body = (state.enemies || []).find(enemy => codeOf(enemy) === CTHULHU_BODY_CODE)
  if (!body) return false
  const parts = facetsInPlay(state).filter(enemy => enemy.id !== body.id)
  if (!parts.length) return false
  const link = api?.linkEnemyParts || api?.scenario?.linkEnemyParts
  if (typeof link === 'function') {
    const ok = link(body.id, parts.map(part => part.id))
    setFlag(state, 'cthulhuBoardLinked', ok !== false)
    return ok !== false
  }
  body.hasParts = true
  for (const part of parts) part.partOf = body.id
  setFlag(state, 'cthulhuBoardLinked', true)
  return true
}

/** 「将胜利区的每名[[克苏鲁]]敌人以非狂怒面放回克苏鲁面板原位」。 */
export function returnCthulhuFacetsToBoard(state, api = {}, { enraged = false } = {}) {
  const location = cthulhuLocationId(state) || START_LOCATION
  const inVictory = new Set(cthulhuEnemiesInVictory(state).map(entry => String(entry.code).slice(0, 5)))
  state.victoryDisplay = (state.victoryDisplay || []).filter(entry => !CTHULHU_ENEMY_CODES.includes(String(entry?.originalCode || entry?.code)))
  for (const [frontCode, enragedCode] of CTHULHU_FACET_PAIRS) {
    const inPlay = facetsInPlay(state).some(enemy => [frontCode, enragedCode].includes(codeOf(enemy)))
    if (inPlay || !inVictory.has(frontCode)) continue
    const code = enraged ? enragedCode : frontCode
    if (typeof api.spawn === 'function') api.spawn(code, location, { ignoreSpawn: true })
  }
  // 场上部位按需翻至狂怒面（忽略其强制效果）。
  if (enraged) {
    for (const enemy of facetsInPlay(state)) {
      const code = codeOf(enemy)
      if (String(code).endsWith('b')) continue
      const pair = CTHULHU_FACET_PAIRS.find(([front]) => front === code)
      if (pair && typeof api.flipEnemy === 'function') api.flipEnemy(enemy, pair[1])
    }
  }
  linkCthulhuParts(state, api)
  info(api, `克苏鲁面板：胜利区部位回到面板${enraged ? '（狂怒面）' : '（非狂怒面）'}。`)
  return true
}

/** Setup：克苏鲁本体 + 3 部位在 Rivertown (Ruined) 生成并链接。 */
export function setupCthulhuBoard(state, api = {}) {
  const location = START_LOCATION
  const spawn = typeof api.spawn === 'function'
    ? (code) => api.spawn(code, location, { ignoreSpawn: true, exhausted: false })
    : () => null
  spawn(CTHULHU_BODY_CODE)
  for (const code of CTHULHU_FACET_CODES) spawn(code)
  return linkCthulhuParts(state, api)
}

// ---------------------------------------------------------------------------
// 克苏鲁独立牌库（18 张 action 卡：从底/顶抽、弃回、每轮上限）
// ---------------------------------------------------------------------------
function cthulhuPiles(state) {
  const decks = mechanicState(state)?.scenarioDecks
  return decks?.[CTHULHU_DECK_ID] || null
}
export function cthulhuDeckSize(state) {
  return cthulhuPiles(state)?.deck.length || 0
}
export function cthulhuDeckDiscard(state) {
  return [...(cthulhuPiles(state)?.discard || [])]
}
/** 空库时把弃牌堆洗回（规则：牌库为空立即洗回）。 */
export function recycleCthulhuDeck(state, api = {}) {
  const piles = cthulhuPiles(state)
  if (!piles || piles.deck.length || !piles.discard.length) return false
  const deck = typeof api.mechanics?.scenarioDecks?.put === 'function' ? api.mechanics.scenarioDecks : null
  if (deck) deck.put(CTHULHU_DECK_ID, piles.discard, { shuffle: true })
  else piles.deck = shuffleWith(api, piles.discard)
  piles.discard = []
  return true
}
/** 抽克苏鲁牌库顶 1 张（受信任返回；观察者只见张数）。 */
export function takeCthulhuTop(state, api = {}) {
  recycleCthulhuDeck(state, api)
  const piles = cthulhuPiles(state)
  if (!piles) return null
  return piles.deck.pop() || null
}
/** 把已结算的 action 卡弃回克苏鲁弃牌堆（牌库空时回收）。 */
export function discardCthulhuCard(state, code, api = {}) {
  if (typeof api.mechanics?.scenarioDecks?.discard === 'function') {
    api.mechanics.scenarioDecks.discard(CTHULHU_DECK_ID, code, { recycleWhenEmpty: true })
    return true
  }
  const piles = cthulhuPiles(state)
  if (!piles) return false
  piles.discard.push(code)
  return true
}

/** 抽 1 张并结算：返回抽到的卡号（tests 用它断言牌库守恒）。 */
export function drawCthulhuCard(state, seat, api = {}, { source = 'agenda' } = {}) {
  const code = takeCthulhuTop(state, api)
  if (!code) return null
  const result = resolveCthulhuCard(state, code, api)
  if (result !== 'retained') discardCthulhuCard(state, code, api)
  info(api, `克苏鲁牌库：抽取「${ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code}」（${source}）。`)
  return code
}

/** 克苏鲁牌库行动卡效果（11705–11715）。返回 'retained' 表示该卡留在场上/洗回，不走弃牌。 */
export function resolveCthulhuCard(state, code, api = {}) {
  const cthulhuAt = cthulhuLocationId(state)
  const here = activeInvestigators(state).filter(inv => inv.location === cthulhuAt)
  const rage = cthulhuRage(state)
  const facetInPlay = codeOfCode => facetsInPlay(state).some(enemy => codeOf(enemy) === codeOfCode)
  const attackByFacet = (facetCode, inv) => {
    const enemy = facetsInPlay(state).find(item => codeOf(item) === facetCode)
    if (!enemy || !inv) return false
    if (typeof api.attack !== 'function') return false
    api.attack(enemy, inv)
    return true
  }
  const hurt = (inv, kind = 'damage') => {
    if (!inv) return
    if (typeof api[kind] === 'function') api[kind](inv.seat, 1)
    else inv[kind] = (Number(inv[kind]) || 0) + 1
  }
  const randomDiscard = (inv, count = 1) => {
    if (!inv) return 0
    if (typeof api.discardRandom === 'function') return api.discardRandom(inv.seat, count)
    const lost = Math.min(count, (inv.hand || []).length)
    spliceHand(inv, Math.max(0, inv.hand.length - lost), lost)
    return lost
  }
  // 「弃掉其控制的一张非剧情支援」：优先 api.discardAsset，缺失时回退为资产区移除 + 进弃牌堆。
  const discardAssetById = (inv, assetId) => {
    if (!inv || !assetId) return false
    if (typeof api.discardAsset === 'function' && api.discardAsset(inv.seat, assetId)) return true
    const index = (inv.assets || []).findIndex(asset => asset.id === assetId)
    if (index < 0) return false
    const [asset] = inv.assets.splice(index, 1)
    ;(inv.discard ||= []).push(asset.code)
    return true
  }
  // 在「受伤/受恐」与「弃一张自己控制的资产」之间选择。
  const chooseHarmOrAsset = (inv, source, prompt, harmKind = 'damage') => {
    if (!inv) return false
    const assets = inv.assets || []
    const options = [
      { id: harmKind, label: harmKind === 'horror' ? '受到 1 点恐惧' : '受到 1 点伤害' },
      ...assets.map(asset => ({
        id: `asset:${asset.id}`,
        label: `弃掉「${ALL_CARDS[codeOf(asset)]?.nameZh || codeOf(asset)}」`,
      })),
    ]
    const choice = typeof api.choose === 'function'
      ? String(api.choose({ kind: 'effect', source, seat: inv.seat, prompt, options }))
      : harmKind
    if (choice.startsWith('asset:')) return discardAssetById(inv, choice.slice(6))
    hurt(inv, harmKind)
    return true
  }
  const testFor = (inv, skills, resolve) => {
    if (!inv) return null
    if (typeof api.test === 'function') return api.test(inv.seat, skills, rage, resolve)
    resolve?.({ success: false, failedBy: 1, value: 0 })
    return null
  }
  const highest = skill => [...here].sort((a, b) => (Number(b[skill]) || 0) - (Number(a[skill]) || 0))[0] || null
  // 部分卡面只说「[技能]最高的调查员」（不限克苏鲁所在地点）。
  const highestAny = skill => [...activeInvestigators(state)]
    .sort((a, b) => (Number(b[skill]) || 0) - (Number(a[skill]) || 0))[0] || null

  switch (code) {
    case '11705': { // 无情冲锋
      if (facetInPlay('11702')) for (const inv of here) randomDiscard(inv, 1)
      if (facetInPlay('11703')) {
        const target = highest('willpower')
        // 凶恶面容：攻击克苏鲁地点意志最高者；若没有进行攻击，该调查员抽遭遇牌库顶，
        // 且该卡效果不能取消、失去涌动（drawEncounter 的 cannotCancel / suppressSurge 读点）。
        if (!attackByFacet('11703', target) && target) {
          if (typeof api.drawEncounter === 'function') api.drawEncounter(target.seat, { cannotCancel: true, suppressSurge: true })
        }
      }
      if (facetInPlay('11704')) {
        const target = highest('combat')
        testFor(target, 'combat', result => { if (result?.success !== true) attackByFacet('11704', target) })
      }
      return 'resolved'
    }
    case '11706': { // 飓风之力
      if (facetInPlay('11702')) {
        // 额外结算一次克苏鲁的巡逻关键词（与敌人阶段同一个 patrolMove 实现，成功移动记录 lastPatrolRound）。
        const body = (state.enemies || []).find(enemy => codeOf(enemy) === CTHULHU_BODY_CODE)
        if (body && typeof api.runEnemyPatrol === 'function') api.runEnemyPatrol(body)
      }
      if (facetInPlay('11703')) {
        const target = nearestInvestigatorToCthulhu(state)
        testFor(target, 'willpower', result => { if (result?.success !== true) attackByFacet('11703', target) })
      }
      if (facetInPlay('11704')) {
        const target = here[0] || activeInvestigators(state)[0]
        testFor(target, 'agility', result => {
          if (result?.success === true) return
          // 失败：必须提高克苏鲁所在地点的淹没等级，或受到 1 点伤害或 1 点恐惧（调查员选择）。
          const canFlood = Boolean(cthulhuAt) && !NON_FULLY_FLOODABLE_IDS.includes(cthulhuAt)
            && floodLevelOf(state, cthulhuAt, api) < 2
          const options = [
            ...(canFlood ? [{ id: 'flood', label: '提高克苏鲁所在地点的淹没等级' }] : []),
            { id: 'damage', label: '受到 1 点伤害' },
            { id: 'horror', label: '受到 1 点恐惧' },
          ]
          const choice = typeof api.choose === 'function'
            ? String(api.choose({ kind: 'effect', source: '11706', seat: target?.seat, prompt: '飓风之力：选择一项', options }))
            : 'damage'
          if (choice === 'flood' && changeFloodLevel(state, cthulhuAt, 1, api)) return
          hurt(target, choice === 'horror' ? 'horror' : 'damage')
        })
      }
      return 'resolved'
    }
    case '11707': { // 凶险狂风
      if (facetInPlay('11702')) {
        for (const inv of here) randomDiscard(inv, 1)
        // 额外结算一次巡逻（与敌人阶段同一 patrolMove 实现）。
        const body = (state.enemies || []).find(enemy => codeOf(enemy) === CTHULHU_BODY_CODE)
        if (body && typeof api.runEnemyPatrol === 'function') api.runEnemyPatrol(body)
      }
      if (facetInPlay('11703')) {
        const target = highestAny('willpower')
        testFor(target, 'willpower', result => {
          if (result?.success === true) return
          // 失败：必须受到 1 点恐惧，或选择并弃掉其控制的一张（非剧情）支援。
          chooseHarmOrAsset(target, '11707', '凶险狂风：选择一项', 'horror')
        })
      }
      // 「如果克苏鲁本轮未以其巡逻关键词移动」：只读 enemy.lastPatrolRound（引擎 patrolMove 成功时写入）。
      const bodyNow = (state.enemies || []).find(enemy => codeOf(enemy) === CTHULHU_BODY_CODE)
      const patrolledThisRound = bodyNow?.lastPatrolRound === state.round
      if (facetInPlay('11704') && !patrolledThisRound) {
        for (const inv of here) attackByFacet('11704', inv)
      }
      return 'resolved'
    }
    case '11708': { // 恐惧凝视
      if (facetInPlay('11702')) {
        const target = highestAny('agility')
        testFor(target, 'agility', result => {
          if (result?.success === true) return
          const choice = typeof api.choose === 'function'
            ? String(api.choose({
              kind: 'effect', source: '11708', seat: target?.seat,
              prompt: '恐惧凝视：选择受到 1 点伤害或 1 点恐惧',
              options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
            }))
            : 'damage'
          hurt(target, choice === 'horror' ? 'horror' : 'damage')
        })
      }
      if (facetInPlay('11703')) for (const inv of here) { inv.resources = Math.max(0, (Number(inv.resources) || 0) - 2) }
      if (facetInPlay('11704')) {
        const choice = typeof api.choose === 'function'
          ? api.choose({
            kind: 'effect', source: '11708', seat: leadSeat(state), prompt: '恐惧凝视：调查员共同决定',
            options: [
              { id: 'action', label: '每位调查员下个回合失去 1 次行动' },
              { id: 'attack', label: '邪恶利爪攻击其所在地点每位调查员' },
              { id: 'horror', label: '每位调查员受到 1 点直接恐惧' },
            ],
          })
          : 'horror'
        if (choice === 'attack') for (const inv of here) attackByFacet('11704', inv)
        else if (choice === 'action') {
          // 引擎读点：api.loseActions（调查阶段外排队为 pendingActionLoss，下个回合行动数 -1）。
          for (const inv of activeInvestigators(state)) {
            if (typeof api.loseActions === 'function') api.loseActions(inv.seat, 1)
            else setFlag(state, 'cthulhuLostActionNextRound', true)
          }
        } else for (const inv of activeInvestigators(state)) {
          // 「直接恐惧」不吃支援伤害分配（引擎读点 api.directHorror）。
          if (typeof api.directHorror === 'function') api.directHorror(inv.seat, 1)
          else hurt(inv, 'horror')
        }
      }
      return 'resolved'
    }
    case DEMOLITION_CODE: { // 拆毁
      const rooftop = nearestRooftopFor(state, cthulhuAt, api)
      if (!rooftop) return 'resolved'
      const ruins = (flagsFor(state).demolitionRuins ||= {})
      // 「作为废墟标记」：实体计数器落在最近屋顶实例上（scenarioRuntime 的 api.addCardCounter/cardCounterOf，
      // 'ruin' 已在 CARD_COUNTER_IDS 白名单）。
      const current = Number(api.cardCounterOf?.(rooftop, 'ruin')) || 0
      const before = Math.max(Number(ruins[rooftop.id]) || 0, current)
      let counter = 0
      if (typeof api.addCardCounter === 'function') {
        api.addCardCounter(rooftop, 'ruin', before - current + 1, { source: DEMOLITION_CODE })
        counter = Number(api.cardCounterOf?.(rooftop, 'ruin')) || 0
      }
      ruins[rooftop.id] = Math.max(before + 1, counter)
      info(api, `拆毁：在「${rooftop.name}」放置 1 个废墟标记（${ruins[rooftop.id]}）。`)
      if (Number(ruins[rooftop.id]) >= 2) {
        for (const inv of activeInvestigators(state).filter(inv => inv.location === rooftop.id)) {
          if (api.defeat) api.defeat(inv, 'killed')
          else { inv.defeated = true; inv.defeatCause = 'killed' }
        }
        if (api.removeLocationFromGame) {
          api.removeLocationFromGame(rooftop.id, { discardPlayerAttachments: true })
        } else {
          state.enemies = (state.enemies || []).filter(enemy => enemy.location !== rooftop.id)
          state.locations = (state.locations || []).filter(location => location.id !== rooftop.id)
          removeLocationFromAll(state, rooftop.id)
        }
        const piles = cthulhuPiles(state)
        if (piles) (piles.removed ||= []).push(code)
        flagsFor(state).demolitionRemoved = [...(flagsFor(state).demolitionRemoved || []), rooftop.id, DEMOLITION_CODE]
        info(api, `拆毁：屋顶废墟标记达到 2 个，屋顶与「拆毁」离场。`)
        if (!activeInvestigators(state).length) api.finish?.('noResolution')
        return 'retained'
      }
      // 与克苏鲁弃牌堆一起洗回牌库。
      const piles = cthulhuPiles(state)
      if (!piles) return 'resolved'
      const recycled = [code, ...piles.discard.splice(0)]
      if (api.mechanics?.scenarioDecks?.put) api.mechanics.scenarioDecks.put(CTHULHU_DECK_ID, recycled, { shuffle: true })
      else piles.deck = shuffleWith(api, [...piles.deck, ...recycled])
      return 'retained'
    }
    case FIFTH_EYE_CODE: { // 第五只眼
      state.storyAssets ||= []
      state.storyAssets.push({ id: `cthulhuStory:${code}`, code, originalCode: code, location: null, nextToAgenda: true })
      info(api, '第五只眼：放在密谋牌库旁（调查阶段结束时在克苏鲁面板敌人上放毁灭并弃掉本卡）。')
      return 'retained'
    }
    case '11711': { // 地震踩踏
      if (!here.length) { drawCthulhuCard(state, leadSeat(state), api, { source: '地震踩踏' }); return 'resolved' }
      for (const inv of here) testFor(inv, 'agility', result => {
        if (result?.success === true) return
        // 失败：受到 1 点伤害/恐惧，或随机弃掉手牌中的 1 张卡牌（调查员选择）。
        const options = [
          { id: 'damage', label: '受到 1 点伤害' },
          { id: 'horror', label: '受到 1 点恐惧' },
          { id: 'discard', label: '随机弃掉手牌中的 1 张卡牌' },
        ]
        const choice = typeof api.choose === 'function'
          ? String(api.choose({ kind: 'effect', source: '11711', seat: inv.seat, prompt: '地震踩踏：选择一项', options }))
          : 'damage'
        if (choice === 'discard') randomDiscard(inv, 1)
        else hurt(inv, choice === 'horror' ? 'horror' : 'damage')
      })
      return 'resolved'
    }
    case '11712': { // 异界呼唤
      if (!here.length) { drawCthulhuCard(state, leadSeat(state), api, { source: '异界呼唤' }); return 'resolved' }
      let anyFailed = false
      for (const inv of here) testFor(inv, 'willpower', result => { if (result?.success !== true) anyFailed = true })
      if (anyFailed) {
        const enemyCode = discardUntilEnemy(state, api)
        if (enemyCode && typeof api.spawn === 'function') api.spawn(enemyCode, cthulhuAt, { ignoreSpawn: true })
      }
      return 'resolved'
    }
    case '11713': { // 灵能斥责
      const inVictory = cthulhuEnemiesInVictory(state)
      if (!inVictory.length) { drawCthulhuCard(state, leadSeat(state), api, { source: '灵能斥责' }); return 'resolved' }
      const candidates = activeInvestigators(state)
      const pickInvestigator = candidates.length <= 1 || typeof api.choose !== 'function' ? candidates[0] : candidates[Number(api.choose({
        kind: 'investigator', source: '11713', seat: leadSeat(state),
        prompt: '灵能斥责：选择一位调查员进行检定',
        options: candidates.map((inv, index) => ({ id: String(index), label: inv.name })),
      })) || 0] || candidates[0]
      testFor(pickInvestigator, 'willpower', result => {
        if (result?.success === true) return
        const pickEnemy = inVictory.length === 1 || typeof api.choose !== 'function' ? inVictory[0] : inVictory[Number(api.choose({
          kind: 'enemy', source: '11713', seat: leadSeat(state),
          prompt: '灵能斥责：选择胜利区一名[[克苏鲁]]敌人放回面板',
          options: inVictory.map((entry, index) => ({ id: String(index), label: ALL_CARDS[entry.code]?.nameZh || entry.code })),
        })) || 0] || inVictory[0]
        if (!pickEnemy) return
        state.victoryDisplay = state.victoryDisplay.filter(item => item !== pickEnemy)
        const front = String(pickEnemy.code).slice(0, 5)
        const enragedCode = `${front}b`
        if (typeof api.spawn === 'function') api.spawn(enragedCode, cthulhuAt || START_LOCATION, { ignoreSpawn: true })
        linkCthulhuParts(state, api)
      })
      return 'resolved'
    }
    case '11714': { // 涨潮
      if (cthulhuAt) changeFloodLevel(state, cthulhuAt, -1, api)
      const fullyFlooded = new Set(fullyFloodedIds(state, api))
      const candidates = (state.locations || []).filter(location => location.id !== cthulhuAt)
      const withInvestigators = candidates.filter(location => activeInvestigators(state)
        .some(inv => inv.location === location.id))
      // 印刷「另一处可提高淹没等级地点（尽可能有调查员）」：优先有调查员的地点作为候选池。
      const pool = withInvestigators.length ? withInvestigators : candidates
      const chosen = pool.length <= 1 || typeof api.choose !== 'function' ? pool[0] : pool[Number(api.choose({
        kind: 'location', source: '11714', seat: leadSeat(state),
        prompt: '涨潮：选择一处提高淹没等级的地点',
        options: pool.map((location, index) => ({ id: String(index), label: `${location.name}${fullyFlooded.has(location.id) ? '（已完全淹没）' : ''}` })),
      })) || 0] || pool[0]
      if (chosen) changeFloodLevel(state, chosen.id, 1, api)
      for (const inv of activeInvestigators(state)) {
        if (!fullyFloodedIds(state, api).includes(inv.location)) continue
        testFor(inv, 'agility', result => {
          if (result?.success === true) return
          // 失败：受到 1 点伤害，或弃掉其控制的一张（非剧情）支援。
          chooseHarmOrAsset(inv, '11714', '涨潮：选择一项', 'damage')
        })
      }
      return 'resolved'
    }
    case HOPE_FADES_CODE: { // 希望消逝
      // 放在密谋牌库旁：优先 api.attachToAgenda（引擎读点），否则退回剧情资产区。
      const attach = api.attachToAgenda || api.scenario?.attachToAgenda
      const attached = typeof attach === 'function' ? attach(HOPE_FADES_CODE, { sealsElderSign: true }) : null
      if (!attached) {
        state.storyAssets ||= []
        state.storyAssets.push({ id: `cthulhuStory:${code}`, code, originalCode: code, location: null, nextToAgenda: true, sealsElderSign: true })
      }
      const instance = attached
        || (state.storyAssets || []).find(asset => codeOf(asset) === HOPE_FADES_CODE)
      if (instance?.id) setFlag(state, 'hopeFadesCardId', instance.id)
      // 先找 [elder_sign]；若没有（或被封印）则取混乱袋中「最高正数数值标记」。
      const token = selectHopeFadesSealToken(state)
      let sealed = null
      if (token != null && instance && typeof api.sealChaosTokenFromBag === 'function') {
        sealed = api.sealChaosTokenFromBag(token, instance)
        // 卡面显示用：把封印标记记在卡实例上（引擎封印区以 card.id 为 source）。
        if (sealed != null) {
          instance.sealedToken = sealed
          instance.sealedTokens = [sealed]
        }
      }
      setFlag(state, 'hopeFadesInPlay', true)
      if (token == null) info(api, '希望消逝：放在密谋牌库旁（混乱袋里没有 [elder_sign] 或正数数值标记可封印）。')
      else if (sealed != null) info(api, `希望消逝：放在密谋牌库旁，封印「${token}」标记。`)
      else info(api, `希望消逝：放在密谋牌库旁（混乱袋里没有可封印的标记）。`)
      return 'retained'
    }
    default:
      return 'resolved'
  }
}

/** 11715：先找 [elder_sign]；没有（或被封印）时取混乱袋中「最高正数数值标记」。 */
export function selectHopeFadesSealToken(state) {
  const bag = Array.isArray(state?.chaosBag) ? state.chaosBag : []
  const elderSign = bag.find(token => /elder/i.test(String(token)))
  if (elderSign != null) return elderSign
  let best = null
  let bestValue = -Infinity
  for (const token of bag) {
    const match = /^\+?(\d+)$/.exec(String(token).trim())
    if (!match) continue
    const value = Number(match[1])
    if (value > bestValue) { bestValue = value; best = token }
  }
  return best
}
/**
 * 希望消逝离场（幕推进）：弃掉卡/悬挂的附件并释放封印标记。
 * 读点：api.detachEncounterAttachmentById + api.releaseSealedToken(card, token)（scenarioRuntime 直接暴露）。
 */
export function discardHopeFadesCard(state, api = {}) {
  const cardId = flagsFor(state).hopeFadesCardId
  const pendingToken = flagsFor(state).hopeFadesSealedTokenPending
  // 找附件实例（议程附属或剧情资产区），释放封印需要 card 对象。
  const pools = [
    ...(state.agendas || []).flatMap(agenda => agenda.attachments || []),
    ...(state.storyAssets || []),
  ]
  const instance = pools.find(card => card?.id === cardId) || (cardId ? { id: cardId } : null)
  const token = instance?.sealedToken ?? pendingToken ?? '0'
  if (instance && typeof api.releaseSealedToken === 'function') api.releaseSealedToken(instance, token)
  if (cardId && typeof api.detachEncounterAttachmentById === 'function') api.detachEncounterAttachmentById(cardId)
  else {
    for (const agenda of state.agendas || []) {
      agenda.attachments = (agenda.attachments || []).filter(asset => (asset?.id || asset) !== cardId)
    }
  }
  state.storyAssets = (state.storyAssets || []).filter(asset => codeOf(asset) !== HOPE_FADES_CODE)
  delete flagsFor(state).hopeFadesCardId
  delete flagsFor(state).hopeFadesSealedTokenPending
  setFlag(state, 'hopeFadesInPlay', false)
}

function nearestInvestigatorToCthulhu(state) {
  const cthulhuAt = cthulhuLocationId(state)
  return activeInvestigators(state).find(inv => inv.location === cthulhuAt) || activeInvestigators(state)[0] || null
}
/** 拆毁用：优先经 api.mechanics.map.nearest 取最近屋顶，缺失时回退固定顺序。 */
function nearestRooftopFor(state, fromId, api = {}) {
  const rooftops = (state.locations || []).filter(location => ROOFTOP_LOCATION_IDS.includes(location.id))
  if (!rooftops.length) return null
  if (!fromId) return rooftops[0]
  if (typeof api?.mechanics?.map?.nearest === 'function') {
    const eligible = new Set(rooftops.map(location => location.id))
    const nearest = api.mechanics.map.nearest(fromId, id => eligible.has(id))
    if (nearest?.length) {
      const options = rooftops.filter(location => nearest.includes(location.id)).map(location => ({ id: location.id, label: location.name }))
      const id = options.length > 1 ? api.choose?.({ kind: 'location', seat: state.campaign?.leadSeat ?? leadSeat(state),
        source: DEMOLITION_CODE, prompt: '选择同样最近的一处屋顶', options }) : options[0]?.id
      return rooftops.find(location => location.id === (id ?? nearest[0])) || rooftops[0]
    }
  }
  return rooftops[0]
}
function removeLocationFromAll(state, locationId) {
  for (const inv of state.investigators || []) if (inv.location === locationId) inv.location = START_LOCATION
  for (const enemy of state.enemies || []) if (enemy.location === locationId) enemy.location = START_LOCATION
}
function discardUntilEnemy(state, api = {}) {
  let code = null
  while ((state.encounterDeck || []).length) {
    const next = state.encounterDeck.pop()
    const card = ALL_CARDS[next]
    if (card?.type === 'enemy') { code = next; break }
    ;(state.encounterDiscard ||= []).push(next)
  }
  void api
  return code
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function battleBranch(state) {
  const records = recordsFor(state)
  if (records.theInvestigatorsStoodTogether) return 'standTogether'
  if (records.yourAlliesHaveAPlan) return 'alliesPlan'
  return null
}

export function uncrossedArtifacts(state) {
  const artifacts = Object.freeze({
    barrierNode: '11552', obsidianClaw: '11672a', shardOfYchlecht: '11638',
    tidalTablet: '11611', grislyMask: '11582', horrorInClay: '11688',
  })
  const records = recordsFor(state)
  return Object.entries(artifacts).filter(([key]) => records[key] === true).map(([, code]) => code)
}

export function prepareScenario(state, api = {}) {
  if (state.scenarioFlags?.doomArkhamPartTwoPrepared) return state.scenarioFlags.doomArkhamPartTwoReport
  const branch = battleBranch(state) || 'standTogether'
  const pick = list => list[Math.min(list.length - 1, Math.floor(randomValue(api) * list.length))]
  const variants = {
    downtown: pick(LOCATION_VARIANTS.downtown),
    southside: pick(LOCATION_VARIANTS.southside),
  }
  const actCode = branch === 'standTogether' ? ACT_FIGHT_BACK_CODE : ACT_BANISH_HIM_CODE
  const act = clone((state.scenario?.stageCards || STAGE_CARDS)[actCode])
  const agenda = clone((state.scenario?.stageCards || STAGE_CARDS)[AGENDA_DOOM_CODE])
  state.acts = [act]
  state.agendas = [agenda]
  state.actIndex = 0
  state.agendaIndex = 0
  setCthulhuRage(state, investigatorCount(state) <= 2 ? 2 : 1)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_CARDS]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  if (branch === 'alliesPlan') {
    state.scenarioZones.setAside.push(AGENDA_FINAL_SEAL_CODE)
    state.scenarioZones.setAside.push(...ALLY_CODES)
  }
  const report = {
    branch, actCode, agendaCodes: [AGENDA_DOOM_CODE], variants,
    initialRage: cthulhuRage(state), artifacts: uncrossedArtifacts(state),
    floodedNeighborhoods: [...(recordsFor(state).floodedNeighborhoods || [])],
  }
  setFlag(state, 'doomArkhamPartTwoReport', report)
  setFlag(state, 'doomArkhamPartTwoPrepared', true)
  info(api, `阿卡姆的毁灭 II：${branch === 'standTogether' ? '反击！' : '放逐他！'}；`
    + `克苏鲁狂怒 ${report.initialRage}；未划除神器 ${report.artifacts.length} 张。`)
  return report
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  const records = recordsFor(state)
  let branch = battleBranch(state)
  if (!branch) {
    // 参考实现：调查员选择「坚守阵地 / 另有他法」；另有他法需要 ≥5 张未划除神器。
    const canRitual = uncrossedArtifacts(state).length >= 5
    const choice = typeof api.choose === 'function'
      ? api.choose({
        kind: 'effect', source: REFERENCE_CODE, seat: leadSeat(state),
        prompt: '调查员必须决定：坚守阵地还是另有他法？',
        options: [
          { id: 'standTogether', label: '“我们需要坚守阵地，用火力把他赶走。”' },
          ...(canRitual ? [{ id: 'alliesPlan', label: '“一定还有别的办法。”' }] : []),
        ],
      })
      : 'standTogether'
    branch = choice === 'alliesPlan' && canRitual ? 'alliesPlan' : 'standTogether'
    if (branch === 'standTogether') records.theInvestigatorsStoodTogether = true
    else records.yourAlliesHaveAPlan = true
  }
  const report = prepareScenario(state, api)
  return { ...report, branch, introText: SCENARIO_TEXT.intro }
}

/** 当前使用的地图地点 id（商业区/南区使用固定 id，卡号由 Setup 随机选定）。 */
export function placedLocationIds(state) {
  void state
  return [...BASE_LOCATION_IDS, 'rivertownRuined', ...ROOFTOP_LOCATION_IDS]
}

export function placeLocationAt(state, locationId, cell, api = {}, { revealed = null } = {}) {
  if (locationOf(state, locationId)) return locationOf(state, locationId)
  const base = (state.scenario?.locations || LOCATIONS)[locationId]
  if (!base) return null
  const report = state.scenarioFlags?.doomArkhamPartTwoReport
  const variantCode = locationId === 'downtown' ? report?.variants?.downtown
    : locationId === 'southside' ? report?.variants?.southside : null
  const code = variantCode || base.code
  const card = ALL_CARDS[code] || {}
  const clues = base.cluesPerInvestigator != null
    ? base.cluesPerInvestigator * investigatorCount(state)
    : (base.cluesFixed ?? Number(card.clues) ?? base.clues ?? 1)
  const shouldReveal = revealed == null ? true : revealed
  const location = {
    ...clone(base), id: locationId, code, originalCode: code,
    name: card.nameZh || base.name,
    shroud: Number(card.shroud) || base.shroud,
    ...(card.victory ? { victory: card.victory } : {}),
    revealed: shouldReveal,
    clues: shouldReveal ? clues : 0, maxClues: clues,
    connections: [...(base.connections || [])],
  }
  state.locations ||= []
  state.locations.push(location)
  if (cell) {
    const data = mechanicState(state, true)
    data.grid ||= {}
    data.grid[locationId] = { x: cell.x, y: cell.y, isolated: false, connections: [] }
  }
  info(api, `📍 「${location.name}」进入游戏。`)
  return location
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  const ids = placedLocationIds(state)
  for (const id of ids) placeLocationAt(state, id, LOCATION_COORDINATES[id], api, { revealed: true })
  return ids
}
export function setupEnemies() {
  // 克苏鲁面板在 afterDeckSetup 生成并链接（需要运行时 api.linkEnemyParts）。
}
export function modifyDeck(state, deck) {
  return deck
}

/** 胜负/毁灭记录辅助：把 Part I 记录的淹没街区继承到本关。 */
export function inheritFloodedNeighborhoods(state, api = {}) {
  const records = recordsFor(state)
  const codes = Array.isArray(records.floodedNeighborhoods) ? records.floodedNeighborhoods : []
  const flooded = []
  for (const code of codes) {
    const name = ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || ''
    const location = (state.locations || []).find(item => String(item.originalCode || item.code) === String(code))
      || (state.locations || []).find(item => item.name === name)
    if (!location) continue
    changeFloodLevel(state, location.id, 1, api)
    flooded.push(location.id)
  }
  setFlag(state, 'inheritedFloodedNeighborhoods', flooded)
  info(api, `继承「淹没街区」：${flooded.length} 处地点提高淹没等级。`)
  return flooded
}

export function putAlliesIntoPlay(state, api = {}) {
  const investigators = activeInvestigators(state)
  const placed = []
  const remaining = [...ALLY_CODES]
  // 印刷：按玩家顺序，每名调查员**可选**控制 1 张放在一边的盟友剧情支援（不占盟友槽）。
  for (const inv of investigators) {
    if (!remaining.length) break
    let chosen = remaining[0]
    if (typeof api.choose === 'function') {
      const answer = String(api.choose({
        kind: 'effect', source: currentActCode(state), seat: inv.seat,
        prompt: `${inv.name}：可控制 1 张放在一边的盟友剧情支援（可选）`,
        options: [
          { id: 'skip', label: '不控制' },
          ...remaining.map((code, index) => ({ id: String(index), label: ALL_CARDS[code]?.nameZh || code })),
        ],
      }))
      if (answer === 'skip') chosen = null
      else {
        const index = Number(answer)
        chosen = Number.isInteger(index) && index >= 0 && index < remaining.length ? remaining[index] : remaining[0]
      }
    }
    if (!chosen) continue
    remaining.splice(remaining.indexOf(chosen), 1)
    const asset = typeof api.giveAsset === 'function' ? api.giveAsset(inv.seat, chosen) : null
    if (asset) {
      if (typeof api.exemptAssetSlot === 'function') api.exemptAssetSlot(asset, 'ally')
      asset.ignoredSlots = [...new Set([...(asset.ignoredSlots || []), 'ally'])]
      placed.push(chosen)
    }
  }
  info(api, `盟友入场：${placed.length} 张（按玩家选择分配，不占盟友槽）。`)
  return placed
}

export function putArtifactsIntoPlay(state, api = {}) {
  const codes = uncrossedArtifacts(state).filter(code => code !== '11688')
  const investigators = activeInvestigators(state)
  const placed = []
  codes.forEach((code, index) => {
    const inv = investigators[index % Math.max(1, investigators.length)]
    if (!inv) return
    if (typeof api.giveAsset === 'function' && api.giveAsset(inv.seat, code)) placed.push(code)
  })
  info(api, `未划除神器入场：${placed.length} 张，尽可能均分。`)
  return placed
}

export function setupCthulhuDeck(state, api = {}) {
  if (!api?.mechanics?.scenarioDecks?.initialize) {
    setFlag(state, 'cthulhuDeckUnavailable', true)
    return 0
  }
  const expected = CTHULHU_DECK.length
  api.mechanics.scenarioDecks.initialize(CTHULHU_DECK_ID, [...CTHULHU_DECK], { shuffle: true })
  info(api, `克苏鲁牌库：${expected} 张 action 卡。`)
  return expected
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  if (battleBranch(state) === 'standTogether') putAlliesIntoPlay(state, api)
  putArtifactsIntoPlay(state, api)
  inheritFloodedNeighborhoods(state, api)
  setupCthulhuBoard(state, api)
  setupCthulhuDeck(state, api)
  setFlag(state, 'doomArkhamPartTwoDeckReady', true)
}

/** 直调/单测入口：完整 Setup（地点 + 克苏鲁面板 + 牌库 + 神器/盟友/淹没继承）。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  delete state.scenarioFlags?.doomArkhamPartTwoPrepared
  delete state.scenarioFlags?.doomArkhamPartTwoReport
  state.scenarioZones ||= {}
  const report = prepareScenario(state, api)
  for (const id of placedLocationIds(state)) placeLocationAt(state, id, LOCATION_COORDINATES[id], api, { revealed: true })
  for (const inv of state.investigators || []) if (!inv.location) inv.location = START_LOCATION
  if (!state.encounterDeck?.length) state.encounterDeck = [...(state.scenario?.encounterDeck || ENCOUNTER_DECK)]
  state.enemies ||= []
  state.victoryDisplay ||= []
  afterDeckSetup(state, null, { api })
  info(api, `阿卡姆的毁灭 II：${state.locations.length} 处地点入场；克苏鲁面板 ${facetsInPlay(state).length + 1} 张。`)
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 废墟替换 / 议程背面
// ---------------------------------------------------------------------------
export function ruinedCodeForLocation(location) {
  const id = location?.id
  if (!id) return null
  return RUINED_SWAP_CODES[id] || null
}

/** 「与该地点放在一边的[[废墟]]版本交换，后者以未揭示面朝上」。 */
export function swapToRuined(state, locationId, api = {}) {
  const location = locationOf(state, locationId)
  if (!location || isRuined(location)) return null
  const ruinedCode = ruinedCodeForLocation(location)
  if (!ruinedCode) return null
  const ruined = ALL_CARDS[ruinedCode]
  if (!ruined) return null
  location.originalCode = ruinedCode
  location.code = ruinedCode
  location.name = ruined.nameZh || ruined.name
  location.subName = ruined.subnameZh || ruined.subname || ''
  location.shroud = Number(ruined.shroud) || location.shroud
  location.traits = [...(ruined.traits || [])]
  location.ruined = true
  location.revealed = false
  location.clues = 0
  location.attachments = []
  flagsFor(state).ruinedLocations = [...new Set([...(flagsFor(state).ruinedLocations || []), locationId])]
  info(api, `「${location.name}」翻到[[废墟]]面（未揭示）。`)
  return location
}

export function ruinedLocationCount(state) {
  return (state.locations || []).filter(location => isRuined(location)).length
}

export function placeCluesOnRevealedLocations(state, api = {}) {
  let placed = 0
  for (const location of state.locations || []) {
    if (!location.revealed || isRooftop(location)) continue
    const card = ALL_CARDS[location.originalCode || location.code] || {}
    if (Number(card.victory) > 0) continue
    const target = Number(location.maxClues) || Number(card.clues) || 1
    const current = Number(location.clues) || 0
    if (current >= target) continue
    if (typeof api.addCluesToLocation === 'function') api.addCluesToLocation(location.id, target - current)
    else location.clues = target
    placed += target - current
  }
  info(api, `补放线索：${placed} 个。`)
  return placed
}

export function shuffleStarSpawnIntoEncounter(state, api = {}) {
  const aside = state.scenarioZones?.setAside || []
  const index = aside.findIndex(code => SET_ASIDE_STAR_SPAWN_CODES.includes(code))
  if (index < 0) return null
  const [code] = aside.splice(index, 1)
  state.encounterDeck ||= []
  state.encounterDeck.push(code)
  if (Array.isArray(state.encounterDiscard) && state.encounterDiscard.length) {
    state.encounterDeck.push(...state.encounterDiscard.splice(0))
  }
  const shuffle = typeof api?.shuffle === 'function' ? api.shuffle : list => list
  state.encounterDeck = shuffle(state.encounterDeck)
  info(api, `将 1 名放在一边的[[星之眷族]]敌人与遭遇弃牌堆洗回遭遇牌库。`)
  return code
}

export function agendaDoomBackEffect(state, api = {}) {
  const cthulhuAt = cthulhuLocationId(state)
  // 最近的「非废墟、完全淹没」地点。
  const candidates = (state.locations || []).filter(location => !isRuined(location)
    && fullyFloodedIds(state, api).includes(location.id))
  let swapped = null
  if (candidates.length) {
    let target = candidates[0]
    if (cthulhuAt && typeof api?.mechanics?.map?.nearest === 'function') {
      const eligible = new Set(candidates.map(location => location.id))
      const nearest = api.mechanics.map.nearest(cthulhuAt, id => eligible.has(id))
      if (nearest?.length) target = locationOf(state, nearest[0]) || target
    }
    // 移动克苏鲁并降低该地点水位。
    const body = (state.enemies || []).find(enemy => codeOf(enemy) === CTHULHU_BODY_CODE)
    if (body && typeof api.moveEnemy === 'function') api.moveEnemy(body, target.id)
    else if (body) body.location = target.id
    for (const part of facetsInPlay(state)) part.location = target.id
    changeFloodLevel(state, target.id, -1, api)
    target.clues = 0
    target.attachments = []
    swapped = swapToRuined(state, target.id, api)
    info(api, `议程背面：克苏鲁移动到「${target.name}」并把它换成[[废墟]]面。`)
  }
  if (!swapped) {
    info(api, '议程背面：没有交换地点，抽取克苏鲁牌库顶 1 张卡牌。')
    drawCthulhuCard(state, leadSeat(state), api, { source: '议程 11689 背面' })
  }
  if (ruinedLocationCount(state) >= RUINED_LOCATION_LIMIT) {
    for (const inv of activeInvestigators(state)) {
      if (typeof api.defeat === 'function') api.defeat(inv, 'killed')
      else inv.defeated = true
    }
    info(api, `场上已有 ${RUINED_LOCATION_LIMIT} 处[[废墟]]地点：每位调查员阵亡。`)
    if (typeof api.finish === 'function') api.finish('noResolution')
    return { killed: true }
  }
  placeCluesOnRevealedLocations(state, api)
  shuffleStarSpawnIntoEncounter(state, api)
  // 把当前议程替换为背面状态（不推进议程序号）。
  const agendaBack = clone((state.scenario?.stageCards || STAGE_CARDS)[AGENDA_DOOM_BACK_CODE])
  agendaBack.doomThreshold = null
  state.agendas[state.agendaIndex] = agendaBack
  setFlag(state, 'doomArkhamPartTwoAgendaBack', true)
  return { swapped: Boolean(swapped), killed: false }
}

// ---------------------------------------------------------------------------
// 抽克苏鲁牌：议程 / 标记 / 行动卡（强制效果）
// ---------------------------------------------------------------------------
export function agendaEnemyPhaseEnd(state, api = {}) {
  if (!['11689', '11689b', '11691b'].includes(currentAgendaCode(state))) return false
  const cthulhuAt = cthulhuLocationId(state)
  if (cthulhuAt) changeFloodLevel(state, cthulhuAt, 1, api)
  drawCthulhuCard(state, leadSeat(state), api, { source: '议程强制（敌军阶段结束）' })
  return true
}

export function roundEnded(state, api = {}) {
  let handled = false
  const agenda = currentAgenda(state)
  const agendaSpec = AGENDA_STAGES[agenda?.id === `agenda${AGENDA_DOOM_BACK_CODE}` ? 'doomBack' : 'doom']
  if (agenda && (agendaSpec?.roundEndFullyFlooded || agenda.finalSeal)) {
    const fullyFlooded = new Set(fullyFloodedIds(state, api))
    for (const inv of activeInvestigators(state)) {
      if (!fullyFlooded.has(inv.location)) continue
      if (typeof api.damage === 'function') api.damage(inv.seat, 1)
      else inv.damage = (Number(inv.damage) || 0) + 1
      if (typeof api.horror === 'function') api.horror(inv.seat, 1)
      else inv.horror = (Number(inv.horror) || 0) + 1
      handled = true
    }
  }
  // 幕目标：胜利区有 3 名[[克苏鲁]]敌人 → 推进。
  const act = currentAct(state)
  if (act?.objective?.type === 'cthulhuInVictory'
    && cthulhuEnemiesInVictory(state).length >= Number(act.objective.amount || 3)
    && typeof api.advanceAct === 'function') {
    api.advanceAct()
    handled = true
  }
  // 最终封印目标：每名[[克苏鲁]]敌人均在胜利区，且有 5 处地点上有印记 → 推进。
  if (currentAgendaCode(state) === AGENDA_FINAL_SEAL_CODE && finalSealObjectiveMet(state)
    && typeof api.advanceAgenda === 'function') {
    setFlag(state, 'finalSealAdvanceByObjective', true)
    api.advanceAgenda()
    handled = true
  }
  return handled
}

export function checkObjectives(state, api = {}) {
  return roundEnded(state, api)
}

// ---------------------------------------------------------------------------
// 最终封印「印记」
// ---------------------------------------------------------------------------
export function sigilLocations(state) {
  return Object.entries(flagsFor(state).sigils || {}).filter(([, value]) => value === true).map(([id]) => id)
}
export function finalSealObjectiveMet(state) {
  return cthulhuEnemiesInVictory(state).length >= 3 && sigilLocations(state).length >= SIGIL_REQUIRED
}
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  if (currentAgendaCode(state) !== AGENDA_FINAL_SEAL_CODE) return moves
  const location = locationOf(state, inv.location)
  if (!location) return moves
  if (isRooftop(location)) return moves
  const required = investigatorCount(state)
  const groupClues = activeInvestigators(state).filter(item => item.location === location.id)
    .reduce((sum, item) => sum + (Number(item.clues) || 0), 0)
  const artifacts = activeInvestigators(state).flatMap(item => (item.assets || [])
    .filter(asset => (ALL_CARDS[codeOf(asset)]?.traits || []).includes('Artifact')))
  if (artifacts.length && groupClues >= required) {
    moves.push({
      action: 'scenarioAction', rule: 'doomArkhamFinalSealSigil', locationId: location.id, actions: 1,
      label: `最终封印：共同花费 ${required} 个线索并把 1 张[[神器]]放入胜利区，在本地点放置印记`,
    })
  }
  return moves
}
export function performAction(state, inv, move, api = {}) {
  if (!move || move.rule !== 'doomArkhamFinalSealSigil') return false
  return placeSigil(state, inv, api)
}
export function placeSigil(state, inv, api = {}) {
  if (!inv || currentAgendaCode(state) !== AGENDA_FINAL_SEAL_CODE) return false
  const location = locationOf(state, inv.location)
  if (!location || isRooftop(location)) return false
  const required = investigatorCount(state)
  const group = activeInvestigators(state).filter(item => item.location === location.id)
  const available = group.reduce((sum, item) => sum + (Number(item.clues) || 0), 0)
  if (available < required) return false
  const artifact = activeInvestigators(state).flatMap(item => (item.assets || [])
    .filter(asset => (ALL_CARDS[codeOf(asset)]?.traits || []).includes('Artifact')))[0]
  if (!artifact) return false
  let remaining = required
  for (const item of group) {
    const pay = Math.min(Number(item.clues) || 0, remaining)
    item.clues -= pay
    remaining -= pay
    if (remaining <= 0) break
  }
  if (typeof api.addStoryToVictory === 'function') api.addStoryToVictory(codeOf(artifact), { sourceId: artifact.id })
  if (typeof api.removeAsset === 'function') api.removeAsset(artifact.controllerSeat ?? inv.seat, artifact.id)
  flagsFor(state).sigils ||= {}
  flagsFor(state).sigils[location.id] = true
  info(api, `在「${location.name}」放置印记（${sigilLocations(state).length}/${SIGIL_REQUIRED}）。`)
  return true
}

// ---------------------------------------------------------------------------
// 阶段 / 幕 / 议程揭示
// ---------------------------------------------------------------------------
export function phaseBegan(state, phase, api = {}) {
  const name = String(phase)
  // 11710 第五只眼：强制「调查阶段结束时」——引擎在敌人阶段开始时调用本钩子（phaseBegan('enemy')），
  // 正好是调查阶段结束之后。
  if (name === 'enemy') return resolveFifthEyeForced(state, api)
  if (name !== 'mythos') return false
  return agendaEnemyPhaseEnd(state, api)
}

/** 11710 第五只眼：在克苏鲁面板上一名没有毁灭标记的敌人上放 1 毁灭并弃掉本卡。 */
function resolveFifthEyeForced(state, api = {}) {
  const storyAssets = state.storyAssets || []
  const card = storyAssets.find(asset => codeOf(asset) === FIFTH_EYE_CODE)
  if (!card) return false
  const boardEnemies = (state.enemies || []).filter(enemy => {
    const code = codeOf(enemy)
    return code === CTHULHU_BODY_CODE || CTHULHU_ENEMY_CODES.includes(code)
  })
  const candidates = boardEnemies.filter(enemy => !(Number(enemy.doom) || 0))
  if (!candidates.length) return false
  const pick = candidates.length === 1 ? candidates[0] : candidates[Number(api.choose?.({
    kind: 'enemy', source: FIFTH_EYE_CODE, seat: leadSeat(state),
    prompt: '第五只眼：选择一名其上没有毁灭标记的[[克苏鲁]]敌人',
    options: candidates.map((enemy, index) => ({ id: String(index), label: enemy.name || codeOf(enemy) })),
  })) || 0] || candidates[0]
  if (!pick) return false
  if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(pick, 1)
  else pick.doom = (Number(pick.doom) || 0) + 1
  state.storyAssets = storyAssets.filter(asset => asset !== card)
  info(api, `第五只眼：调查阶段结束，在「${pick.name || codeOf(pick)}」上放置 1 个毁灭标记并弃掉本卡。`)
  return true
}

export function actIndexAfterAdvance(state, cur, api) {
  void cur
  void api
  const flags = flagsFor(state)
  if (flags.finalSealTransition) {
    delete flags.finalSealTransition
    return state.actIndex
  }
  if (flags.doomArkhamPartTwoFlipBack) {
    delete flags.doomArkhamPartTwoFlipBack
    return state.actIndex
  }
  return undefined
}

const FACET_BY_FRONT = Object.freeze({ 11702: '11702b', 11703: '11703b', 11704: '11704b' })

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (![ACT_FIGHT_BACK_CODE, ACT_BANISH_HIM_CODE].includes(code)) return false
  // 希望消逝：幕推进时弃掉并释放封印标记（detach/release 读点见 discardHopeFadesCard）。
  if (flagsFor(state).hopeFadesInPlay || flagsFor(state).hopeFadesCardId) {
    discardHopeFadesCard(state, api)
    info(api, '希望消逝：幕推进，弃掉本卡并释放封印标记。')
  } else {
    state.storyAssets = (state.storyAssets || []).filter(asset => codeOf(asset) !== HOPE_FADES_CODE)
  }
  returnCthulhuFacetsToBoard(state, api, { enraged: false })
  increaseCthulhuRage(state, 1)
  const rage = cthulhuRage(state)
  if (code === ACT_FIGHT_BACK_CODE) {
    if (rage <= CTHULHU_FIGHT_BACK_RAGE_THRESHOLD - 1) {
      setFlag(state, 'doomArkhamPartTwoFlipBack', true)
      info(api, `反击！背面：狂怒 ${rage} ≤ 4，翻回场景 1a。`)
      return 'flipBack'
    }
    info(api, `反击！背面：狂怒 ${rage} ≥ 5 → 结局 1。`)
    if (typeof api.finish === 'function') api.finish('resolution1')
    else resolution(state, 'resolution1', null, api)
    return 'resolution1'
  }
  // 放逐他！
  if (rage <= CTHULHU_BANISH_RAGE_THRESHOLD - 1) {
    setFlag(state, 'doomArkhamPartTwoFlipBack', true)
    info(api, `放逐他！背面：狂怒 ${rage} ≤ 3，翻回场景 1a。`)
    return 'flipBack'
  }
  // 怒气设为 5（1–2 人局为 4），把每名克苏鲁敌人翻至狂怒面（印刷：忽略其强制效果）。
  // 抑制标记保证引擎回调的 enemyFaceFlipped 不结算「翻至本面后」三条强制。
  setCthulhuRage(state, investigatorCount(state) <= 2 ? 4 : CTHULHU_RAGE_MAX)
  flagsFor(state).suppressEnemyFaceFlipped = true
  try {
    for (const enemy of facetsInPlay(state)) {
      const front = codeOf(enemy)
      if (String(front).endsWith('b')) continue
      const enraged = FACET_BY_FRONT[front]
      if (enraged && typeof api.flipEnemy === 'function') api.flipEnemy(enemy, enraged)
    }
  } finally {
    delete flagsFor(state).suppressEnemyFaceFlipped
  }
  placeCluesOnRevealedLocations(state, api)
  // 按玩家顺序每名调查员可控制 1 张放在一边的盟友剧情支援；
  putAlliesIntoPlay(state, api)
  // 特殊议程「最终封印」同时为当前幕与当前议程。
  const finalSeal = clone((state.scenario?.stageCards || STAGE_CARDS)[AGENDA_FINAL_SEAL_CODE])
  finalSeal.doomThreshold = ALL_CARDS[AGENDA_FINAL_SEAL_CODE]?.doom ?? 10
  state.agendas = [finalSeal]
  state.agendaIndex = 0
  const finalAct = clone(finalSeal)
  finalAct.id = 'act11691b'
  finalAct.type = 'act'
  finalAct.doomThreshold = undefined
  state.acts = [finalAct]
  state.actIndex = 0
  state.doom = investigatorCount(state)
  setFlag(state, 'doomArkhamPartTwoFinalSeal', true)
  setFlag(state, 'finalSealTransition', true)
  info(api, `放逐他！背面：怒气设为 ${cthulhuRage(state)}，进入特殊议程「最终封印」（毁灭 ${state.doom}）。`)
  return 'finalSeal'
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA_DOOM_CODE) return agendaDoomBackEffect(state, api)
  if (code === AGENDA_FINAL_SEAL_CODE) {
    const byObjective = flagsFor(state).finalSealAdvanceByObjective === true
    if (!byObjective) {
      // 勘误后：因毁灭阈值推进 → 每位调查员被击败；否则按废墟数量 → 结局 2/3。
      info(api, '最终封印背面：因毁灭阈值推进 → 每位调查员被击败。')
      for (const inv of activeInvestigators(state)) {
        if (typeof api.defeat === 'function') api.defeat(inv, 'killed')
        else inv.defeated = true
      }
      if (typeof api.finish === 'function') api.finish('noResolution')
      else resolution(state, 'noResolution', null, api)
      return 'noResolution'
    }
    const ruined = ruinedLocationCount(state)
    const key = ruined <= SIGIL_REQUIRED ? 'resolution2' : 'resolution3'
    info(api, `最终封印背面：废墟 ${ruined} 处 → 结局 ${key === 'resolution2' ? 2 : 3}。`)
    if (typeof api.finish === 'function') api.finish(key)
    else resolution(state, key, null, api)
    return key
  }
  return false
}

// ---------------------------------------------------------------------------
// 敌人修正 / 混乱标记
// ---------------------------------------------------------------------------
export function enemyStatModifier(state, enemy, stat) {
  const code = codeOf(enemy)
  const facet = flagsOfCode(code).cthulhuFacet === true || CTHULHU_ENEMY_CODES.includes(code)
  if (!facet) return 0
  const rage = cthulhuRage(state)
  if (stat === 'fight' || stat === 'evade') return rage
  if (stat === 'health') return String(code).endsWith('b') ? rage : 0
  return 0
}

export function resolveChaosToken(state, inv, token) {
  return doomOfArkhamPartTwoChaosToken(state, inv, token)
}
export function chaosTokenValue(state, tokenFace) {
  return doomOfArkhamPartTwoChaosTokenValue(state, tokenFace)
}
export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!effect) return false
  const seat = inv?.seat ?? effect.seat ?? leadSeat(state)
  const investigator = (state.investigators || [])[seat]
  const flooded = investigator ? floodLevelOf(state, investigator.location, api) >= 1 : false
  if (effect.mode === 'damageIfFlooded') {
    if (!investigator || !flooded) return false
    if (typeof api.damage === 'function') api.damage(seat, 1)
    else investigator.damage = (Number(investigator.damage) || 0) + 1
    info(api, `[cultist] 所在地点淹没：${investigator.name} 受到 1 点伤害。`)
    return true
  }
  if (effect.mode === 'clueOnLocation') {
    if (!investigator) return false
    if ((Number(investigator.clues) || 0) <= 0) return false
    if (typeof api.loseClues === 'function') api.loseClues(seat, 1)
    else investigator.clues -= 1
    if (typeof api.addCluesToLocation === 'function') api.addCluesToLocation(investigator.location, 1)
    else {
      const location = locationOf(state, investigator.location)
      if (location) location.clues = (Number(location.clues) || 0) + 1
    }
    info(api, `[tablet] 检定失败：把 1 个线索放在「${locationOf(state, investigator.location)?.name || investigator.location}」。`)
    return true
  }
  if (effect.mode === 'anotherTokenAndCthulhuDraw') {
    if (typeof api.drawAnotherChaosToken === 'function') api.drawAnotherChaosToken(seat)
    const failed = effect.test?.success === false || Number(effect.test?.failedBy) > 0
    if (failed && canDrawCthulhuFromToken(state)) {
      markCthulhuDrawnFromToken(state)
      drawCthulhuCard(state, seat, api, { source: '[elder_thing] 检定失败' })
      info(api, `[elder_thing] 检定失败：抽克苏鲁牌库顶 1 张（本轮上限 1）。`)
    }
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const records = recordsFor(state)
  records.doomOfArkhamPartTwoResolution = finalKey
  let bonus = 0
  if (finalKey === 'resolution1') {
    records.cthulhuWasDrivenAway = true
    for (const inv of activeInvestigators(state)) {
      if (typeof api.addTrauma === 'function') { api.addTrauma(inv.seat, 'physical', 3); api.addTrauma(inv.seat, 'mental', 3) }
      else {
        state.campaign.trauma ||= {}
        state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
        state.campaign.trauma[inv.seat].physical += 3
        state.campaign.trauma[inv.seat].mental += 3
      }
    }
  } else if (finalKey === 'resolution2') {
    records.cthulhuWasBanished = true
    for (const inv of activeInvestigators(state)) {
      if (typeof api.addTrauma === 'function') { api.addTrauma(inv.seat, 'physical', 1); api.addTrauma(inv.seat, 'mental', 1) }
      else {
        state.campaign.trauma ||= {}
        state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
        state.campaign.trauma[inv.seat].physical += 1
        state.campaign.trauma[inv.seat].mental += 1
      }
    }
  } else if (finalKey === 'resolution3') {
    records.cthulhuWasBanished = true
    records.arkhamWasDestroyed = true
    bonus = 5
    for (const inv of activeInvestigators(state)) {
      if (typeof api.addTrauma === 'function') { api.addTrauma(inv.seat, 'physical', 2); api.addTrauma(inv.seat, 'mental', 2) }
      else {
        state.campaign.trauma ||= {}
        state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
        state.campaign.trauma[inv.seat].physical += 2
        state.campaign.trauma[inv.seat].mental += 2
      }
    }
  } else {
    records.cthulhuAnnihilatedTheCityOfArkham = true
    state.campaign.failed = true
    for (const inv of activeInvestigators(state)) {
      if (typeof api.defeat === 'function') api.defeat(inv, 'killed')
      else inv.defeated = true
    }
  }
  info(infoApi, `阿卡姆的毁灭 II 结局：${finalKey}${bonus ? `（+${bonus} 额外经验）` : ''}。`)
  return { bonus, award: true }
}

// ---------------------------------------------------------------------------
// 克苏鲁部位：翻至[[狂怒]]面后的强制（引擎钩子 enemyFaceFlipped，PRIMITIVES 已落地）
// ---------------------------------------------------------------------------
const ENRAGED_FORCED = Object.freeze({
  '11702b': 'drawCthulhuCard',
  '11703b': 'discardRandomHand',
  '11704b': 'placeDoomOnFacet',
})

/**
 * 引擎在 `api.flipEnemy` 换面成功（changed）后调用一次（scenario-runtime.js#1738）。
 * 只结算「你将本敌人翻至本面后」的三条强制；Banish Him! 的强制翻面按印刷「忽略其强制效果」，
 * 由 actReveal 置 `suppressEnemyFaceFlipped` 抑制。
 */
export function enemyFaceFlipped(state, enemy, fromCode, toCode, api = {}) {
  if (flagsFor(state).suppressEnemyFaceFlipped === true) return false
  const forced = ENRAGED_FORCED[String(toCode)]
  if (!forced) return false
  const controllerSeat = state.currentSeat ?? leadSeat(state)
  const inv = (state.investigators || [])[controllerSeat] || (state.investigators || [])[0] || null
  if (forced === 'drawCthulhuCard') {
    drawCthulhuCard(state, inv?.seat ?? leadSeat(state), api, { source: '灰白双翼翻至狂怒面' })
  } else if (forced === 'discardRandomHand') {
    if (inv) {
      if (typeof api.discardRandom === 'function') api.discardRandom(inv.seat, 1)
      else if ((inv.hand || []).length) spliceHand(inv, -1, 1)[0]
    }
    info(api, `${inv?.name || '调查员'} 随机弃掉 1 张手牌（凶恶面容翻至狂怒面）。`)
  } else if (forced === 'placeDoomOnFacet') {
    const target = facetsInPlay(state).find(item => !(Number(item.doom) || 0)) || null
    if (target) {
      if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(target, 1)
      else target.doom = (Number(target.doom) || 0) + 1
      info(api, `邪恶利爪翻至狂怒面：在「${target.name || codeOf(target)}」上放置 1 个毁灭标记。`)
    }
  }
  info(api, `「${enemy?.name || toCode}」翻至[[狂怒]]面（${fromCode} → ${toCode}）。`)
  return true
}

/** 引擎在「攻击命中敌人后」调用（combat.js 的两条攻击结算路径）：只负责翻面。 */
export function enemyAttackedSuccessfully(state, inv, enemy, api = {}, infoArg = {}) {
  void state
  void inv
  if (!enemy || infoArg?.defeated === true) return false
  const code = codeOf(enemy)
  const pair = CTHULHU_FACET_PAIRS.find(([front]) => front === code)
  if (!pair) return false
  if (typeof api.flipEnemy !== 'function') return false
  // 翻面成功后的强制效果由引擎回调 enemyFaceFlipped 结算（不在本函数里重复结算）。
  return api.flipEnemy(enemy, pair[1]) != null
}

/**
 * 引擎在「普通躲避成功」后调用一次（combat.js；自动躲避不算）。
 * 非[[狂怒]]面：翻至[[狂怒]]面（翻面后的强制由 enemyFaceFlipped 结算）；
 * [[狂怒]]面：对其造成 1 点伤害。
 */
export function enemyEvadedSuccessfully(state, inv, enemy, api = {}) {
  if (!enemy) return false
  const code = codeOf(enemy)
  const frontPair = CTHULHU_FACET_PAIRS.find(([front]) => front === code)
  if (frontPair) {
    if (typeof api.flipEnemy !== 'function') return false
    // 翻面成功后的强制效果由引擎回调 enemyFaceFlipped 结算（不在本函数里重复结算）。
    return api.flipEnemy(enemy, frontPair[1]) != null
  }
  const enragedPair = CTHULHU_FACET_PAIRS.find(([, enraged]) => enraged === code)
  if (enragedPair) {
    const presentation = { code, sourceEnemyId: enemy.id }
    if (typeof api.scenario?.damageEnemy === 'function') {
      api.scenario.damageEnemy(enemy.id, 1, inv?.seat ?? null, '11702-11704 躲避成功', presentation)
    } else if (typeof api.damageEnemy === 'function') {
      api.damageEnemy(enemy.id, 1, inv?.seat ?? null, '11702-11704 躲避成功', presentation)
    } else {
      enemy.damageTaken = (Number(enemy.damageTaken) || 0) + 1
    }
    info(api, `「${enemy.name || code}」被躲避成功，受到 1 点伤害。`)
    return true
  }
  void state
  return false
}

// ---------------------------------------------------------------------------
// 诡计（11716/11717/11719/11720）：单卡条目 encounterResolve → 本 events
// ---------------------------------------------------------------------------
function testSpecOf(code) {
  return flagsOfCode(code).test || null
}
function runRageTest(state, inv, code, api, resolve) {
  const spec = testSpecOf(code) || {}
  const skill = spec.skill || 'willpower'
  const difficulty = spec.difficulty === 'rage' ? cthulhuRage(state) : (Number(spec.difficulty) || cthulhuRage(state))
  if (!inv || typeof api.test !== 'function') {
    resolve?.({ success: false, failedBy: 1, value: 0 })
    return
  }
  api.test(inv.seat, skill, difficulty, resolve)
}
function hurt(inv, kind, api) {
  if (!inv) return
  if (typeof api?.[kind] === 'function') api[kind](inv.seat, 1)
  else inv[kind] = (Number(inv[kind]) || 0) + 1
}

/** 11716 夷为平地：显现 - 敏捷(X) 检定，失败受到 2 点伤害。 */
export function layWaste(state, inv, api = {}) {
  let failed = false
  runRageTest(state, inv, '11716', api, result => {
    if (result?.success === true) return
    failed = true
    if (typeof api.damage === 'function') api.damage(inv.seat, 2)
    else inv.damage = (Number(inv.damage) || 0) + 2
    info(api, `夷为平地：${inv.name} 检定失败，受到 2 点伤害。`)
  })
  return failed
}
/** 11717 伊克雷希特之眼：险境；意志(X)，失败 1 直接恐惧 + 随机弃 1 张手牌。 */
export function eyesOfYchlecht(state, inv, api = {}) {
  let failed = false
  runRageTest(state, inv, '11717', api, result => {
    if (result?.success === true) return
    failed = true
    // 「直接恐惧」：不吃支援伤害分配（引擎读点 api.scenario.directHorror / api.directHorror）。
    const direct = api.scenario?.directHorror || api.directHorror
    if (typeof direct === 'function') direct(inv.seat, 1)
    else hurt(inv, 'horror', api)
    if (typeof api.discardRandom === 'function') api.discardRandom(inv.seat, 1)
    else if ((inv.hand || []).length) spliceHand(inv, -1, 1)[0]
    info(api, `伊克雷希特之眼：${inv.name} 受到 1 点直接恐惧并随机弃 1 张手牌。`)
  })
  return failed
}
/** 11719 恶心可塑性：险境；选择一项：密谋 +1 毁灭 / 提高所在地点水位 / 每人 1 伤或 1 恐。 */
export function grossPlasticity(state, inv, api = {}) {
  if (!inv) return false
  const choice = typeof api.choose === 'function'
    ? api.choose({
      kind: 'effect', source: '11719', seat: inv.seat,
      prompt: '恶心可塑性：选择一项',
      options: [
        { id: 'doom', label: '在当前密谋上放置 1 个毁灭标记' },
        { id: 'flood', label: '提高你所在地点的淹没等级' },
        { id: 'harm', label: '每位调查员受到 1 点伤害或 1 点恐惧' },
      ],
    })
    : 'harm'
  if (choice === 'doom') {
    if (typeof api.addDoom === 'function') api.addDoom(1)
    else state.doom = (Number(state.doom) || 0) + 1
    info(api, '恶心可塑性：在当前密谋上放置 1 个毁灭标记（可能导致推进）。')
  } else if (choice === 'flood') {
    changeFloodLevel(state, inv.location, 1, api)
    info(api, '恶心可塑性：提高所在地点的淹没等级。')
  } else {
    // 第三项：每位调查员各自选择 1 点伤害或 1 点恐惧。
    for (const item of activeInvestigators(state)) {
      const harm = typeof api.choose === 'function'
        ? String(api.choose({
          kind: 'effect', source: '11719', seat: item.seat,
          prompt: '恶心可塑性：选择受到 1 点伤害或 1 点恐惧',
          options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
        }))
        : 'damage'
      hurt(item, harm === 'horror' ? 'horror' : 'damage', api)
    }
  }
  return true
}
/** 11720 阿卡姆遭袭：每位调查员意志(X)；1 人以上失败 → 抽克苏鲁牌库顶 1 张。 */
export function arkhamUnderAssault(state, api = {}) {
  let anyFailed = false
  for (const inv of activeInvestigators(state)) {
    runRageTest(state, inv, '11720', api, result => { if (result?.success !== true) anyFailed = true })
  }
  if (anyFailed) drawCthulhuCard(state, leadSeat(state), api, { source: '阿卡姆遭袭' })
  info(api, `阿卡姆遭袭：${anyFailed ? '有人失败，抽克苏鲁牌库顶 1 张。' : '全部成功。'}`)
  return anyFailed
}
export const events = {
  doomOfArkhamPartTwoLayWaste(state, payload = {}, api = {}) {
    return layWaste(state, (state.investigators || [])[payload.seat], api)
  },
  doomOfArkhamPartTwoEyesOfYchlecht(state, payload = {}, api = {}) {
    return eyesOfYchlecht(state, (state.investigators || [])[payload.seat], api)
  },
  doomOfArkhamPartTwoGrossPlasticity(state, payload = {}, api = {}) {
    return grossPlasticity(state, (state.investigators || [])[payload.seat], api)
  },
  doomOfArkhamPartTwoArkhamUnderAssault(state, payload = {}, api = {}) {
    void payload
    return arkhamUnderAssault(state, api)
  },
}

// ---------------------------------------------------------------------------
// 只读投影
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    branch: battleBranch(state),
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    rage: cthulhuRage(state),
    cthulhuLocation: cthulhuLocationId(state),
    facetsInPlay: facetsInPlay(state).map(enemy => codeOf(enemy)),
    facetsInVictory: cthulhuEnemiesInVictory(state).map(entry => String(entry.code)),
    cthulhuDeck: cthulhuDeckSize(state),
    cthulhuDiscard: cthulhuDeckDiscard(state).length,
    sigils: sigilLocations(state),
    ruined: (state.locations || []).filter(location => isRuined(location)).map(location => location.id),
    fullyFlooded: fullyFloodedIds(state),
    floodedNeighborhoods: [...(recordsFor(state).floodedNeighborhoods || [])],
    finalSeal: currentAgendaCode(state) === AGENDA_FINAL_SEAL_CODE,
  }
}

export function implementedEntryFlags(code) {
  return flagsOfCode(code)
}

export const behavior = {
  id: CHAPTER_ID,
  referenceCode: REFERENCE_CODE,
  startLocation: () => START_LOCATION,
  locationsStartRevealed: true,
  canGainResources,
  introduction(sc, records = {}, context = null) {
    void context
    const branch = records.theInvestigatorsStoodTogether ? 'theDoomOfArkham2'
      : records.yourAlliesHaveAPlan ? 'theDoomOfArkham3' : 'mustDecide'
    const title = sc?.name || '阿卡姆的毁灭 · 第二部分'
    const paragraphs = [
      ...(STORY.intro.theDoomOfArkham1.paragraphs || []),
      ...(STORY.intro.mustDecide.paragraphs || []),
      ...(STORY.intro[branch]?.paragraphs || []),
      ...(branch === 'theDoomOfArkham3' ? (STORY.intro.theDoomOfArkham3Continued.paragraphs || []) : []),
    ].filter(Boolean)
    const sections = [{ title, paragraphs }]
    return { version: 3, title, sections, paragraphs, code: ACT_CODES[0] }
  },
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  setupEnemies,
  modifyDeck,
  afterDeckSetup,
  phaseBegan,
  roundEnded,
  checkObjectives,
  actReveal,
  actIndexAfterAdvance,
  agendaReveal,
  actions,
  performAction,
  enemyStatModifier,
  enemySpawned: ruinedLocationEnemyEntry,
  enemyMoved: (state, enemy, previous, api) => {
    if (previous !== enemy.location) ruinedLocationEnemyEntry(state, enemy, api)
  },
  enemyAttackedSuccessfully,
  enemyFaceFlipped,
  enemyEvadedSuccessfully,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  resolution,
  events,
  scenarioSummary,
  // 具名助手
  placeLocationAt,
  placedLocationIds,
  setupCthulhuBoard,
  linkCthulhuParts,
  returnCthulhuFacetsToBoard,
  setupCthulhuDeck,
  drawCthulhuCard,
  resolveCthulhuCard,
  takeCthulhuTop,
  discardCthulhuCard,
  recycleCthulhuDeck,
  cthulhuDeckSize,
  cthulhuDeckDiscard,
  cthulhuLocationId,
  facetsInPlay,
  cthulhuEnemiesInVictory,
  swapToRuined,
  ruinedLocationCount,
  placeCluesOnRevealedLocations,
  shuffleStarSpawnIntoEncounter,
  inheritFloodedNeighborhoods,
  putAlliesIntoPlay,
  putArtifactsIntoPlay,
  uncrossedArtifacts,
  placeSigil,
  sigilLocations,
  finalSealObjectiveMet,
  floodLevelOf,
  changeFloodLevel,
  fullyFloodedIds,
  cthulhuRage,
  setCthulhuRage,
  increaseCthulhuRage,
  skullValue,
  layWaste,
  eyesOfYchlecht,
  grossPlasticity,
  arkhamUnderAssault,
  selectHopeFadesSealToken,
  discardHopeFadesCard,
}

export {
  ACT_CODES, AGENDA_CODES, CTHULHU_FACET_PAIRS, CTHULHU_ENEMY_CODES, CTHULHU_DECK, START_LOCATION,
  SET_ASIDE_CARDS, IMPLEMENTED_ENTRY_CODES, CHAOS_TOKEN_FACES, isHardSide, STAGE_CARDS,
  ACT_STAGES, AGENDA_STAGES, TREACHERY_CODES, ROOFTOP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS,
}
