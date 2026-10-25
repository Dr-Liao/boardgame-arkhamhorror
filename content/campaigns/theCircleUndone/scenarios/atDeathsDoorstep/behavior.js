// 《万象无终 · 死亡门前》行为层。
//
// 结构：`...encounterRules`（战役共享钩子）+ `id` + 本章钩子；覆盖共享同名钩子时在函数内
// 显式调用 `encounterRules.X?.(...)`。所有随机走 `api.random()`/setup helper，绝不使用 Math.random；
// 本章状态只写 `state.scenarioFlags` / `state.scenarioZones`（纯 JSON，随存档往返）。
//
// 本章状态键（save 往返 / 测试断言用）：
//   scenarioZones.setAside / removed
//   scenarioFlags: clueSetupApplied, josefPlanResolved, balconyParleyUsed,
//                  victorianHallsActionUsed, monsterSetAside, beneathEntryHall, interludeKey
//
// 规则事实源：参考实现 `AtDeathsDoorstep.hs` 与 Cards 目录下的逐卡文件；中文卡文是文案事实源。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { entryFlags } from '../../../../../src/cards/card-rules.js'
import { encounterRules, discardEncounterTop, nearestEnemyWithTrait, parleyDifficultyBonus } from '../../encounter-rules.js'
import { TCU_STORY_TEXT } from '../../story-text.js'
import { chaosAfterTest, resolveChaosToken as resolveChaos } from './chaos.js'
import {
  BALCONY, BILLIARDS_ROOM, ENTRY_HALL, JOSEF, JOSEFS_PLAN, MASTER_BEDROOM, OFFICE,
  SPECTRAL_HAUNTED, SPECTRAL_LOCATION_CODES, SPECTRAL_WATCHER, TROPHY_ROOM,
  VICTORIAN_HALLS, WATCHERS_GRASP,
  CARD_RULES,
} from './definition.js'

const original = card => card?.originalCode || card?.code
const alive = state => (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const loc = (state, id) => (state.locations || []).find(location => location.id === id) || null
const byCode = (state, code) => (state.locations || []).find(location => original(location) === code) || null
const flagsFor = state => (state.scenarioFlags ||= {})
const zonesFor = state => (state.scenarioZones ||= {})
const traitsOf = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())
const isSilverTwilight = card => hasTrait(card, 'silver twilight')
const agendaActive = (state, code) => original(state.agendas?.[state.agendaIndex]) === code
const actStep = state => Number(state.actIndex || 0) + 1

// 「失踪人口」卡号 → 最后出现的地点（参考实现 setupAtDeathsDoorstep 的四个 when 分支）。
const MISSING_PERSONS = Object.freeze([
  ['05046', 'entryHall'],      // 加弗瑞拉·米兹拉克
  ['05047', 'office'],         // 杰罗姆·戴维斯
  ['05048', 'billiardsRoom'],  // 瓦伦蒂诺·里瓦斯
  ['05049', 'balcony'],        // 彭妮·怀特
])

// 05048 = Valentino（台球室）、05049 = Penny（露台）；参考 JusticeXI.hs:67-72。
const TRAIL_RECORDS = Object.freeze([
  ['05046', 'entryHall', 'theInvestigatorsAreOnGavriellasTrail', '加弗瑞拉·米兹拉克', 'gavriella'],
  ['05047', 'office', 'theInvestigatorsAreOnJeromesTrail', '杰罗姆·戴维斯', 'jerome'],
  ['05048', 'billiardsRoom', 'theInvestigatorsAreOnValentinosTrail', '瓦伦蒂诺·里瓦斯', 'valentino'],
  ['05049', 'balcony', 'theInvestigatorsAreOnPennysTrail', '彭妮·怀特', 'penny'],
])

