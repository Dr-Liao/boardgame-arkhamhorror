import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { changeChaosBag } from '../../../../../src/engine/chaos-bag.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { agendaRuleFor, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { encounterRules, tfaDistance as distance } from '../../encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { ACTS_BY_CODE, SPECIAL_ACT_OBJECTIVES, START_LOCATIONS, THREAD_IDS } from './definition.js'

// 命运之线（04113）的三条线：A/B 遗物、C/D 亚历山卓、E/F 伊塔卡。
// 引擎只有一根幕游标，本关用 state.acts 的三格（每格一条线的当前幕）表示同时在场
// 的三本幕牌库；推进与「推进到场景 3…」的点名都由本章自己维护。

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const flagsFor = state => (state.scenarioFlags ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const traitsOf = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
const hasTrait = (card, trait) => traitsOf(card).some(value => String(value).toLowerCase() === trait.toLowerCase())
const clone = value => structuredClone(value)
const cardName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
const perPlayer = (state, n) => n * (state.numInvestigators || 1)
const leadSeat = state => (Number.isInteger(state.campaign?.leadSeat) ? state.campaign.leadSeat : active(state)[0]?.seat ?? 0)
const syncClues = state => { state.clues = active(state).reduce((sum, inv) => sum + (inv.clues || 0), 0) }

// 本章已逐条实现印刷效果的遭遇卡（父代理的迁移审计用）。
export const implementedEncounterCodes = [
  '01170', '01171', '01173', '01174', // 核心遭遇卡：由共享解析器处理，河岸城是中心地点
  '01169', '01172', // 祭司 / 狩猎中的夜魇：04121/04127 带出，入场毁灭与躲避负值翻倍已接
  '04122b', '04130b', '04137b',
  '04144', '04145', '04146',
  '01135', '01136',
]

// ---------------------------------------------------------------------------
// 幕牌库
// ---------------------------------------------------------------------------

function actDecks(state) { return (flagsFor(state).actDecks ||= {}) }
function deckOf(state, thread) { return actDecks(state)[thread] || null }
function actsInPlay(state) { return THREAD_IDS.map(thread => deckOf(state, thread)).filter(deck => deck && !deck.completed) }

function findAct(state, code) {
  const definition = (state.scenario?.acts || []).find(act => original(act) === code)
  return definition ? clone(definition) : null
}

function currentActOf(state, thread) {
  const deck = deckOf(state, thread)
  if (!deck) return null
  return findAct(state, deck.cards[Math.min(deck.index, deck.cards.length - 1)])
}

// 某张幕是否仍在三条线之一里（幕卡背面的持续修正常用它判定）。
export function actInPlay(state, code) {
  return THREAD_IDS.some(thread => {
    const deck = deckOf(state, thread)
    if (!deck) return false
    return deck.cards[Math.min(deck.index, deck.cards.length - 1)] === code
  })
}

// 三本幕牌库同时在场：state.acts 固定是三条线的当前幕，state.actIndex 指向焦点那条线。
export function rebuildActs(state) {
  const list = []
  for (const thread of THREAD_IDS) {
    const deck = deckOf(state, thread)
    if (!deck) continue
    const act = currentActOf(state, thread)
    if (!act) continue
    act.thread = thread
    if (deck.completed) {
      act.completed = true
      delete act.objective
    }
    list.push(act)
  }
  state.acts = list
  const focus = THREAD_IDS.indexOf(flagsFor(state).focusThread)
  state.actIndex = Math.min(Math.max(0, focus < 0 ? 0 : focus), Math.max(0, list.length - 1))
  return list
}

function sample(state, helper, list) {
  let value = 0.5
  if (typeof helper?.randomValue === 'function') value = Number(helper.randomValue(state))
  else if (typeof helper?.random === 'function') value = Number(helper.random())
  if (!Number.isFinite(value)) value = 0.5
  const index = Math.min(list.length - 1, Math.max(0, Math.floor(value * list.length)))
  return list[index]
}

// 纯函数：按战役记录与场景标记选出三本幕牌库（Haskell setupThreadsOfFate 的 sample2/分支）。
export function setupPlan(state, helper = {}) {
  const records = recordsFor(state)
  const flags = flagsFor(state)
  const gaveHarlanCustody = records.theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone === true
  const listenedToIchtaca = flags.listenedToIchtacasTale !== false
  const gotoPolice = flags.gotoPolice !== false
  const build = (first, second) => ({
    cards: [first, second, ACTS_BY_CODE[second].next], index: 0, completed: false,
  })
  return {
    gaveHarlanCustody,
    listenedToIchtaca,
    gotoPolice,
    ab: build(gaveHarlanCustody ? '04118a' : '04117a',
      gaveHarlanCustody ? sample(state, helper, ['04121', '04122']) : sample(state, helper, ['04119', '04120'])),
    cd: build(gotoPolice ? '04126a' : '04125a',
      gotoPolice ? sample(state, helper, ['04127', '04128a']) : sample(state, helper, ['04129', '04130a'])),
    ef: build(listenedToIchtaca ? '04134a' : '04133a',
      listenedToIchtaca ? sample(state, helper, ['04137a', '04138']) : sample(state, helper, ['04135', '04136'])),
  }
}

// ---------------------------------------------------------------------------
// 地点 / 遗物 / 剧情资产
// ---------------------------------------------------------------------------

function placeLocation(state, api, id) {
  const existing = state.locations.find(location => location.id === id)
  if (existing) return existing
  if (typeof api?.place === 'function') {
    api.place(id)
    const placed = state.locations.find(location => location.id === id)
    if (placed) return placed
  }
  const base = state.scenario?.locations?.[id]
  if (!base) return null
  const definition = clone(base)
  const location = {
    ...definition, id, revealed: true,
    clues: definition.cluesFixed ?? (definition.cluesPerInvestigator || 0) * (state.numInvestigators || 1),
  }
  state.locations.push(location)
  return location
}

function there(state, id) { return state.locations.find(location => location.id === id) || null }

function relic(state) { return state.relicOfAges || null }
function relicLocationId(state) {
  const card = relic(state)
  if (!card) return null
  if (card.seat != null) return state.investigators[card.seat]?.location ?? card.location ?? null
  return card.location ?? null
}
function relicCarrier(state) {
  const id = state.relicOfAges?.enemyId
  return id ? state.enemies.find(enemy => enemy.id === id) || null : null
}
function placeRelic(state, api, { location = null, seat = null, enemyId = null } = {}) {
  state.relicOfAges = { code: '04061', location, seat, ...(enemyId ? { enemyId } : {}) }
  api?.info?.(`🏺 古代遗物${enemyId ? '附属到敌人' : ''}${location ? `（「${there(state, location)?.name || location}」）` : ''}。`)
  return state.relicOfAges
}
function giveRelic(state, api, seat) {
  const inv = state.investigators[seat]
  if (!inv) return
  state.relicOfAges = { code: '04061', location: inv.location, seat }
  api?.giveAsset?.(seat, '04061')
  api?.info?.(`🏺 ${inv.name} 控制古代遗物。`)
}

function alejandro(state) { return flagsFor(state).alejandro || null }
function alejandroLocationId(state) {
  const card = alejandro(state)
  if (!card) return null
  return card.location ?? null
}
function alejandroEnemy(state) {
  const id = alejandro(state)?.enemyId
  return id ? state.enemies.find(enemy => enemy.id === id) || null : null
}
function placeAlejandro(state, api, { location = null, enemyId = null } = {}) {
  flagsFor(state).alejandro = { code: '04051', location, enemyId }
  api?.info?.(`🧭 亚历山卓·维拉${enemyId ? '被敌人带走' : `位于「${there(state, location)?.name || location}」`}。`)
}
function giveAlejandro(state, api, seat) {
  const inv = state.investigators[seat]
  if (!inv) return
  flagsFor(state).alejandro = { code: '04051', location: inv.location, seat }
  api?.giveAsset?.(seat, '04051')
  api?.info?.(`🧭 ${inv.name} 救出了亚历山卓·维拉。`)
}

function spawnBystander(state, api, code, locationId) {
  const location = placeLocation(state, api, locationId) || there(state, locationId)
  state.storyAssets ||= []
  if (state.storyAssets.some(asset => original(asset) === code)) {
    const existing = state.storyAssets.find(asset => original(asset) === code)
    if (location) existing.location = location.id
    return existing
  }
  if (typeof api?.storyAsset === 'function' && location) {
    api.storyAsset(code, location.id)
    const spawned = state.storyAssets.find(asset => original(asset) === code)
    if (spawned) { spawned.clues = 0; return spawned }
  }
  const asset = {
    id: `story-${code}`, code, originalCode: code, name: cardName(code),
    location: location?.id || null, clues: 0, exhausted: false, controllerSeat: null,
  }
  state.storyAssets.push(asset)
  api?.info?.(`🕵️ 「${asset.name}」出现在「${location?.name || '场上'}」。`)
  return asset
}

function bystander(state, code) {
  return (state.storyAssets || []).find(asset => original(asset) === code) || null
}

function removeBystander(state, code) {
  const list = state.storyAssets || []
  const index = list.findIndex(asset => original(asset) === code)
  const asset = index >= 0 ? list.splice(index, 1)[0] : null
  if (asset) state.scenarioZones?.removed?.push(code)
  return asset
}

// ---------------------------------------------------------------------------
// 距离 / 最近与最远
// ---------------------------------------------------------------------------

function nearestSeat(state, locationId, api = null) {
  const pool = active(state).filter(inv => inv.location)
  if (!pool.length) return null
  const scored = pool.map(inv => ({ seat: inv.seat, steps: distance(state, inv.location, locationId) }))
    .sort((left, right) => left.steps - right.steps || left.seat - right.seat)
  const best = scored[0]
  if (!Number.isFinite(best.steps)) return pool[0].seat
  const tied = scored.filter(entry => entry.steps === best.steps)
  if (tied.length > 1 && typeof api?.choose === 'function') {
    const answer = api.choose({
      kind: 'investigator', source: 'threadsOfFate', seat: leadSeat(state),
      prompt: '选择距离最近的调查员。',
      options: tied.map(entry => ({ id: String(entry.seat), label: state.investigators[entry.seat].name })),
    })
    const seat = Number(answer)
    if (Number.isInteger(seat) && state.investigators[seat]) return seat
  }
  return best.seat
}

function farthestLocation(state) {
  const pool = active(state).filter(inv => inv.location)
  const scored = state.locations.filter(location => location.revealed !== false).map(location => ({
    location,
    steps: pool.length ? Math.min(...pool.map(inv => distance(state, inv.location, location.id))) : 0,
  })).sort((left, right) => right.steps - left.steps || left.location.id.localeCompare(right.location.id))
  return scored[0]?.location || null
}

function farthestEnemy(state, predicate) {
  const pool = active(state).filter(inv => inv.location)
  const scored = state.enemies.filter(predicate).map(enemy => ({
    enemy,
    steps: pool.length ? Math.min(...pool.map(inv => distance(state, inv.location, enemy.location))) : 0,
  })).sort((left, right) => right.steps - left.steps || left.enemy.id.localeCompare(right.enemy.id))
  return scored[0]?.enemy || null
}

function groupCluesAt(state, locationId) {
  return active(state).filter(inv => inv.location === locationId).reduce((sum, inv) => sum + (inv.clues || 0), 0)
}

// ---------------------------------------------------------------------------
// 遭遇牌库取牌
// ---------------------------------------------------------------------------

function takeEncounterCard(state, code) {
  for (const list of [state.encounterDeck, state.encounterDiscard]) {
    if (!Array.isArray(list)) continue
    const index = list.indexOf(code)
    if (index >= 0) { list.splice(index, 1); return true }
  }
  const victory = state.victoryDisplay || []
  const index = victory.findIndex(card => original(card) === code)
  if (index >= 0) { victory.splice(index, 1); return true }
  return false
}

// 04135：从遭遇牌库顶弃牌直到弃掉一个指定特性的敌人。牌库耗尽时把弃牌堆洗回
// 牌库继续弃（卡面是「直到弃掉一个异教徒敌人」，不是「牌库顶若干张里找」）。
function discardUntilTrait(state, trait) {
  const discarded = []
  let guard = 0
  const ceiling = (state.encounterDeck.length + (state.encounterDiscard || []).length) * 2 + 8
  while (guard++ < ceiling) {
    if (!state.encounterDeck.length) {
      // 本次已弃的牌全部进弃牌堆，再把弃牌堆洗回牌库继续。
      state.encounterDiscard.push(...discarded.splice(0))
      if (!state.encounterDiscard.length) return null
      state.encounterDeck = shuffleWith(state, state.encounterDiscard.splice(0))
      continue
    }
    const code = state.encounterDeck.pop()
    const definition = state.scenario.enemies?.[code]
    if (definition && (definition.traits || []).some(value => String(value).toLowerCase() === trait)) {
      state.encounterDiscard.push(...discarded)
      return code
    }
    discarded.push(code)
  }
  state.encounterDiscard.push(...discarded)
  return null
}

// ---------------------------------------------------------------------------
// 幕揭示（卡面背面）
// ---------------------------------------------------------------------------

function ensureTownHall(state, api) {
  const existing = there(state, 'townHall')
  if (existing) return existing
  const placed = placeLocation(state, api, 'townHall')
  if (placed) { placed.clues = placed.clues || perPlayer(state, 1); api?.reveal?.(placed.id) }
  return placed
}

function rememberPrey(state, enemy) {
  if (!enemy) return
  const flags = flagsFor(state)
  flags.ichtacasPrey ||= []
  if (!flags.ichtacasPrey.includes(enemy.id)) flags.ichtacasPrey.push(enemy.id)
  // 04140 背面要「离玛利亚最近」：猎物推进时必然已离场，只能靠记录下来的
  // 敌人卡号与最后所在地点选人，所以生成/移动时都要维护这两个映射。
  flags.ichtacasPreyCodes ||= {}
  flags.ichtacasPreyCodes[enemy.id] = original(enemy)
  flags.ichtacasPreyLocations ||= {}
  flags.ichtacasPreyLocations[enemy.id] = enemy.location
}

function rememberDestination(state, locationId) {
  const flags = flagsFor(state)
  flags.ichtacasDestinations ||= []
  if (!flags.ichtacasDestinations.includes(locationId)) flags.ichtacasDestinations.push(locationId)
}

function giveIchtaca(state, api, locationId) {
  const seat = nearestSeat(state, locationId, api)
  if (seat == null) return
  const inv = state.investigators[seat]
  const list = state.storyAssets || []
  const index = list.findIndex(asset => original(asset) === '04147')
  if (index >= 0) list.splice(index, 1)
  api?.giveAsset?.(seat, '04147')
  api?.info?.(`🐍 ${inv.name} 得到伊塔卡（失落的守卫者）。`)
}

// 04145「屋中无人」的强制：所附属地点没有线索时立即弃掉，并回退它加的额外调查行动。
// 线索被发现的即时路径走 cluesRemoved 钩子；其它直接改 clues 的效果由 roundEnded 兜底。
function discardNobodyHomeAt(state, location, api) {
  if (!location || (location.clues || 0) > 0) return 0
  const copies = (location.attachments || []).filter(entry => original(entry) === '04145')
  if (!copies.length) return 0
  location.attachments = (location.attachments || []).filter(entry => original(entry) !== '04145')
  location.investigateExtraActions = Math.max(0, (location.investigateExtraActions || 0) - copies.length)
  for (const _copy of copies) state.encounterDiscard.push('04145')
  api?.info?.(`🏚️ 「${location.name}」已无线索，弃掉「屋中无人」。`)
  return copies.length
}

function discardTopEncounterAndMaybeDraw(state, inv, api) {
  if (!state.encounterDeck.length) return
  const code = state.encounterDeck.pop()
  if (state.scenario.treacheries?.[code]) {
    // 卡面：弃掉一张后「必须抽取该卡牌」——把它放回牌库顶并按遭遇牌结算，
    // 而不是塞进威胁区。
    state.encounterDeck.push(code)
    api?.drawEncounter?.(inv.seat)
    api?.info?.(`${inv.name} 弃掉并结算了遭遇牌「${cardName(code)}」。`)
    return
  }
  state.encounterDiscard.push(code)
}

function runActReveal(state, act, api = {}) {
  const code = original(act)
  const flags = flagsFor(state)
  const records = recordsFor(state)
  switch (code) {
    // ---- A/B：遗物 ----
    case '04117a': {
      const exhibit = placeLocation(state, api, 'eztliExhibit')
      if (exhibit) api.reveal?.(exhibit.id)
      break
    }
    case '04118a': {
      spawnBystander(state, api, '04118b', 'easttown')
      break
    }
    case '04119': {
      const existing = there(state, 'townHall')
      const hall = ensureTownHall(state, api)
      if (existing) hall.clues = (hall.clues || 0) + perPlayer(state, 1)
      if (actsInPlay(state).length <= 2) hall.clues = (hall.clues || 0) + perPlayer(state, 1)
      placeRelic(state, api, { location: hall.id })
      break
    }
    case '04120': {
      // 卡面：查找遭遇牌库、弃牌堆、胜利区，找出一张兄弟会异教徒并生成在最远地点。
      // 即使场上已有一张，也要继续从这三个区域找另一张（副本共 2 张）。
      if (takeEncounterCard(state, '04095')) {
        const location = farthestLocation(state)
        if (location) api.spawn?.('04095', location.id)
      }
      for (const enemy of state.enemies.filter(entry => original(entry) === '04095')) enemy.damageTaken = 0
      const target = farthestEnemy(state, entry => original(entry) === '04095')
      if (target) {
        placeRelic(state, api, { location: target.location, enemyId: target.id })
        if (actsInPlay(state).length <= 2) target.doom = (target.doom || 0) + 1
      }
      break
    }
    case '04121': {
      const shoppe = placeLocation(state, api, 'curiositieShoppe')
      placeRelic(state, api, { location: shoppe?.id || 'curiositieShoppe' })
      if (actsInPlay(state).length <= 2) {
        const count = (state.numInvestigators || 1) >= 3 ? 2 : 1
        for (let index = 0; index < count; index++) {
          if (!takeEncounterCard(state, '01169')) break
          api.spawn?.('01169', shoppe?.id || 'curiositieShoppe')
        }
      }
      break
    }
    case '04122': {
      const asset = removeBystander(state, '04118b')
      const locationId = asset?.location || 'easttown'
      const enemy = api.spawn?.('04122b', locationId)
      const target = enemy || state.enemies.find(entry => original(entry) === '04122b')
      if (target) placeRelic(state, api, { location: target.location, enemyId: target.id })
      break
    }
    case '04123': {
      const locationId = relicLocationId(state)
      const seat = nearestSeat(state, locationId, api)
      if (seat != null) giveRelic(state, api, seat)
      break
    }
    case '04124': {
      const locationId = relicCarrier(state)?.location || relicLocationId(state)
      const seat = nearestSeat(state, locationId, api)
      if (seat != null) giveRelic(state, api, seat)
      break
    }
    // ---- C/D：亚历山卓 ----
    case '04125a': {
      spawnBystander(state, api, '04125b', 'velmasDiner')
      break
    }
    case '04126a': {
      const station = placeLocation(state, api, 'arkhamPoliceStation')
      if (station) api.reveal?.(station.id)
      break
    }
    case '04127': {
      // 卡面：查找所有场上和场外区域找出一个狩猎中的夜魇，并生成在最远地点。
      // 已在场时「生成」表现为把它移到最远地点（而不是忽略它）。
      const inPlay = state.enemies.find(enemy => original(enemy) === '01172')
      if (inPlay) {
        const location = farthestLocation(state)
        if (location && location.id !== inPlay.location) api.moveEnemy?.(inPlay, location.id)
      } else if (takeEncounterCard(state, '01172')) {
        const location = farthestLocation(state)
        if (location) api.spawn?.('01172', location.id)
      }
      for (const enemy of state.enemies.filter(entry => original(entry) === '01172')) enemy.damageTaken = 0
      const target = farthestEnemy(state, entry => original(entry) === '01172')
      if (target) {
        placeAlejandro(state, api, { location: target.location, enemyId: target.id })
        // 04127 背面没有「放毁灭」这一条（那是 04120 的文本），不要多加。
      }
      break
    }
    case '04128a': {
      const tracks = placeLocation(state, api, 'trainTracks')
      if (tracks) api.reveal?.(tracks.id)
      placeAlejandro(state, api, { location: tracks?.id || 'trainTracks' })
      break
    }
    case '04129': {
      const hall = ensureTownHall(state, api)
      placeAlejandro(state, api, { location: hall?.id || 'townHall' })
      break
    }
    case '04130a': {
      const asset = removeBystander(state, '04125b')
      const locationId = asset?.location || 'velmasDiner'
      const enemy = api.spawn?.('04130b', locationId)
      const target = enemy || state.enemies.find(entry => original(entry) === '04130b')
      if (target) placeAlejandro(state, api, { location: target.location, enemyId: target.id })
      break
    }
    case '04131': {
      const locationId = alejandroLocationId(state)
      const seat = nearestSeat(state, locationId, api)
      if (seat != null) giveAlejandro(state, api, seat)
      break
    }
    case '04132': {
      const locationId = alejandroEnemy(state)?.location || alejandroLocationId(state)
      const seat = nearestSeat(state, locationId, api)
      if (seat != null) giveAlejandro(state, api, seat)
      break
    }
    // ---- E/F：伊塔卡 ----
    case '04133a': {
      const cave = placeLocation(state, api, 'blackCave')
      if (cave) api.reveal?.(cave.id)
      break
    }
    case '04134a': {
      spawnBystander(state, api, '04134b', 'curiositieShoppe')
      break
    }
    case '04135': {
      api.shuffleDiscard?.()
      const times = actsInPlay(state).length <= 2 ? 2 : 1
      for (let index = 0; index < times; index++) {
        const code = discardUntilTrait(state, 'cultist')
        if (!code) break
        const enemy = api.spawn?.(code, 'blackCave')
        rememberPrey(state, enemy || state.enemies.find(entry => original(entry) === code))
      }
      break
    }
    case '04136': {
      const hall = ensureTownHall(state, api)
      const cave = there(state, 'blackCave')
      if (hall) rememberDestination(state, hall.id)
      if (hall && cave) {
        if (!cave.connections.includes(hall.id)) cave.connections.push(hall.id)
        if (!hall.connections.includes(cave.id)) hall.connections.push(cave.id)
      }
      for (const inv of active(state)) discardTopEncounterAndMaybeDraw(state, inv, api)
      break
    }
    case '04137a': {
      const asset = removeBystander(state, '04134b')
      const locationId = asset?.location || 'curiositieShoppe'
      const enemy = api.spawn?.('04137b', locationId)
      const target = enemy || state.enemies.find(entry => original(entry) === '04137b')
      rememberPrey(state, target)
      break
    }
    case '04138': {
      rememberDestination(state, 'downtown')
      rememberDestination(state, 'rivertown')
      for (const inv of active(state)) discardTopEncounterAndMaybeDraw(state, inv, api)
      break
    }
    case '04139': {
      const destinations = flags.ichtacasDestinations || []
      const locationId = destinations.includes('townHall') ? 'townHall' : 'rivertown'
      giveIchtaca(state, api, locationId)
      break
    }
    case '04140': {
      // 目标达成时所有猎物都已离场（玛利亚也不例外），只能靠 rememberPrey/enemyMoved
      // 记下的卡号与最后地点选「离玛利亚最近的调查员」；否则走卡面的幽暗洞穴分支。
      const codes = flags.ichtacasPreyCodes || {}
      const locations = flags.ichtacasPreyLocations || {}
      const preyList = flags.ichtacasPrey || []
      const mariaId = preyList.find(id => codes[id] === '04137b')
        || preyList.find(id => state.enemies.some(enemy => enemy.id === id && original(enemy) === '04137b'))
      const locationId = (mariaId && (state.enemies.find(enemy => enemy.id === mariaId)?.location || locations[mariaId]))
        || 'blackCave'
      giveIchtaca(state, api, locationId)
      break
    }
    default:
      throw new Error(`未知命运之线幕：${code}`)
  }
  // 卡面「将剩余的“x/y”场景牌库从游戏中移除」。
  completeActStep(state, act, api)
  records.lastCompletedAct = code
}

function completeActStep(state, act, api) {
  const thread = act.thread || ACTS_BY_CODE[original(act)]?.thread
  const deck = deckOf(state, thread)
  if (!deck) return
  const table = ACTS_BY_CODE[original(act)] || {}
  if (table.next == null) {
    if (!deck.completed) {
      deck.completed = true
      state.scenarioZones ||= {}
      state.scenarioZones.removed ||= []
      for (const code of deck.cards) {
        if (!state.scenarioZones.removed.includes(code)) state.scenarioZones.removed.push(code)
      }
      api?.info?.(`📕 「${thread.toUpperCase()}」线三幕全部完成，剩余的幕牌库移出游戏。`)
    }
  } else {
    deck.index = Math.min(deck.index + 1, deck.cards.length - 1)
  }
  flagsFor(state).focusThread = thread
  if (deck.completed) {
    const next = THREAD_IDS.find(id => {
      const other = deckOf(state, id)
      return other && !other.completed
    })
    if (next) flagsFor(state).focusThread = next
  }
  rebuildActs(state)
  if (THREAD_IDS.every(id => deckOf(state, id)?.completed)) api?.finish?.('r1')
}

// ---------------------------------------------------------------------------
// 幕目标判定（引擎只管「共同支付线索」，其余卡面目标在这里推进）
// ---------------------------------------------------------------------------

function objectiveMet(state, spec) {
  const flags = flagsFor(state)
  if (spec.kind === 'bystanderClues') {
    const asset = bystander(state, spec.asset)
    return Boolean(asset) && (asset.clues || 0) >= (state.numInvestigators || 1)
  }
  if (spec.kind === 'relicLocationEmpty') {
    const locationId = relicLocationId(state)
    const location = locationId ? there(state, locationId) : null
    return Boolean(location) && (location.clues || 0) === 0
  }
  if (spec.kind === 'relicCarrierLeftPlay') {
    if (relic(state)?.seat != null) return true
    const carrierId = relic(state)?.enemyId
    return Boolean(carrierId) && !state.enemies.some(enemy => enemy.id === carrierId)
  }
  if (spec.kind === 'alejandroLocationEmpty') {
    const locationId = alejandroLocationId(state)
    const location = locationId ? there(state, locationId) : null
    return Boolean(location) && (location.clues || 0) === 0
  }
  if (spec.kind === 'alejandroCarrierLeftPlay') {
    if (alejandro(state)?.seat != null) return true
    const carrierId = alejandro(state)?.enemyId
    return Boolean(carrierId) && !state.enemies.some(enemy => enemy.id === carrierId)
  }
  if (spec.kind === 'caveClues') {
    const cave = there(state, spec.at)
    if (!cave || (cave.clues || 0) > 0) return false
    return groupCluesAt(state, cave.id) >= perPlayer(state, spec.per)
  }
  if (spec.kind === 'destinationsEmpty') {
    const list = flags.ichtacasDestinations || []
    return list.length > 0 && list.every(id => {
      const location = there(state, id)
      return Boolean(location) && (location.clues || 0) === 0
    })
  }
  if (spec.kind === 'preyGone') {
    // 「所有猎物均不在场」在空集上为真（例如 04135 弃牌没找到教众的边界）。
    const list = flags.ichtacasPrey || []
    return !state.enemies.some(enemy => list.includes(enemy.id))
  }
  return false
}

function payActCost(state, spec, api) {
  if (spec.kind === 'bystanderClues') {
    const asset = bystander(state, spec.asset)
    if (asset) asset.clues = 0
    return
  }
  if (spec.kind !== 'caveClues') return
  let remaining = perPlayer(state, spec.per)
  for (const inv of active(state).filter(entry => entry.location === spec.at)) {
    if (!remaining) break
    const pay = Math.min(remaining, inv.clues || 0)
    if (!pay) continue
    inv.clues -= pay
    remaining -= pay
  }
  syncClues(state)
  api?.info?.(`🌑 在「${there(state, spec.at)?.name || spec.at}」共同支付 ${perPlayer(state, spec.per)} 个线索。`)
}

// ---------------------------------------------------------------------------
// 行为
// ---------------------------------------------------------------------------

export const behavior = {
  ...encounterRules,
  id: 'threadsOfFate',
  implementedEncounterCodes,

  setupPlan,

  rebuildActs,

  preScenarioSetup(state, events, api) {
    const flags = flagsFor(state)
    const records = recordsFor(state)
    // 04113 布置三选一（P2）：A/B 线由幕间二的遗物保管记录决定；C/D「去警局 / 自己找」
    // 与 E/F「听伊塔卡的故事」以前写死为 true，现在必须由玩家选择。
    if (flags.gotoPolice === undefined) {
      const answer = api?.choose?.({
        kind: 'story', source: '04113', seat: state.campaign?.leadSeat ?? 0,
        prompt: '布置：你们去阿卡姆警察局报案，还是不惊动警方自己追查？',
        options: [
          { id: 'police', label: '去阿卡姆警察局报案（C/D 线：警局）' },
          { id: 'own', label: '不惊动警方，自己追查（C/D 线：自己找）' },
        ],
      })
      flags.gotoPolice = answer !== 'own'
      api?.info?.(flags.gotoPolice ? '🏛️ 调查员决定去阿卡姆警察局报案。' : '🕵️ 调查员决定不惊动警方，自己追查。')
    }
    if (flags.listenedToIchtacasTale === undefined) {
      const answer = api?.choose?.({
        kind: 'story', source: '04113', seat: state.campaign?.leadSeat ?? 0,
        prompt: '布置：伊塔卡愿意讲述她同胞的故事，你们要听吗？',
        options: [
          { id: 'listen', label: '听她讲（E/F 线：守卫者追根究底）' },
          { id: 'refuse', label: '不听（E/F 线：女猎手的苦旅）' },
        ],
      })
      flags.listenedToIchtacasTale = answer !== 'refuse'
      api?.info?.(flags.listenedToIchtacasTale ? '📖 调查员听完了伊塔卡的故事。' : '🤐 调查员没有听伊塔卡的故事。')
    }
    if (flags.forgingOwnWay === undefined) flags.forgingOwnWay = false
    if (flags.gaveHarlanCustody === undefined) {
      flags.gaveHarlanCustody = records.theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone === true
    }
    // 序章「小心行事」分支：只有哈伦保管遗物时才会被问到。
    if (flags.forgingOwnWay && flags.gaveHarlanCustody) {
      records.youAreForgingYourOwnWay = true
      api?.info?.('你们决定自己走一条路：记录「你正在开辟自己的道路」。')
    }
  },

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    const flags = flagsFor(state)
    flags.actDecks = { ab: plan.ab, cd: plan.cd, ef: plan.ef }
    flags.focusThread = 'ab'
    flags.gaveHarlanCustody = plan.gaveHarlanCustody
    flags.listenedToIchtacasTale = plan.listenedToIchtaca
    flags.gotoPolice = plan.gotoPolice
    flags.ichtacasPrey = []
    flags.ichtacasDestinations = []
    flags.usedAbilities = {}
    flags.alejandro = null
    flags.harbingerEnteredPlay = false
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = ['04143', '04051', '04061', '04147', '04148']
    state.scenarioZones.removed = []
    state.relicOfAges = { code: '04061', location: null, seat: null, setAside: true }
    state.storyAssets ||= []
    rebuildActs(state)
    return [...START_LOCATIONS]
  },

  setupEnemies() {
    // 开场没有敌人：哈伦／亨利／玛利亚只会在幕背面进场。
  },

  // 阿卡姆市区的地点一律正面朝上入场（印刷地图上的地点本来就全部可见）。
  locationsStartRevealed: true,

  afterChaosBagSetup(state, events) {
    const flags = flagsFor(state)
    if (flags.listenedToIchtacasTale) {
      try { changeChaosBag(state, 'cultist', 1) } catch { /* 独立剧本没有异教徒标记来源 */ }
    }
    if (flags.forgingOwnWay && flags.gaveHarlanCustody) {
      for (const token of ['cultist', 'tablet']) {
        const count = (state.chaosBag || []).filter(entry => entry === token).length
        if (count) changeChaosBag(state, token, -count)
      }
      changeChaosBag(state, 'elderthing', 1)
    }
  },

  actReveal(state, act, api) { runActReveal(state, act, api) },

  // 引擎 advanceAct 在 actReveal 后还会 ++ 一次 actIndex；命运之线的幕牌库
  // 已由 completeActStep/rebuildActs 重算，这里直接返回重算后的索引。
  actIndexAfterAdvance(state) {
    rebuildActs(state)
    return state.actIndex
  },

  agendaReveal(state, agenda, api) {
    // 第 118 轮：04114 / 04115 / 04116 的背面在密谋条目（幕牌库计数与章节同源）。
    const entry = agendaRuleFor(original(agenda))
    if (entry?.onReveal) { entry.onReveal(state, agenda, api); return }
    throw new Error(`未知命运之线密谋：${original(agenda)}`)
  },

  // 04146：附着在密谋上的「鲜血阴谋」随宿主离场进遭遇弃牌堆（之后可被重新洗回）。
  agendaLeftPlay(state, agenda, api) {
    const attachments = agenda?.attachments || []
    if (!attachments.length) return
    for (const attachment of attachments) {
      const code = typeof attachment === 'string' ? attachment : original(attachment)
      if (code) state.encounterDiscard.push(code)
    }
    agenda.attachments = []
    api?.info?.('📜 密谋离场：其上的附着卡进入遭遇弃牌堆。')
  },

  checkObjectives(state, api) {
    if (state.status !== 'playing') return
    for (const thread of THREAD_IDS) {
      const deck = deckOf(state, thread)
      if (!deck || deck.completed) continue
      const act = currentActOf(state, thread)
      if (!act) continue
      const code = original(act)
      const spec = SPECIAL_ACT_OBJECTIVES[code]
      if (!spec) continue
      if (!objectiveMet(state, spec)) continue
      payActCost(state, spec, api)
      flagsFor(state).focusThread = thread
      runActReveal(state, act, api)
      rebuildActs(state)
      return
    }
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 04145「屋中无人」的强制兜底（线索被直接改写、没走 cluesRemoved 的路径）。
    for (const location of state.locations || []) discardNobodyHomeAt(state, location, api)
  },

  // 04145「屋中无人」：最后一个线索被发现时立即弃掉（卡面是强制，不是轮末）。
  cluesRemoved(state, location, amount, api) {
    if (!location || (location.clues || 0) > 0) return
    discardNobodyHomeAt(state, location, api)
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    if (inv.location === 'blackCave' && !inv.defeated && !inv.resigned) {
      const answer = api.choose?.({
        kind: 'harm', source: '04133b', seat: inv.seat,
        prompt: '幽暗洞穴：受到 1 点恐惧，或弃掉 2 张手牌。',
        options: [{ id: 'horror', label: '受到 1 点恐惧' }, { id: 'discard', label: '弃掉 2 张手牌' }],
      })
      const choice = answer ?? 'horror'
      if (choice === 'discard' && (inv.hand || []).length) api.discardChosen(inv.seat, 2, '04133b')
      else api.horror(inv.seat, 1)
    }
  },

  locationEntered(state, inv, location, api) {
    if (!location) return
    if (original(location) === '04143' && (inv.hand || []).length >= 4) {
      api.discardChosen?.(inv.seat, (inv.hand || []).length - 3, '04143')
      api.info?.('市政厅：手牌超过 3 张，弃到只剩 3 张。')
    }
  },

  locationRevealed(state, location, api) {
    if (original(location) === '04128b' && !alejandro(state)) {
      placeAlejandro(state, api, { location: location.id })
    }
    if (original(location) === '04128b' && alejandro(state)) {
      flagsFor(state).focusThread = 'cd'
    }
  },

  afterTest(state, inv, result, api) {
    tfaChaosAfterTest('threadsOfFate', state, inv, result, api)
    encounterRules.afterTest?.(state, inv, result, api)
    const tokens = (result?.drawn || []).filter(token => !(result?.cancelledTokens || []).includes(token))
    const horrid = ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].some(token => tokens.includes(token))
    const location = here(state, inv)
    if (location && original(location) === '04117b' && horrid && result?.source?.label === '调查') {
      api.horror(inv.seat, 1)
    }
  },

  afterEvade(state, inv, enemy, result, api) {
    encounterRules.afterEvade?.(state, inv, enemy, result, api)
    if (original(enemy) !== '04122b') return
    if (!result?.success) return
    if ((result.value ?? 0) - (result.difficulty ?? 0) < 3) return
    const index = state.enemies.indexOf(enemy)
    if (index >= 0) state.enemies.splice(index, 1)
    inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
    state.victoryDisplay ||= []
    state.victoryDisplay.push({
      id: enemy.id, code: '04122b', originalCode: '04122b', name: enemy.name, victory: enemy.victory || 1,
    })
    api.info?.('🕵️ 哈伦·恩斯通被成功躲避超过 3 点，加入胜利区。')
  },

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken('threadsOfFate', state, inv, token, api)
  },

  enemySpawned(state, enemy, api) {
    // 第 118 轮：04062 / 04122b / 04130b / 04137b 的生成脚本在敌人条目的 enemyScript.onSpawn。
    encounterRules.enemySpawned?.(state, enemy, api)
  },

  // 附属敌人的「所在地点」：04124/04132 背面在敌人离场后仍要按它最后所在的地点选最近
  // 调查员，而 04095/01172 都带猎手会移动，所以每次移动都要刷新记录的地点。
  enemyMoved(state, enemy, previous, api) {
    if (!enemy) return
    const flags = flagsFor(state)
    if (state.relicOfAges?.enemyId === enemy.id) state.relicOfAges.location = enemy.location
    if (flags.alejandro?.enemyId === enemy.id) flags.alejandro.location = enemy.location
    if ((flags.ichtacasPrey || []).includes(enemy.id)) {
      flags.ichtacasPreyLocations ||= {}
      flags.ichtacasPreyLocations[enemy.id] = enemy.location
    }
  },

  enemyStatModifier(state, enemy, stat) {
    let value = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    const flags = flagsFor(state)
    const prey = flags.ichtacasPrey || []
    if (prey.includes(enemy.id) && (stat === 'fight' || stat === 'evade') && actInPlay(state, '04140')) {
      const location = there(state, enemy.location)
      if (location && (location.clues || 0) === 0) value += 1
    }
    // P2：生命值修正（引擎 enemyStatModifier('health') 分支）。
    if (stat === 'health') {
      // 04124 / 04132：古代遗物或亚历山卓附属的敌人 +2×调查员数生命。
      // 只在对应幕在场时生效（「古代遗物附属到一个敌人时」是 04124 的持续文本）。
      if (actInPlay(state, '04124') && relicCarrier(state)?.id === enemy.id) {
        value += 2 * (state.numInvestigators || 1)
      }
      if (actInPlay(state, '04132') && alejandroEnemy(state)?.id === enemy.id) {
        value += 2 * (state.numInvestigators || 1)
      }
      // 04140：伊塔卡的猎物在无线索地点时 +1×调查员数生命（战斗/躲避 +1 见上）。
      if (prey.includes(enemy.id) && actInPlay(state, '04140')) {
        const location = there(state, enemy.location)
        if (location && (location.clues || 0) === 0) value += state.numInvestigators || 1
      }
    }
    return value
  },

  locationShroudModifier(state, location) {
    let value = encounterRules.locationShroudModifier?.(state, location) || 0
    const relicHere = relicLocationId(state)
    if (relicHere && location.id === relicHere && actInPlay(state, '04123')) value += 2
    const alejandroHere = alejandroLocationId(state)
    if (alejandroHere && location.id === alejandroHere && actInPlay(state, '04131')) value += 2
    return value
  },

  // 04139 怪事丛生：位于「伊塔卡的目的地」时，每轮从遭遇牌库抽出的第一张诡计获得涌动。
  encounterGainsSurge(state, code, inv) {
    if (!inv || !actInPlay(state, '04139')) return false
    const destinations = flagsFor(state).ichtacasDestinations || []
    if (!destinations.includes(inv.location)) return false
    if (inv.tfaSurgeRound === state.round) return false
    inv.tfaSurgeRound = state.round
    return true
  },

  resolveEncounter(state, inv, treachery, api) {
    // 第 118 轮：04144 / 04145 / 04146 / 01135 / 01136 的显现结算在遭遇条目
    // （encounterResolveCampaigns: ['tfa']，不会截胡其它战役的同号卡）。
    return encounterRules.resolveEncounter(state, inv, treachery, api)
  },

  encounterActions(state, inv) {
    const moves = encounterRules.encounterActions?.(state, inv) || []
    return moves
  },

  performEncounterAction(state, inv, move, api) {
    return encounterRules.performEncounterAction?.(state, inv, move, api)
  },

  actions(state, inv) {
    const moves = []
    if (state.agendas?.[state.agendaIndex]) {
      moves.push({ action: 'scenarioAction', rule: 'resignAgenda', label: '🚪 撤退：带着搜集到的信息安全返回' })
    }
    const used = flagsFor(state).usedAbilities || (flagsFor(state).usedAbilities = {})
    // 第 118 轮：04141 小餐馆 / 04126b 警局 / 04128b 火车轨道的行动在地点条目。
    locationRuleFor(original(here(state, inv)))?.actions?.({ state, inv, location: here(state, inv), moves })
    // 旁人资产的谈判行动（卡面：[action] 弃牌/花钱 → 检定 → 在其上放置 1 个线索）。
    const parleys = {
      '04118b': { rule: 'parleyHarlan', label: '🗣️ 谈判：弃牌库顶 3 张，检定意志(4) 让哈伦清醒', skill: 'willpower', difficulty: 4 },
      '04125b': { rule: 'parleyHenry', label: '🗣️ 谈判：弃 1 张手牌，检定智识(3) 问出亚历山卓的下落', skill: 'intellect', difficulty: 3 },
      '04134b': { rule: 'parleyMaria', label: '🗣️ 谈判：花费 1 资源，检定智识(3) 套玛利亚的话', skill: 'intellect', difficulty: 3 },
    }
    for (const [assetCode, spec] of Object.entries(parleys)) {
      const asset = bystander(state, assetCode)
      if (asset && asset.location === inv.location) {
        moves.push({ action: 'scenarioAction', rule: spec.rule, assetCode, label: spec.label })
      }
    }
    const agenda = state.agendas?.[state.agendaIndex]
    if (agenda?.attachments?.some(item => original(item) === '04146')) {
      for (const enemy of state.enemies.filter(entry => entry.location === inv.location && hasTrait(entry, 'Cultist'))) {
        moves.push({
          action: 'scenarioAction', rule: 'parleyConspiracy', enemyId: enemy.id,
          label: `🗣️ 谈判：对「${enemy.name}」检定意志(4) 弃掉鲜血阴谋`,
        })
      }
    }
    for (const thread of THREAD_IDS) {
      const deck = deckOf(state, thread)
      if (!deck || deck.completed || thread === flagsFor(state).focusThread) continue
      moves.push({
        action: 'scenarioAction', rule: 'focusAct', actions: 0, thread,
        label: `🎯 切换当前幕：${thread.toUpperCase()} 线`,
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'resignAgenda') {
      api.resign(inv.seat)
      return
    }
    if (move.rule === 'focusAct') {
      flagsFor(state).focusThread = move.thread
      rebuildActs(state)
      api.info?.(`🎯 当前幕切换到 ${String(move.thread).toUpperCase()} 线。`)
      return
    }
    if (move.rule === 'velmasGossip') {
      const flags = flagsFor(state)
      flags.usedAbilities ||= {}
      flags.usedAbilities.velmasDiner = true
      api.gainClues(inv.seat, 2)
      return
    }
    if (move.rule === 'policeSearchWeapon') {
      const top = (inv.deck || []).slice(-6).reverse()
      const keep = (inv.deck || []).slice(0, Math.max(0, (inv.deck || []).length - top.length))
      const weapons = top.filter(code => (ALL_CARDS[code]?.traits || []).includes('Weapon'))
      if (!weapons.length) {
        // 卡面「混洗你的牌库」：没找到也要洗整副牌，而不是只洗搜索过的 6 张。
        inv.deck = shuffleWith(state, [...keep, ...top])
        api.info?.('牌库顶 6 张里没有武器。')
        return
      }
      // 有多张武器时由玩家选择，且只拿走一张（同名的第二张留在牌库里重洗）。
      let chosen = weapons[0]
      if (weapons.length > 1 && typeof api.choose === 'function') {
        const answer = api.choose({
          kind: 'card', source: '04126b', seat: inv.seat,
          prompt: '选择要加入手牌的武器。',
          options: weapons.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })),
        })
        chosen = weapons[Number(answer)] || weapons[0]
      }
      const rest = [...top]
      rest.splice(rest.indexOf(chosen), 1)
      inv.deck = shuffleWith(state, [...keep, ...rest])
      inv.hand.push(chosen)
      api.info?.(`找到武器「${cardName(chosen)}」。`)
      return
    }
    if (move.rule === 'trainTracksDraw') {
      if ((inv.clues || 0) < 1) {
        api.info?.('火车轨道：需要先有 1 个线索。')
        return
      }
      inv.clues -= 1
      syncClues(state)
      const flags = flagsFor(state)
      flags.usedAbilities ||= {}
      flags.usedAbilities.trainTracks = true
      api.drawCards(inv.seat, 4)
      return
    }
    if (move.rule === 'parleyConspiracy') {
      const enemy = state.enemies.find(entry => entry.id === move.enemyId)
      if (!enemy) return
      api.test(inv.seat, 'willpower', 4, result => {
        if (result.success) {
          const agenda = state.agendas?.[state.agendaIndex]
          if (agenda?.attachments) {
            const index = agenda.attachments.findIndex(item => original(item) === '04146')
            if (index >= 0) {
              agenda.attachments.splice(index, 1)
              agenda.doomThreshold = (agenda.doomThreshold || 0) + 1
              state.encounterDiscard.push('04146')
            }
          }
          return
        }
        enemy.doom = (enemy.doom || 0) + 1
      })
      return
    }
    if (move.rule === 'parleyHarlan' || move.rule === 'parleyHenry' || move.rule === 'parleyMaria') {
      const asset = bystander(state, move.assetCode)
      if (!asset) return
      if (move.rule === 'parleyHarlan') api.discardTop(inv.seat, 3)
      if (move.rule === 'parleyHenry') {
        if (!(inv.hand || []).length) {
          api.info?.('谈判：没有手牌可弃，这次行动没有效果。')
          return
        }
        api.discardChosen(inv.seat, 1, '04125b')
      }
      if (move.rule === 'parleyMaria') {
        if ((inv.resources || 0) < 1) {
          api.info?.('谈判：资源不足，这次行动没有效果。')
          return
        }
        inv.resources -= 1
      }
      const skill = move.rule === 'parleyHarlan' ? 'willpower' : 'intellect'
      const difficulty = move.rule === 'parleyHarlan' ? 4 : 3
      api.test(inv.seat, skill, difficulty, result => {
        if (!result.success) return
        asset.clues = (asset.clues || 0) + 1
        api.info?.(`「${asset.name}」上放置 1 个线索（${asset.clues}/${state.numInvestigators}）。`)
      })
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知命运之线行动：${move.rule}`)
  },

  canExplore(state, inv) {
    return encounterRules.canExplore(state, inv)
  },

  movementError(state, inv) {
    return encounterRules.movementError?.(state, inv) || null
  },

  storyResolutionKey(state, key) { return key },

  resolution(state, key, events, api = {}) {
    if (!['noResolution', 'r1'].includes(key)) throw new Error(`未知命运之线结局：${key}`)
    const decks = actDecks(state)
    const abDone = decks.ab?.completed === true
    const cdDone = decks.cd?.completed === true
    const efDone = decks.ef?.completed === true
    const records = recordsFor(state)
    // 显式写记录键（不用计算键）：审计脚本与人工核对都直接看得到写入者。
    if (abDone) records.theInvestigatorsFoundTheMissingRelic = true
    else records.theRelicIsMissing = true
    if (cdDone) records.theInvestigatorsRescuedAlejandro = true
    else records.alejandroIsMissing = true
    if (efDone) records.theInvestigatorsForgedABondWithIchtaca = true
    else records.ichtacaIsInTheDark = true

    // 瓦卢西亚的预示者（04062）：从上一章带进来的战役卡；只要它进过场就更新记录。
    const harbingerCode = '04062'
    const inPlay = state.enemies.find(enemy => original(enemy) === harbingerCode)
    const inVictory = (state.victoryDisplay || []).find(card => original(card) === harbingerCode)
    if (inPlay) {
      records.theHarbingerIsAlive = true
      records.theHarbingerIsStillAlive = inPlay.damageTaken || 0
    } else if (inVictory) {
      records.theHarbingerIsAlive = false
      records.theHarbingerIsStillAlive = 0
    } else if (flagsFor(state).harbingerEnteredPlay) {
      records.theHarbingerIsAlive = true
      records.theHarbingerIsStillAlive = 0
    }

    const forging = records.youAreForgingYourOwnWay === true
    const extra = {}
    if (abDone) extra.relicOfAges = true
    if (cdDone && !forging) extra.alejandroVela = true
    if (efDone && !forging) extra.ichtaca = true
    extra.expeditionJournal = true
    grantCampaignCards(state, api, extra)
    flagsFor(state).campaignRewards = { ...(flagsFor(state).campaignRewards || {}), ...extra }

    const advanced = THREAD_IDS.filter(thread => {
      const deck = decks[thread]
      return deck && (deck.completed || deck.index > 0)
    }).length
    return { award: true, bonus: advanced }
  },
}

function shuffleWith(state, list) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(randomValue(state) * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

// 战役卡加入调查员牌库（下一关起生效）：古代遗物 / 亚历山卓 / 伊塔卡 / 探险日志。
// 伊塔卡与探险日志是「一位调查员」的奖励：多人时由队长选择，不再复制给所有人。
function grantCampaignCards(state, api, rewards) {
  const codes = []
  if (rewards.relicOfAges) codes.push('04061')
  if (rewards.alejandroVela) codes.push('04051')
  if (rewards.ichtaca) codes.push('04147')
  if (rewards.expeditionJournal) codes.push('04148')
  const activeSeats = [...new Set(active(state).map(inv => inv.seat))]
  const single = new Set(['04147', '04148'])
  const recordFor = seat => (Array.isArray(state.campaign?.investigators)
    ? state.campaign.investigators[seat]
    : state.campaign?.investigators?.[seat])
  const addTo = (seat, code) => {
    const entry = recordFor(seat)
    if (!entry) return
    entry.deck ||= []
    if (!entry.deck.includes(code)) entry.deck.push(code)
  }
  for (const code of codes) {
    if (!single.has(code)) {
      for (const seat of activeSeats) addTo(seat, code)
      continue
    }
    let seat = activeSeats.includes(leadSeat(state)) ? leadSeat(state) : activeSeats[0]
    if (activeSeats.length > 1 && typeof api?.choose === 'function') {
      const answer = api.choose({
        kind: 'investigator', source: code, seat: leadSeat(state),
        prompt: `选择一位调查员，把「${cardName(code)}」加入他/她的牌库。`,
        options: activeSeats.map(value => ({
          id: String(value), label: state.investigators[value]?.name || String(value),
        })),
      })
      seat = activeSeats.includes(Number(answer)) ? Number(answer) : seat
    }
    addTo(seat, code)
  }
  for (const code of codes) {
    state.campaign.campaignCards ||= []
    if (!state.campaign.campaignCards.includes(code)) state.campaign.campaignCards.push(code)
  }
  if (codes.length) api?.info?.(`📦 战役卡加入调查员牌库：${codes.map(cardName).join('、')}。`)
}

export { distance as tfaDistance }