function takeFromSetAside(state, code) {
  const list = zonesFor(state).setAside
  if (!Array.isArray(list)) return false
  const index = list.indexOf(code)
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

function addToSetAside(state, code) {
  ;(zonesFor(state).setAside ||= []).push(code)
}

function bfsDistance(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of loc(state, id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

// 办公室（05077）：位于办公室的银暮秘社敌人失去冷漠。引擎没有关键词修正词表，
// 所以按事件驱动把结果同步到敌人实例（`printedAloof` 在生成时由引擎写入）。
function syncOfficeAloof(state) {
  const office = byCode(state, OFFICE)
  const josefAloof = Boolean(flagsFor(state).josefPlanResolved)
  for (const enemy of state.enemies || []) {
    if (enemy.printedAloof === undefined) enemy.printedAloof = Boolean(enemy.aloof)
    const atOffice = Boolean(office) && enemy.location === office.id && isSilverTwilight(enemy)
    // 05085b：约瑟夫·梅吉尔获得冷漠（本局剩余时间），且不受办公室「失去冷漠」影响。
    const forcedAloof = josefAloof && String(original(enemy)) === String(JOSEF)
    enemy.aloof = forcedAloof || (Boolean(enemy.printedAloof) && !atOffice)
  }
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
const SETUP_SET_ASIDE = [
  JOSEF, SPECTRAL_WATCHER, WATCHERS_GRASP, WATCHERS_GRASP,
  '05105', '05105', '05106', '05106',
  ...Object.values(SPECTRAL_LOCATION_CODES),
]

// 「失踪人口」线索 + 「留下的证据」移除：地点在 afterChaosBagSetup 时已经入场。
function distributeClues(state) {
  const flags = flagsFor(state)
  if (flags.clueSetupApplied) return
  flags.clueSetupApplied = true
  const records = state.campaign.records || {}
  const missing = Array.isArray(records.missingPersons) ? records.missingPersons : []
  const targets = []
  for (const [code, locationId] of MISSING_PERSONS) {
    if (!missing.includes(code)) continue
    const location = loc(state, locationId)
    if (!location) continue
    // 未揭示地点的线索在揭示时按 maxClues 重算，所以两处都要加。
    location.maxClues = (location.maxClues || 0) + 6
    if (location.revealed) location.clues = (location.clues || 0) + 6
    targets.push(location)
  }
  // 「留下的证据」：从上述地点移除总计 X 个线索，尽量平均。
  // 参考实现由队长逐个选择；这里用确定性等价规则（每次从线索最多的地点移除，平手按地点 id）。
  // 未揭示地点的线索只存在于 maxClues（揭示时按它重算），所以两处同步扣减。
  const cluesOf = location => (location.revealed ? (location.clues || 0) : (location.maxClues || 0))
  const removeClue = location => {
    if (location.revealed) location.clues = Math.max(0, (location.clues || 0) - 1)
    location.maxClues = Math.max(0, (location.maxClues || 0) - 1)
  }
  let remaining = Math.max(0, Number(records.piecesOfEvidenceWereLeftBehind) || 0)
  while (remaining > 0) {
    const candidates = targets.filter(location => cluesOf(location) > 0)
    if (!candidates.length) break
    candidates.sort((left, right) => cluesOf(right) - cluesOf(left)
      || String(left.id).localeCompare(String(right.id)))
    removeClue(candidates[0])
    remaining -= 1
  }
}

function setupLocations(state) {
  const zones = zonesFor(state)
  zones.setAside = [...SETUP_SET_ASIDE]
  zones.removed = []
  Object.assign(flagsFor(state), {
    clueSetupApplied: false,
    josefPlanResolved: false,
    balconyParleyUsed: false,
    victorianHallsActionUsed: false,
    monsterSetAside: [],
    beneathEntryHall: [],
    interludeKey: null,
  })
  // 顺序：入口大厅先（全员起点），其余按参考地图从左到右。
  return ['entryHall', 'victorianHalls', 'trophyRoom', 'billiardsRoom', 'masterBedroom', 'balcony', 'office']
}

// ---------------------------------------------------------------------------
// 幽灵面：翻面时把幽灵面的闹鬼能力写到实例上（翻回正常面时清空）
// ---------------------------------------------------------------------------
function locationFlipped(state, location, api) {
  const current = location.spectralFace === 'spectral' || location.spectral === true ? 'spectral' : 'normal'
  // 胜利点在「剧本结束时该地点已揭示且无线索」才计入（campaign-flow.js:119-124 的幕末口径）；
  // 这里只把当前面的印刷胜利点写到实例上，不再翻面即计分。
  location.victory = Number(ALL_CARDS[original(location)]?.victory || 0)
  if (current === 'spectral') {
    const haunted = SPECTRAL_HAUNTED[location.id]
    if (haunted) location.haunted = structuredClone(haunted)
  } else {
    delete location.haunted
  }
}

// 幽灵面卡（05081/05082/05084）带胜利点；翻面时若无线索就补一次「进胜利区」结算
// （与引擎 revealLocation / awardLocationVictory 同口径）。
function awardSpectralVictory(state, location, api) {
  if (location.revealed === false) return false
  const victory = Number(ALL_CARDS[original(location)]?.victory || 0)
  if (!victory || (location.clues || 0) > 0 || location.victoryAwarded) return false
  location.victoryAwarded = true
  state.victory = Number(state.victory || 0) + victory
  state.victoryDisplay ||= []
  state.victoryDisplay.push({
    id: `location:${location.id}`, code: original(location), originalCode: original(location), victory,
  })
  api?.info?.(`💎 「${location.name}」的幽灵面无线索且带胜利点：+${victory}（累计 ${state.victory}）。`)
  return true
}

// ---------------------------------------------------------------------------
// 幕
// ---------------------------------------------------------------------------
function findSpawnFarthestFromAll(state, api, excludeIds) {
  const candidates = (state.locations || []).filter(location => !excludeIds.includes(location.id))
  if (!candidates.length) return null
  const scored = candidates.map(location => {
    let nearest = Infinity
    for (const inv of alive(state)) {
      const distance = bfsDistance(state, inv.location, location.id)
      if (distance < nearest) nearest = distance
    }
    return { location, nearest }
  }).sort((left, right) => (right.nearest || 0) - (left.nearest || 0)
    || String(left.location.id).localeCompare(String(right.location.id)))
  // 卡面/参考实现：只在与所有调查员距离「并列最远」的地点中选（不含入口大厅）。
  const farthest = scored[0]?.nearest ?? 0
  const pool = scored.filter(entry => (entry.nearest || 0) === farthest)
  const answer = pool.length === 1 ? pool[0].location.id : api?.choose?.({
    kind: 'location', source: JOSEF, seat: state.campaign?.leadSeat ?? 0,
    prompt: '选择生成约瑟夫·梅吉尔的地点（除入口大厅外离所有调查员最远的地点）。',
    options: pool.map(entry => ({ id: entry.location.id, label: entry.location.name })),
  })
  return (pool.find(entry => entry.location.id === answer) || pool[0]).location
}

function totalSpendableClues(state) {
  return alive(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
}

function spendGroupClues(state, amount) {
  let remaining = amount
  const payers = alive(state).slice().sort((left, right) => (right.clues || 0) - (left.clues || 0))
  for (const inv of payers) {
    if (remaining <= 0) break
    const spend = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues -= spend
    remaining -= spend
  }
  return remaining <= 0
}

// 议程 1b（05066 背面）：线索判定 → 生成 Josef → 幕间故事 I → 移除所有地点线索 → 推进幕 1b。
function advanceJusticeXI(state, agenda, api) {
  const required = 3 * (Number(state.numInvestigators) || 1)
  const total = totalSpendableClues(state)
  if (total < required) {
    for (const inv of alive(state)) inv.clues = 0
    api?.info?.(`🔍 团队只凑出 ${total}/${required} 个线索，失去了所有线索。`)
  } else {
    spendGroupClues(state, required)
    api?.info?.(`🔍 团队花费 ${required} 个线索，把约瑟夫·梅吉尔揪了出来。`)
    const target = findSpawnFarthestFromAll(state, api, ['entryHall'])
    if (target) {
      takeFromSetAside(state, JOSEF)
      api?.spawn?.(JOSEF, target.id)
      api?.info?.(`👤 约瑟夫·梅吉尔在「${target.name}」生成。`)
    }
  }
  // 幕间故事 I：读失踪人口，逐个检查其最后出现的地点是否已无线索。
  // 未揭示地点的线索只存放在 maxClues（揭示时按它重算），因此两者都要读。
  const records = state.campaign.records || {}
  const missing = Array.isArray(records.missingPersons) ? records.missingPersons : []
  const locationClues = location => (location.revealed ? (location.clues || 0) : (location.maxClues || 0))
  for (const [code, locationId, recordKey, label, person] of TRAIL_RECORDS) {
    if (!missing.includes(code)) continue
    const location = loc(state, locationId)
    if (location && locationClues(location) === 0) {
      records[recordKey] = true
      // P9 幕间故事 I（失者名录）：正文来自导入生成物；记录先落账，再把该角色的独立段落读给全桌。
      const narrative = TCU_STORY_TEXT.interludes?.interludeOne?.sections?.[person] || []
      api?.info?.(`📓 幕间故事 I：调查员正在追查${label}。`)
      for (const paragraph of narrative) api?.info?.(paragraph)
    }
  }
  // 「移除所有地点的线索」：未揭示地点的线索在 maxClues 上，必须一并清空，否则日后揭示会复活。
  for (const location of state.locations || []) {
    location.clues = 0
    location.maxClues = 0
  }
  api?.advanceAct?.()
}

// 议程 2b（05067 背面）：幕 2 → 结局 3；幕 3 → 未撤退者被击败并承受 1 点肉体创伤。
function advanceOverTheThreshold(state, agenda, api) {
  if (actStep(state) === 2) {
    api?.finish?.('r3')
    return
  }
  for (const inv of state.investigators || []) {
    if (inv.resigned || inv.defeated) continue
    api?.defeat?.(inv, '幽灵国度')
    api?.trauma?.(inv.seat, 'physical', 1)
    api?.info?.(`☠️ ${inv.name} 勉强捡回一条命：被击败并承受 1 点肉体创伤。`)
  }
}

// 幕 1b（05068 背面）：换幽灵面 + 生成放一边的怪物 + 生成幽灵看守人 + 洗回两组。
function advanceHiddenAgendas(state, act, api) {
  const entryHall = loc(state, 'entryHall')
  const victorianHalls = loc(state, 'victorianHalls')
  if (entryHall && victorianHalls) {
    for (const inv of alive(state).filter(target => target.location === entryHall.id)) {
      api?.moveInvestigator?.(inv.seat, victorianHalls.id)
    }
    for (const enemy of (state.enemies || []).filter(target => target.location === entryHall.id)) {
      api?.moveEnemy?.(enemy, victorianHalls.id)
    }
  }
  const perInvestigator = Number(state.numInvestigators) || 1
  for (const locationId of Object.keys(SPECTRAL_LOCATION_CODES)) {
    const location = loc(state, locationId)
    if (!location) continue
    const normalCode = String(original(location))
    const wasRevealed = location.revealed !== false
    const carriedTokens = Number(location.clues || 0)
    // 05068 背面：「原地点上的所有标记和卡牌视为位于新版本地点」——已放置的线索随翻面携带；
    // 未揭示地点没有 token，只在 maxClues 上记着「失踪人口 +6 / 留下的证据」等加成。
    const normalPrinted = Number(ALL_CARDS[normalCode]?.clues || 0) * perInvestigator
    const carriedBonus = Math.max(0, Number(location.maxClues || 0) - normalPrinted)
    if (!(location.spectralFace === 'spectral' || location.spectral === true)) {
      api?.flipSpectral?.(locationId)
    }
    // 7 张幽灵地点从「放一边」移出（区域账本与后续从放一边区找牌的语义一致）。
    if (location.originalCode || location.code) takeFromSetAside(state, String(original(location)))
    // 幽灵面的印刷线索值（05080=1、05081=1、05083=1、05084=2，正面分别是 0/0/0/1）：
    // 翻面后按幽灵面卡面重算 maxClues，同时保留原地点已携带的线索加成。
    const spectralPrinted = Number(ALL_CARDS[String(original(location))]?.clues || 0) * perInvestigator
    location.maxClues = spectralPrinted + carriedBonus
    // 卡面：换面后「有调查员的地点揭示」；其余地点回到未揭示（引擎翻面不改 revealed）。
    location.revealed = false
    location.clues = carriedTokens
    const hasInvestigator = alive(state).some(inv => inv.location === locationId)
    if (wasRevealed && !hasInvestigator) {
      // 此前已揭示且仍有线索 token 的地点：之后再次揭示时保留携带的 token，不重复按新卡面放置。
      location.preservedClues = carriedTokens
    }
    if (hasInvestigator) {
      api?.reveal?.(locationId)
      location.revealed = true
      // 已揭示地点翻面时 token 视为携带；只在首次揭示时按幽灵面线索值放置。
      if (wasRevealed) location.clues = carriedTokens
    }
  }
  // 幽灵面入口大厅：若换面时无调查员在内，则处于「鬼灵迷雾封锁」状态（独立 flag，不依赖 revealed）。
  const spectralEntryHall = loc(state, 'entryHall')
  if (spectralEntryHall && original(spectralEntryHall) === SPECTRAL_LOCATION_CODES.entryHall) {
    flagsFor(state).entryHallSealed = !alive(state).some(inv => inv.location === 'entryHall')
  }
  // 按玩家顺序（从队长起）循环生成放一边的[[怪物]]敌人，直到全部生成。
  // 卡面：每位调查员「将 1 个放在一边的[[怪物]]敌人生成在自己地点」——由该调查员从放一边怪物里自选
  // （参考 HiddenAgendas.hs:82-87 的 ForInvestigator chooseTargetM），而不是按固定顺序派发。
  const flags = flagsFor(state)
  const monsters = [...(flags.monsterSetAside || [])]
  flags.monsterSetAside = []
  const lead = Number(state.campaign?.leadSeat ?? 0)
  const count = state.investigators?.length || 1
  const order = [...(state.investigators || [])].sort((left, right) =>
    (((left.seat - lead) % count) + count) % count - ((((right.seat - lead) % count) + count) % count))
  const chooseMonster = (inv, pool) => {
    if (pool.length === 1) return pool[0]
    const answer = api?.choose?.({
      kind: 'spawn', source: '05068', seat: inv.seat,
      prompt: `「秘密阴谋」：选择 1 个放在一边的[[怪物]]敌人，在你的地点生成。`,
      options: pool.map(code => ({ id: String(code), label: ALL_CARDS[code]?.nameZh || code })),
    })
    return pool.find(code => String(code) === String(answer)) ?? pool[0]
  }
  let guard = 0
  while (monsters.length && order.length && guard++ < 100) {
    for (const inv of order) {
      if (!monsters.length) break
      const code = chooseMonster(inv, monsters)
      monsters.splice(monsters.indexOf(code), 1)
      takeFromSetAside(state, code)
      api?.spawn?.(code, inv.location)
      api?.info?.(`👹 放在一边的怪物「${ALL_CARDS[code]?.nameZh || code}」在 ${inv.name} 所在地点生成。`)
    }
  }
  // 幽灵看守人放到入口大厅。
  takeFromSetAside(state, SPECTRAL_WATCHER)
  api?.spawn?.(SPECTRAL_WATCHER, 'entryHall')
  api?.info?.('👻 幽灵看守人在入口大厅生成。')
  // 看守人组剩余卡 + 冥界组剩余卡 + 遭遇弃牌堆洗入遭遇牌库。
  for (const code of [WATCHERS_GRASP, WATCHERS_GRASP, '05105', '05105', '05106', '05106']) {
    if (!takeFromSetAside(state, code)) continue
    state.encounterDeck.push(code)
  }
  api?.shuffleDiscard?.()
  api?.info?.('🌀 看守人与冥界剩下的卡连同遭遇弃牌堆一起洗入遭遇牌库。')
}

// 幕 2b（05069 背面）：揭示入口大厅；遭遇弃牌堆洗回牌库。
function advanceTheSpectralRealm(state, act, api) {
  api?.reveal?.('entryHall')
  flagsFor(state).entryHallSealed = false
  api?.shuffleDiscard?.()
  api?.info?.('🌫️ 挡住去路的迷雾散去：入口大厅被揭示，遭遇弃牌堆洗回牌库。')
}

// 幕 3b（05070 背面）→ 结局 1。
function escapeTheCage(state, act, api) {
  api?.finish?.('r1')
}

// ---------------------------------------------------------------------------
// 章末记录
// ---------------------------------------------------------------------------
const RESOLUTION_KEYS = ['noResolution', 'r1', 'r2', 'r3']

function resolutionForAct(state) {
  const step = actStep(state)
  if (step <= 1) return 'r2'
  if (step === 2) return 'r3'
  return 'r1'
}

// 结局 1 的幕间故事 II 分支（参考实现按 Josef/银暮秘社的所在区域选 4/5/6）。
function epilogueInterludeKey(state) {
  const inVictory = (state.victoryDisplay || []).some(card => original(card) === JOSEF)
  const beneath = flagsFor(state).beneathEntryHall || []
  const underEntryHall = beneath.includes(JOSEF)
  const silverTwilightInVictory = (state.victoryDisplay || [])
    .filter(card => isSilverTwilight({ code: original(card) })).length
  const silverTwilightUnderEntryHall = beneath.filter(code => isSilverTwilight({ code })).length
  if (inVictory) return 'ThePriceOfProgress4'
  if (underEntryHall) return 'ThePriceOfProgress5'
  if (silverTwilightInVictory >= silverTwilightUnderEntryHall) return 'ThePriceOfProgress4'
  return 'ThePriceOfProgress6'
}

function applyResolution(state, key, events, api) {
  if (!RESOLUTION_KEYS.includes(key)) throw new Error(`未知死亡门前结局：${key}`)
  const finalKey = key === 'noResolution' ? resolutionForAct(state) : key
  const records = state.campaign.records || (state.campaign.records = {})
  const flags = flagsFor(state)
  if (finalKey === 'r1') {
    records.theInvestigatorsEscapedTheSpectralRealm = true
    flags.interludeKey = epilogueInterludeKey(state)
    // 幕间二《进步的代价》的分支由 Josef/银暮秘社的结局决定（参考实现 AtDeathsDoorstep.hs:250-255 +
    // TheCircleUndone.hs:94-151）。P8 只把这个分支记在 scenarioFlags；P9 起落到战役记录，
    // 供 campaign.flow 的 interludeTwoFate 分支与幕间正文选择读取（同一状态，跨章持久化）。
    if (flags.interludeKey === 'ThePriceOfProgress4') records.josefDisappearedIntoTheMist = true
    else if (flags.interludeKey === 'ThePriceOfProgress5') records.theInvestigatorsRescuedJosef = true
    else if (flags.interludeKey === 'ThePriceOfProgress6') records.josefIsAliveAndWell = true
    api?.info?.(`📓 结局 1：调查员逃出了幽灵国度；幕间故事 II 分支 ${flags.interludeKey}。`)
    return { award: true, bonus: 0 }
  }
  if (finalKey === 'r2') {
    records.theInvestigatorsLearnedNothingOfTheLodgesSchemes = true
    api?.info?.('📓 结局 2：调查员没有发现秘社的阴谋。')
    return { award: true, bonus: 0 }
  }
  records.theInvestigatorsAreNeverSeenOrHeardFromAgain = true
  for (const inv of state.investigators || []) {
    if (inv.resigned) continue
    const record = state.campaign.investigators?.[inv.seat]
    if (record) record.status = 'killed'
    flags.takenByWatcher = true
    api?.info?.(`☠️ 结局 3：${inv.name} 就此音讯全无。`)
  }
  return { award: true, bonus: 0 }
}

// ---------------------------------------------------------------------------
// 手牌图标（露台谈判）：卡面要求「合计至少 3 个智识图标」，只数智识图标。
// ---------------------------------------------------------------------------
function intellectIcons(code) {
  const icons = ALL_CARDS[code]?.icons || {}
  // 参考 SkillIconCost：Wild 图标也计入「至少 3 个[智力]图标」。
  return (Number(icons.intellect) || 0) + (Number(icons.wild) || 0)
}

// Josef 翻面结算 05085b：移除他身上毁灭；本局银暮秘社敌人不能放毁灭、Josef 获冷漠；
// 翻回敌人面并解除与所有调查员的交战（卡面一次性结算）。
function flipJosef(state, josef, api) {
  const flags = flagsFor(state)
  if (flags.josefPlanResolved) return false
  flags.josefPlanResolved = true
  josef.faces ||= [
    { code: JOSEF, side: 'enemy' },
    { code: JOSEFS_PLAN, side: 'unfinishedBusiness' },
  ]
  api?.flipEnemy?.(josef, JOSEFS_PLAN)
  josef.doom = 0
  api?.info?.('📜 「约瑟夫的计划」：他身上的毁灭被移除；本局银暮秘社敌人不能再获得毁灭，约瑟夫获得冷漠。')
  api?.flipEnemy?.(josef, JOSEF)
  for (const inv of state.investigators || []) {
    if (Array.isArray(inv.engaged)) inv.engaged = inv.engaged.filter(id => id !== josef.id)
    if (Array.isArray(inv.threat)) inv.threat = inv.threat.filter(card => original(card) !== JOSEFS_PLAN)
  }
  josef.engagedSeat = null
  syncOfficeAloof(state)
  return true
}

// ---------------------------------------------------------------------------
// 数据驱动分派：单卡条目 flags 优先（entryFlags），offline/索引重建前回退 definition.CARD_RULES。
// 所有「这是哪张卡」的判断都在这里按 rule id 分派，behavior 不写卡号分支。
// ---------------------------------------------------------------------------
const CARD_RULE_FALLBACK = CARD_RULES
function ruleOf(_state, code) {
  const key = String(code ?? '')
  const flags = entryFlags(key)
  const base = CARD_RULE_FALLBACK[key]
  if (flags && Object.keys(flags).length) return { ...(base || {}), ...flags }
  return base || null
}

const ACT_ADVANCE = Object.freeze({
  hiddenAgendas: advanceHiddenAgendas,
  spectralRealm: advanceTheSpectralRealm,
  escapeTheCage,
})
const AGENDA_ADVANCE = Object.freeze({
  justiceXI: advanceJusticeXI,
  overTheThreshold: advanceOverTheThreshold,
})
// ---------------------------------------------------------------------------
// 行为对象
// ---------------------------------------------------------------------------
export const implementedEncounterCodes = [
  // 敌人 / 诡计（definition 里的遭遇牌；规则在 behavior 与共享 encounterRules）
  '05085', '05086', '05087', '05095', '05096', '05097', '05100', '05101', '05102',
  '05103', '05104', '05105', '05106', '05107', '05108', '01167', '01168',
]

export const behavior = {
  ...encounterRules,
  id: 'atDeathsDoorstep',
  implementedEncounterCodes,
  locationsStartRevealed: false,

  // ---- 布置 ----
  setupLocations(state) {
    return setupLocations(state)
  },
  setupEnemies() {
    // 本章开局无场上敌人：Josef 在议程 1b 生成，看守人在幕 1b 生成。
  },
  afterChaosBagSetup(state) {
    distributeClues(state)
    syncOfficeAloof(state)
  },

  // ---- 幕 / 议程 ----
  actReveal(state, act, api) {
    const rule = ruleOf(state, original(act))
    ACT_ADVANCE[rule?.advanceRule ?? rule?.advanceRuleId]?.(state, act, api)
    syncOfficeAloof(state)
  },
  agendaReveal(state, agenda, api) {
    const rule = ruleOf(state, original(agenda))
    AGENDA_ADVANCE[rule?.advanceRule ?? rule?.advanceRuleId]?.(state, agenda, api)
    syncOfficeAloof(state)
  },
  // 幕 3 目标：所有未被击败的调查员都撤退 → 推进（05070b → 结局 1）。
  checkObjectives(state, api) {
    if (actStep(state) !== 3) return
    const undefeated = (state.investigators || []).filter(inv => !inv.defeated)
    if (undefeated.length && undefeated.every(inv => inv.resigned)) api?.advanceAct?.()
  },
  allResigned(state, api) {
    if (actStep(state) === 3 && alive(state).length === 0) api?.advanceAct?.()
  },

  // ---- 幽灵界 ----
  canFightEnemy(state, inv, enemy) {
    return encounterRules.canFightEnemy?.(state, inv, enemy) !== false
  },
  canEvadeEnemy(state, inv, enemy) {
    return encounterRules.canEvadeEnemy?.(state, inv, enemy) !== false
  },
  investigatorEntryError(state, location) {
    if (!location) return null
    // 幽灵面的入口大厅：迷雾屏障在揭示前封锁入口（05078 背面 / 05068b）。
    // 引擎 flipLocationFace 不重置 revealed（全循环共享行为），因此用独立 flag 记录封印，
    // 不依赖 revealed；05069 背面（advanceTheSpectralRealm）解除。
    const spectralEntry = original(location) === SPECTRAL_LOCATION_CODES.entryHall
    if (spectralEntry && (flagsFor(state).entryHallSealed === true || location.revealed !== true)) {
      return '鬼灵迷雾封锁了入口大厅：在它被揭示前，你不能进入。'
    }
    return null
  },
  locationFlipped(state, location, api) {
    locationFlipped(state, location, api)
  },
  // 05068 背面替换地点时携带的线索 token：换面后回到未揭示的地点再次揭示时，
  // 按携带的 token 数放置（不重复叠加新卡面的线索值；首次揭示仍按幽灵面印刷值）。
  cluesOnReveal(state, location) {
    if (location?.preservedClues == null) return undefined
    const clues = Math.max(0, Number(location.preservedClues) || 0)
    delete location.preservedClues
    return clues
  },

  // ---- 敌人 ----
  // 议程 1：银暮秘社敌人不能受伤/被击败。
  enemyDamageAllowed(state, enemy) {
    return !(agendaActive(state, '05066') && isSilverTwilight(enemy))
  },
  enemyCanBeDefeated(state, enemy) {
    return !(agendaActive(state, '05066') && isSilverTwilight(enemy))
  },
  // 议程 1 强制：抽到[[怪物]]敌人 → 不生成、放一边、议程 +1 毁灭。
  // 引擎没有 draw-cancel 钩子：内容层用「遭遇抽牌标记」精确限定来源——encounterDrawn 在
  // spawnEnemy 之前被引擎调用（src/engine/encounter.js:134 早于 :177），这里只给「本次抽到的怪物」
  // 打标记，spawnLocation 仅在该标记命中时拦截；效果/弱点等其它生成路径没有标记、照常放行。
  encounterDrawn(state, inv, code, api) {
    encounterRules.encounterDrawn?.(state, inv, code, api)
    const flags = flagsFor(state)
    flags.pendingDrawEnemy = null
    if (!agendaActive(state, '05066')) return
    const card = ALL_CARDS[String(code)]
    if (card?.type !== 'enemy') return
    if (!(card.traits || []).some(trait => String(trait).toLowerCase() === 'monster')) return
    flags.pendingDrawEnemy = { code: String(code), round: Number(state.round || 0), seat: inv?.seat ?? null }
  },
  spawnLocation(state, code, fallbackLoc) {
    const flags = flagsFor(state)
    const pending = flags.pendingDrawEnemy
    const fromDraw = Boolean(pending && String(pending.code) === String(code)
      && Number(pending.round) === Number(state.round || 0))
    flags.pendingDrawEnemy = null
    if (fromDraw && agendaActive(state, '05066') && hasTrait({ code }, 'monster')) {
      flags.pendingSetAsideMonster = String(code)
      flags.monsterSetAside = [...(flags.monsterSetAside || []), String(code)]
      addToSetAside(state, String(code))
      return '__setAside__'
    }
    // 银暮秘社敌人不能生成在幽灵面入口大厅（05078 背面；普通面入口大厅不限制）。
    // 该封锁文本只出现在「未揭示/封印」侧：幕 2b 揭示入口大厅后（entryHallSealed=false）限制失效。
    const entryHall = loc(state, 'entryHall')
    const spectralEntryHall = entryHall && original(entryHall) === SPECTRAL_LOCATION_CODES.entryHall
    const entryHallSealed = flagsFor(state).entryHallSealed === true
    if (spectralEntryHall && entryHallSealed && fallbackLoc === entryHall.id && isSilverTwilight({ code })) return '__nowhere__'
    return fallbackLoc
  },
  spawnFailed(state, code, engagedSeat, api) {
    const id = String(code)
    const flags = flagsFor(state)
    // 引擎已把「无法生成」的遭遇卡放进遭遇弃牌堆：先取回。
    const index = state.encounterDiscard.lastIndexOf(id)
    if (index >= 0) state.encounterDiscard.splice(index, 1)
    // 只有「本次抽到怪物被强制放一边」这条路径由本章接管；其它生成失败维持引擎默认弃置。
    if (flags.pendingSetAsideMonster !== id) {
      api?.info?.(`⛔ 「${ALL_CARDS[id]?.nameZh || id}」没有合法生成地点，被弃置。`)
      state.encounterDiscard.push(id)
      return
    }
    flags.pendingSetAsideMonster = null
    // 议程 1 的怪物：放在一边，并在本密谋上放置 1 点毁灭（api.addDoom 会检查阈值推进）。
    api?.addDoom?.(1)
    api?.info?.(`🌑 「${ALL_CARDS[id]?.nameZh || id}」被放在一边：在本密谋上放置 1 点毁灭。`)
  },
  enemySpawned(state, enemy, api) {
    syncOfficeAloof(state)
    encounterRules.enemySpawned?.(state, enemy, api)
  },
  // 05067 正面：「每个[[银暮秘社]]敌人获得胜利 0」——进入胜利区（0 点不改变比分，但幕间 II 分支
  // 需要能在 victoryDisplay 里数到它们）。
  // R4 交叉复核修复（reaudit-b dispute，Lead 裁决）：本分支手动 push 后必须返回 true——
  // 引擎 src/engine/enemies.js:404-405 `const addedToVictory = !replaced && addVictory(...)`，
  // 返回 true 才跳过 addVictory 的 else 分支，避免同一敌人同时进胜利区与遭遇弃牌堆（还会被后续洗回）。
  enemyDefeated(state, enemy, api) {
    const replaced = encounterRules.enemyDefeated?.(state, enemy, api)
    if (agendaActive(state, '05067') && isSilverTwilight(enemy)) {
      state.victoryDisplay ||= []
      const id = `enemy:${enemy.id}`
      if (!state.victoryDisplay.some(card => card.id === id)) {
        state.victoryDisplay.push({ id, code: original(enemy), originalCode: original(enemy), victory: 0 })
        api?.info?.(`💠 「${enemy.name}」获得胜利 0（进入胜利区）。`)
      }
      return true
    }
    return replaced
  },
  // 05085b 背面：「本局剩余时间，毁灭不能放在[[银暮秘社]]敌人上」。
  // 引擎在写入前询问本钩子（src/engine/act-agenda.js 的 placeDoomOnCard → canPlaceDoomOn），
  // 返回 false 时不写入、也不触发 doomPlaced；不再用「先放后扣」的等价实现。
  canPlaceDoomOn(state, card) {
    if (!flagsFor(state).josefPlanResolved) return true
    if (!card || !isSilverTwilight(card)) return true
    return !(state.enemies || []).includes(card)
  },
  enemyMoved(state, enemy, newLocationId, api) {
    syncOfficeAloof(state)
    encounterRules.enemyMoved?.(state, enemy, newLocationId, api)
  },
  // 议程 2：把[[银暮秘社]]敌人视作调查员参与猎手移动。
  // 引擎 hunterMove 钩子只在「无调查员同地点」时调用；返回 true 表示本章已处理、引擎不再默认移动。
  // 语义对齐参考实现 hunter-extra-targets：
  //   · 同地点已有「视作调查员」的银暮秘社敌人 → 本猎手不移动（返回 true）；
  //   · 额外目标最近距离严格更近 → 向该地点移动；
  //   · 调查员更近 → 返回 false，交给引擎默认 hunterStep（保留 PREY_RANK/猎物标记/等距裁决的完整语义）；
  //   · 并列 → 调查员侧用引擎 hunterStep 得到（已含猎物优先级的）下一步，与额外目标路线合并后由 lead 选。
  hunterMove(state, enemy, api) {
    if (!agendaActive(state, '05067') || !enemy?.hunter) return false
    const silver = (state.enemies || []).filter(target => target !== enemy && isSilverTwilight(target)
      && target.location)
    if (!silver.length) return false
    if (silver.some(target => target.location === enemy.location)) {
      api?.info?.(`🧭 「${enemy.name}」把同地点的银暮秘社敌人视作调查员，不移动。`)
      return true
    }
    const distance = id => bfsDistance(state, enemy.location, id)
    const silverPositions = [...new Set(silver.map(target => target.location))]
      .filter(id => Number.isFinite(distance(id)))
    const silverNearest = silverPositions.length
      ? Math.min(...silverPositions.map(distance))
      : Infinity
    const invTargets = alive(state).filter(investigator =>
      enemy.prey !== 'bearer' || investigator.seat === enemy.bearerSeat)
    const invNearest = invTargets.length
      ? Math.min(...invTargets.map(investigator => distance(investigator.location)))
      : Infinity
    const routeToward = ids => {
      const steps = []
      for (const id of ids) {
        const next = typeof api?.stepToward === 'function'
          ? api.stepToward(enemy.location, id)
          : (loc(state, enemy.location)?.connections || [])[0]
        if (next && next !== enemy.location && !steps.includes(next)) steps.push(next)
      }
      return steps
    }
    const pickRoute = (steps, prompt) => {
      if (!steps.length) return null
      if (steps.length === 1) return steps[0]
      const answer = api?.choose?.({
        kind: 'hunter', source: { type: 'enemy', code: original(enemy) }, seat: state.campaign?.leadSeat ?? 0,
        prompt,
        options: steps.map(id => ({ id, label: loc(state, id)?.name || id })),
      })
      return steps.includes(answer) ? answer : steps[0]
    }
    const moveAlong = (next, reason) => {
      if (!next) return true
      api?.moveEnemy?.(enemy, next)
      api?.info?.(`🧭 「${enemy.name}」${reason}，向「${loc(state, next)?.name || next}」移动。`)
      return true
    }
    if (silverNearest < invNearest) {
      const nearestIds = silverPositions.filter(id => distance(id) === silverNearest)
      return moveAlong(pickRoute(routeToward(nearestIds), `选择「${enemy.name}」向银暮秘社敌人移动的路线。`),
        '被银暮秘社敌人的气息吸引')
    }
    if (invNearest < silverNearest) return false
    // 并列：调查员侧走引擎 hunterStep（猎物优先级完整），额外目标侧按路线合并，由 lead 选一条。
    const invStep = typeof api?.hunterStep === 'function' ? api.hunterStep(enemy, {}) : null
    const silverSteps = routeToward(silverPositions.filter(id => distance(id) === silverNearest))
    const steps = [...new Set([...(invStep ? [invStep] : []), ...silverSteps])].filter(Boolean)
    if (!steps.length) return false
    return moveAlong(pickRoute(steps, `「${enemy.name}」的猎手目标并列，选择移动路线。`), '朝并列的猎手目标')
  },
  // 议程 2 强制（卡面：猎手移动步骤后）——引擎在猎手循环后、交战/攻击前提供 enemyPhaseAfterHunters。
  enemyPhaseAfterHunters(state, api) {
    encounterRules.enemyPhaseAfterHunters?.(state, api)
    if (!agendaActive(state, '05067')) return
    for (const spectral of (state.enemies || []).slice()) {
      if (!hasTrait(spectral, 'spectral') || spectral.exhausted) continue
      const targets = (state.enemies || []).filter(target => target !== spectral
        && target.location === spectral.location && hasTrait(target, 'humanoid'))
      for (const target of targets) {
        api?.damageEnemy?.(target.id, Number(spectral.damage) || 0, null, 'encounter')
        api?.info?.(`👻 「${spectral.name}」对「${target.name}」造成 ${Number(spectral.damage) || 0} 点伤害。`)
      }
    }
  },
  enemyPhaseEnd(state, api) {
    encounterRules.enemyPhaseEnd?.(state, api)
  },

  // ---- 行动 ----
  actions(state, inv) {
    const moves = []
    const here = loc(state, inv.location)
    if (!here) return moves
    const code = String(original(here))
    const flags = flagsFor(state)
    if (code === ENTRY_HALL) {
      moves.push({ action: 'scenarioAction', rule: 'resignEntryHall', label: '🚪 撤退：“我觉得在这儿查不到失踪事件的线索。”' })
    }
    if (code === SPECTRAL_LOCATION_CODES.entryHall) {
      moves.push({ action: 'scenarioAction', rule: 'resignSpectralEntryHall', label: '🚪 撤退：你破门而出，逃出了幽灵国度。' })
    }
    if (code === VICTORIAN_HALLS && !flags.victorianHallsActionUsed) {
      moves.push({ action: 'scenarioAction', rule: 'victorianHallsAction', label: '🗣️ 你这是自找麻烦：弃遭遇牌直到弃出银暮秘社敌人（团队每场一次）' })
    }
    if (code === TROPHY_ROOM && inv.trophyRoomRound !== state.round) {
      moves.push({ action: 'scenarioAction', rule: 'trophyRoomAction', label: '🥂 你跟其他客人谈了一会儿天（每轮一次）' })
    }
    if (code === BILLIARDS_ROOM && inv.billiardsRoomRound !== state.round) {
      moves.push({ action: 'scenarioAction', rule: 'billiardsRoomAction', label: '🎱 与宾客来比一场：敏捷(3)（每轮一次）' })
    }
    if (code === BALCONY && !flags.balconyParleyUsed) {
      moves.push({ action: 'scenarioAction', rule: 'balconyParley', actionKind: 'parley',
        label: '🤝 谈判：弃掉合计至少 3 个智识图标的手牌，获得 2 个线索（团队每场一次）' })
    }
    const josef = (state.enemies || []).find(enemy => original(enemy) === JOSEF && enemy.location === inv.location)
    if (josef && !flags.josefPlanResolved) {
      const otherDoom = (state.enemies || []).some(enemy => enemy !== josef && isSilverTwilight(enemy)
        && (Number(enemy.doom) || 0) > 0)
      if (!otherDoom) {
        moves.push({ action: 'scenarioAction', rule: 'josefParley', actionKind: 'parley',
          label: '🤝 谈判：让约瑟夫相信这不是你干的（智识 4）' })
      }
    }
    return moves
  },
  performAction(state, inv, move, api) {
    if (move.rule === 'resignEntryHall' || move.rule === 'resignSpectralEntryHall') {
      api?.resign?.(inv.seat)
      return
    }
    if (move.rule === 'victorianHallsAction') {
      // 弃遭遇牌直到弃出一个银暮秘社敌人，生成在这里，然后获得 2 个线索（团队每场一次）。
      flagsFor(state).victorianHallsActionUsed = true
      let found = null
      let guard = 0
      while (state.encounterDeck?.length && guard++ < 200) {
        // 逐张走共享弃顶入口：牌库由有到无时通知「遭遇牌库耗尽」相关强制（05091/05098 等）。
        const [code] = discardEncounterTop(state, api, 1, { reshuffle: false, notifyEmpty: true })
        if (!code) break
        if (isSilverTwilight({ code }) && ALL_CARDS[code]?.type === 'enemy') { found = code; break }
      }
      if (!found) {
        api?.info?.('遭遇牌库被弃空，也没有出现银暮秘社敌人。')
        return
      }
      api?.spawn?.(found, inv.location)
      api?.gainClues?.(inv.seat, 2)
      api?.info?.(`🗣️ 「${ALL_CARDS[found]?.nameZh || found}」被你的追问逼了出来；你获得 2 个线索。`)
      return
    }
    if (move.rule === 'trophyRoomAction') {
      inv.trophyRoomRound = state.round
      const answer = api?.choose?.({
        kind: 'option', source: TROPHY_ROOM, seat: inv.seat,
        prompt: '纪念品陈列室：获得 2 资源，或花费 2 资源获得 1 个线索？',
        options: [
          { id: 'gain', label: '获得 2 资源' },
          ...((inv.resources || 0) >= 2 ? [{ id: 'spend', label: '花费 2 资源获得 1 个线索' }] : []),
        ],
      })
      if (answer === 'spend') {
        inv.resources -= 2
        api?.gainClues?.(inv.seat, 1)
      } else {
        inv.resources = (inv.resources || 0) + 2
        api?.info?.(`🥂 ${inv.name} 获得 2 资源。`)
      }
      return
    }
    if (move.rule === 'billiardsRoomAction') {
      inv.billiardsRoomRound = state.round
      api?.test?.(inv.seat, 'agility', 3, result => {
        if (result?.success) api?.gainClues?.(inv.seat, 1)
      }, 0, { type: 'scenario', name: '台球室' })
      return
    }
    if (move.rule === 'balconyParley') {
      const hand = Array.isArray(inv.hand) ? [...inv.hand] : []
      // 玩家逐张选择要弃掉的牌，直到合计至少 3 个智识图标（Wild 计入）。
      const chosen = []
      let icons = 0
      while (icons < 3) {
        const options = hand
          .map((code, index) => ({ id: String(index), code, index, icons: intellectIcons(code) }))
          .filter(candidate => candidate.icons > 0 && !chosen.some(picked => picked.index === candidate.index))
          .map(candidate => ({ id: candidate.id, label: `${ALL_CARDS[candidate.code]?.nameZh || candidate.code}（${candidate.icons} 智识图标）` }))
        if (!options.length) break
        const answer = api?.choose?.({
          kind: 'card', source: BALCONY, seat: inv.seat, canSkip: true,
          prompt: `露台谈判：选择要弃掉的手牌（当前 ${icons}/3 智识图标）。`,
          options,
        })
        if (answer == null || answer === 'skip') break
        const picked = hand
          .map((code, index) => ({ code, index, icons: intellectIcons(code) }))
          .filter(candidate => candidate.icons > 0 && !chosen.some(entry => entry.index === candidate.index))
          .find(candidate => String(candidate.index) === String(answer))
        if (!picked) break
        chosen.push(picked)
        icons += picked.icons
      }
      if (icons < 3) {
        // 费用不足：无效且不消耗团队每场一次。
        api?.info?.(`🤝 露台谈判：手牌智识图标不足 3 个（只有 ${icons}），这次谈判无效。`)
        return
      }
      flagsFor(state).balconyParleyUsed = true
      for (const picked of [...chosen].sort((left, right) => right.index - left.index)) {
        inv.hand.splice(picked.index, 1)
        ;(inv.discard ||= []).push(picked.code)
      }
      api?.gainClues?.(inv.seat, 2)
      api?.info?.(`🤝 露台谈判成功：弃掉 ${chosen.length} 张手牌，获得 2 个线索。`)
      return
    }
    if (move.rule === 'josefParley') {
      const josef = (state.enemies || []).find(enemy => original(enemy) === JOSEF)
      if (!josef) return
      // 05097 秘社玄仪：直到一轮结束，对该敌人攻击/躲避/谈判难度 +2（实例标记，共享读点）。
      api?.test?.(inv.seat, 'intellect', 4 + parleyDifficultyBonus(state, josef), result => {
        if (result?.success) flipJosef(state, josef, api)
        else api?.attack?.(josef, inv)
      }, 0, { type: 'scenario', name: '与约瑟夫·梅吉尔谈判' })
      return
    }
    throw new Error(`未知死亡门前行动：${move.rule}`)
  },

  // ---- 检定 / 混乱标记 ----
  afterTest(state, inv, result, api) {
    // 共享钩子必须先跑（05093 崩毁离析的「本轮第一次检定」标记在共享实现里）。
    encounterRules.afterTest?.(state, inv, result, api)
    // 调查失败的闹鬼由引擎自动结算（P2.1）；本章额外处理：
    //   · 05077 办公室强制：调查办公室揭示负面符号 → 最近的银暮秘社敌人 +1 毁灭；
    //   · tablet 的「攻击/躲避」条款。
    const sourceCode = String(result?.source?.code || '')
    const negative = (result?.drawn || []).some(token =>
      ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))
    if (sourceCode === OFFICE && negative) {
      const nearest = nearestEnemyWithTrait(state, inv.location, 'Silver Twilight')
      if (nearest) {
        api?.doomOn?.(nearest, 1)
        api?.info?.(`🌑 你在办公室揭示了负面符号：最近的银暮秘社敌人「${nearest.name}」+1 毁灭。`)
      }
    }
    chaosAfterTest(state, inv, result, api)
  },
  resolveChaosToken(state, inv, token, api) {
    return resolveChaos(state, inv, token, api)
  },

  // ---- 轮末 ----
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 主卧（05075）强制：一轮结束时若主卧里有调查员，在最近的银暮秘社敌人上放 1 毁灭。
    const masterBedroom = byCode(state, MASTER_BEDROOM)
    if (masterBedroom && alive(state).some(inv => inv.location === masterBedroom.id)) {
      const nearest = nearestEnemyWithTrait(state, masterBedroom.id, 'Silver Twilight')
      if (nearest) {
        api?.doomOn?.(nearest, 1)
        api?.info?.(`🌑 主卧的强制：最近的银暮秘社敌人「${nearest.name}」+1 毁灭。`)
      }
    }
    if (actStep(state) === 3) {
      const entryHall = loc(state, 'entryHall')
      if (entryHall) {
        for (const enemy of (state.enemies || []).slice()) {
          if (enemy.location !== entryHall.id || !isSilverTwilight(enemy)) continue
          // 逃到入口大厅底下（场外）。
          enemy.engagedSeat = null
          for (const inv of state.investigators || []) {
            if (Array.isArray(inv.engaged)) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
          }
          const index = state.enemies.indexOf(enemy)
          if (index >= 0) state.enemies.splice(index, 1)
          flagsFor(state).beneathEntryHall = [...(flagsFor(state).beneathEntryHall || []), original(enemy)]
          api?.info?.(`🌫️ 「${enemy.name}」逃进入口大厅底下，位于场外。`)
        }
        // 重整且带冷漠的银暮秘社敌人向入口大厅移动一次。
        for (const enemy of state.enemies || []) {
          if (enemy.exhausted || !enemy.aloof || !isSilverTwilight(enemy)) continue
          if (enemy.location === entryHall.id) continue
          const next = typeof api?.stepToward === 'function'
            ? api.stepToward(enemy.location, entryHall.id)
            : (loc(state, enemy.location)?.connections || [])[0]
          if (next && next !== enemy.location) {
            api?.moveEnemy?.(enemy, next)
            api?.info?.(`🚶 「${enemy.name}」向入口大厅移动。`)
          }
        }
      }
    }
    syncOfficeAloof(state)
  },
  turnBegins(state, inv, api) {
    syncOfficeAloof(state)
    encounterRules.turnBegins?.(state, inv, api)
  },

  // ---- 结局 ----
  resolution(state, key, events, api) {
    return applyResolution(state, key, events, api)
  },
  storyResolutionKey(state, key) {
    return key === 'noResolution' ? resolutionForAct(state) : key
  },

  // 明确未实现的卡面子句（必须为空才能 development）。
  scenarioGaps: [],
  // 用战役 JSON 状态/单章逻辑忠实承载、但不是引擎通用原语的部分（不阻塞 literalCardBehavior）。
  scenarioApproximations: [
    '议程 1「抽到[[怪物]]敌人时不生成、放一边」→ 引擎没有 draw-cancel 钩子；本章用 encounterDrawn（引擎在 spawnEnemy 之前调用）给「本次抽到的怪物」打 source 标记，spawnLocation 只在该标记命中时返回非法生成点，spawnFailed 把遭遇弃牌堆里的该卡移到 scenarioZones.setAside 并用 api.addDoom(1) 放毁灭。效果/弱点等非抽牌 Monster 生成没有标记、照常放行（触发面与卡面「抽取」一致）。',
    '议程 2「猎手移动时把银暮秘社敌人视为调查员」→ 内容层按参考 hunter-extra-targets 语义重写 hunterMove：同地点有「视作调查员」的银暮秘社敌人则不移动；额外目标最近距离严格更近则向它移动；调查员更近时返回 false 交回引擎默认 hunterStep（PREY_RANK/猎物标记/等距裁决完整）；并列时合并「引擎 hunterStep 的（猎物优先级）下一步」与额外目标路线，由 lead 选择。',
    '议程 2 强制「猎手移动步骤后：重整幽灵敌人对同地点每个类人敌人造成伤害」→ 引擎 enemyPhaseAfterHunters 钩子（猎手循环后、交战/攻击前）结算，时点与参考一致。',
    '露台「弃掉合计至少 3 个智识图标的手牌：谈判」→ 本章在 behavior.actions/performAction 内实现（玩家逐张选择手牌，Wild 图标计入，费用不足不消耗团队次数；actionKind=parley 不引发趁乱攻击）。',
    '幽灵面的闹鬼能力 → flipSpectral 只替换印刷字段；locationFlipped 把幽灵面的 haunted 数组写入地点实例、翻回正常面时清除（与 P2.1 的 haunted 数据形状一致）。',
    '幽灵面的胜利点（05081/05082/05084）→ locationFlipped 把印刷胜利点写到地点实例；幕末由引擎 campaign-flow「已揭示且无线索」口径计分（与参考实现结算时机一致）。',
    '幕间故事 I 的正文 → P9 起从 story-text.js 读入（幕 1b 写 trail 记录时逐段读出）；幕间故事 II 的分支（Josef 命运）在 P9 起落到战役记录（josefDisappearedIntoTheMist / theInvestigatorsRescuedJosef / josefIsAliveAndWell），供 campaign.flow 的 interludeTwoFate 分支使用；记录在关末写入（参考实现在幕间开始时写入，状态等价、观察时机略早）。',
    '「留下的证据」线索移除「尽量平均」→ 参考实现由队长逐个选择；本实现用确定性等价规则（每次从线索最多的地点移除，平手按地点 id）。',
    '办公室「位于办公室的银暮秘社敌人失去冷漠」→ 事件驱动把结果同步到 enemy.aloof（生成/移动/回合开始/幕议程推进后），引擎没有关键词修正词表。',
    'Josef 谈判成功 → 一次结算内：flipEnemy 到 05085b、移除毁灭、记录本局限制、翻回敌人面并解除交战（等价双面卡正反面的连续结算）。',
    '银暮秘社敌人「获得胜利 0」→ 引擎的胜利点只在进入胜利区时按 victory 统计，0 点不改变任何数值；本章不改数据（等价）。',
  ],
}

export {
  awardSpectralVictory, bfsDistance, distributeClues, epilogueInterludeKey, resolutionForAct,
  setupLocations as buildSetupPlan,
}
