// 古老者之城（City of the Elder Things · 08621）· 引擎钩子（章节流程 + 城市地图/钥匙机械）。
//
// 约定（与 TDE 章节 behavior 相同）：
//   · 逐卡规则在单卡条目的 actRule / agendaRule / locationRule / enemyRule / encounterResolve / flags；
//     behavior 只做分派与本章专属机械（城市地图、钥匙、版本选择、结局记录），不按卡号写分支。
//   · 内容层（behavior）允许直接读写 state；卡条目禁止，只拿 ctx.api。
//   · 城市地图/钥匙统一走 P2 原语：
//     `src/engine/eote-city.js`（initializeCity/cityscapes/visibleOnRow/visibleOnColumn/keyOnLocation…）、
//     `src/engine/grid-map.js`（placeGridLocation/connectGrid/cityscapeOf/lookRow/lookColumn）、
//     `src/engine/scenario-keys.js`（initializeValueKeys/valueKeysAt/spendValueKeys）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, encounterResolveFor, enemyRuleFor, locationRuleFor,
  resolveDeclarativeTreacheryTest, treacheryRuleFor, treacheryTestFor,
} from '../../../../../src/cards/card-rules.js'
import {
  cityscapes as readCityscapes, initializeCity, visibleOnColumn, visibleOnRow,
} from '../../../../../src/engine/eote-city.js'
import {
  cityscapeOf, connectGrid, gridLocations, lookColumn, lookRow, placeGridLocation,
} from '../../../../../src/engine/grid-map.js'
import {
  initializeValueKeys, spendValueKeys, valueKeyIds, valueKeysAt,
} from '../../../../../src/engine/scenario-keys.js'
import { initializeTekeliDeck } from '../../../../../src/engine/eote-tekeli.js'
import {
  CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS, cityOfTheElderThingsAfterTest,
  cityOfTheElderThingsChaosToken, frostRevealed, cardNameOf,
} from './chaos.js'
import {
  CITY_KEY_VALUES, CITY_LAYOUTS, CITY_LOCATION_IDS, ENCOUNTER_DECK_BY_VERSION, ENEMY_CODES,
  HIDDEN_TUNNEL, LOCATIONS, RAW_CODES, RECORD_READS, RECORD_WRITES, REMOVED_BY_VERSION,
  SET_ASIDE_BY_VERSION, START_LOCATION_BY_VERSION, TEKELI_CODES, TEKELI_COPIES, TREACHERY_CODES,
  VERSIONS, actsForVersion, entryCodes,
} from './definition.js'
import { citySetupText } from './texts.js'

const CHAPTER_ID = 'cityOfTheElderThings'
const codeOf = card => card?.originalCode || card?.code || card
const locationOf = (state, inv) => (state.locations || []).find(item => item.id === inv?.location) || null
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const versionOf = state => VERSIONS.includes(state?.scenarioFlags?.cityVersion)
  ? state.scenarioFlags.cityVersion : 'v1'
const locationHolder = id => `location:${id}`
const investigatorHolder = seat => `investigator:${seat}`
const cloneLocation = definition => ({
  ...definition,
  id: definition.id,
  code: definition.originalCode || definition.code,
  connections: [...(definition.connections || [])],
})
// 同地点的其他未败退调查员（「把钥匙交给同地点另一位调查员」的目标）。
const sameLocationOtherInvestigators = (state, inv) => (state.investigators || [])
  .filter(other => other.seat !== inv?.seat && !other.defeated && !other.resigned && other.location === inv?.location)
// 08641 星之恐怖（重整时）：「位于星之恐怖所在地点的调查员不能花费或控制钥匙」。
const keysBlockedByReadyTerror = (state, inv) => (state.enemies || []).some(enemy =>
  enemy && !enemy.defeated && !enemy.exhausted && enemy.location === inv?.location
  && enemyRuleFor(codeOf(enemy))?.blocksKeysWhileReady === true)
// 数值钥匙的多重集支付预检（legalMoves 与 performAction 同口径）。
const canPayValueKeys = (state, seat, values = []) => {
  const pool = valueKeysAt(state, investigatorHolder(seat)).map(key => key.value)
  const used = new Set()
  for (const value of values) {
    const index = pool.findIndex((candidate, position) => !used.has(position) && String(candidate) === String(value))
    if (index < 0) return false
    used.add(index)
  }
  return true
}

// —— 初始状态容器（city/cityscape/keys 由 P2 原语写；本模块只读） ——
export const scenarioApproximations = Object.freeze([
  '三套城市布局（v1/v2/v3）按 setup1/2/3Positions 原样归一化；印刷「随机洗混 16 张城市景观」用确定性顺序填充（测试可注入 shuffle）。',
  '16 把钥匙用 scenario-keys 数值钥匙原语（holder=location:<id>），与 eote-city 的位置钥匙表不重复实现。',
  '三套 setup 的遭遇牌库在运行期按 scenarioFlags.cityVersion 收窄（definition.encounterDeck 是三版本并集，供 manifest/审计静态声明）；详情见 definition.ENCOUNTER_DECK_BY_VERSION。',
  '版本判定近似：只有 theInvestigatorsScoutedTheCityOutskirts 记录时取 v2，否则 v1；印刷的伙伴投票（三列人数）因伙伴入场尚未迁移未实现，v3 只能由 flags.cityVersionVote 注入（调试/测试）。',
  '起始地点：v1 石桥、v2 独眼尖塔、v3 石桥（参考 setup v2 右下 / v3 左上，按近似坐标映射）；起始地点在 setup 阶段揭示。',
])
export const scenarioGaps = Object.freeze([])
export const implementedEncounterCodes = Object.freeze([...entryCodes()])

export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS,
  versions: VERSIONS,
  recordReads: RECORD_READS,
  recordWrites: RECORD_WRITES,

  // ---- 开局：版本（v1/v2/v3）由战役记录/投票决定；幕牌库随版本切换（参考 DoStep 1/2/3） ----
  preScenarioSetup(state, events, api) {
    const flags = (state.scenarioFlags ||= {})
    if (flags.introResolved) return
    flags.introResolved = true
    const vote = flags.cityVersionVote || (recordsFor(state).theInvestigatorsScoutedTheCityOutskirts ? 'v2' : 'v1')
    const version = VERSIONS.includes(vote) ? vote : 'v1'
    flags.cityVersion = version
    // 三套 setup 的幕牌库不同（CityOfTheElderThings.hs 的 DoStep 1/2/3 各 setActDeck 两张）：
    // 引擎在 startScenario 里先放 definition 的默认 v1 两幕，这里按版本换成对应两幕。
    state.acts = actsForVersion(version)
    state.actIndex = 0
    api?.info?.(`🏙️ 古老者之城：使用布局 ${version}（Setup ${version === 'v1' ? 'v. I' : version === 'v2' ? 'v. II' : 'v. III'}）。`)
    api?.info?.(citySetupText(version))
  },

  // ---- 布置：16 张城市景观按版本放上网格；隐秘隧道在地图外；16 把钥匙随机放到各地点 ----
  // 地点实例必须带「未揭示 / 最大线索 / 帷幕」：移动进入时引擎的 revealLocation 用 maxClues
  // 恢复线索（若直接推裸数据，揭示后线索会变 0）；起始地点按版本在 setup 阶段揭示（参考 startAt）。
  setupLocations(state, events, helper = {}) {
    const flags = (state.scenarioFlags ||= {})
    const zones = (state.scenarioZones ||= {})
    if (!flags.cityVersion) flags.cityVersion = 'v1'
    const version = versionOf(state)
    const startId = START_LOCATION_BY_VERSION[version] || START_LOCATION_BY_VERSION.v1
    const count = Number(state.numInvestigators) || (state.investigators || []).length || 1
    state.locations ||= []
    for (const definition of Object.values(LOCATIONS)) {
      if (state.locations.some(item => item.id === definition.id)) continue
      // `card-data.js#location()` 用 cluesFixed 承载「固定线索值」（如隐秘隧道的 2），
      // 非固定地点用 clues × 调查员人数（= cluesPerInvestigator）。
      const fixed = definition.cluesFixed != null && definition.cluesFixed !== false
      const printed = Number(fixed ? definition.cluesFixed : (definition.clues ?? 0)) || 0
      const clueValue = fixed ? printed : printed * count
      const revealed = definition.id === startId
      state.locations.push({
        ...cloneLocation(definition),
        revealed,
        clues: revealed ? clueValue : 0,
        maxClues: clueValue,
        ...(definition.shroud != null ? { shroud: definition.shroud } : {}),
      })
    }
    // 版本起始地点与 definition.startLocation 不同（v2/v3）时，把调查员放到版本起点。
    if (startId !== state.scenario?.startLocation) {
      for (const inv of state.investigators || []) if (inv.location === state.scenario?.startLocation) inv.location = startId
    }
    const map = behavior.setupCityMap(state, { version, shuffle: flags.cityShuffle || null })
    zones.setAside = [...(state.scenario?.setAsideLocations || [])]
    zones.removed = []
    zones.victory = zones.victory || []
    flags.encounterDeckReady = true
    flags.hiddenTunnelRevealed = flags.hiddenTunnelRevealed === true
    // 08621 特别规则：若调查队侦察过城市外围，领队在起始地点揭示后先发现一半线索（向上取整）。
    const start = state.locations.find(item => item.id === startId)
    if (start && start.revealed && (start.clues || 0) > 0 && recordsFor(state).theInvestigatorsScoutedTheCityOutskirts) {
      const amount = Math.ceil((start.clues || 0) / 2)
      const lead = (state.investigators || []).find(inv => !inv.defeated && !inv.resigned)
      if (lead && amount > 0) {
        start.clues -= amount
        lead.clues = (lead.clues || 0) + amount
        helper.info?.(state, events, `🏙️ 侦察了城市外围：领队在起始地点发现 ${amount} 个线索。`)
      }
    }
    // Tekeli-li 牌库（参考 setup #tekelili）：7 个卡面按印刷份数组成独立的 16 张牌库。
    try {
      initializeTekeliDeck(state, { cards: [...TEKELI_CODES], copies: [...TEKELI_COPIES] })
    } catch { /* 已初始化（重复布置/存档恢复）时保持原牌库 */ }
    helper.info?.(state, events, `🏙️ 古老者之城：使用布局 ${version}，16 张城市景观入场、16 把钥匙随机放置；隐秘隧道隐藏在地图外。`)
    // 本函数已把地点写入 state.locations；返回空数组，避免引擎把 startLocation 字符串当数组迭代。
    void map
    return []
  },

  /**
   * 建城市地图：`initializeCity` 分配 16 个城市景观格并放地点、`connectGrid` 生成相邻连接；
   * 隐秘隧道用 isolated 格子单独放置；16 把钥匙（skull/cultist/tablet/elderthing/0/-1/-2/-3 ×2）
   * 按 `shuffle`（缺省确定性顺序）放到各城市景观（holder = location:<id>）。
   */
  setupCityMap(state, { version = 'v1', shuffle = null } = {}) {
    const key = VERSIONS.includes(version) ? version : 'v1'
    const cells = CITY_LAYOUTS[key]
    const placeLocation = id => {
      const definition = Object.values(LOCATIONS).find(item => item.id === id)
      if (!definition) return null
      const location = cloneLocation(definition)
      state.locations ||= []
      if (!state.locations.some(item => item.id === id)) state.locations.push(location)
      return location
    }
    const cityscapes = cells.map(cell => ({ row: cell.row, column: cell.column, locationIds: [...CITY_LOCATION_IDS] }))
    const existing = readCityscapes(state)
    if (existing) {
      // 已建图：只读返回（幂等），方便存档恢复/测试重复调用。
      return { cityscapes: existing, startLocation: START_LOCATION_BY_VERSION[key] }
    }
    const assignment = initializeCity(state, { cityscapes, keys: [] }, { ...(shuffle ? { shuffle } : {}), placeLocation })
    if (assignment === false) throw new Error('城市景观初始化失败：格子/候选地点不合法')
    connectGrid(state)
    // 隐秘隧道：地图外独立格（不可通过普通邻接进入；由幕/行动揭示后进入）。
    placeGridLocation(state, HIDDEN_TUNNEL, 6, 6, { placeLocation }, { isolated: true })
    // 16 把钥匙：先按地点顺序列 holder，再按版本/确定性顺序初始化（测试可传 shuffle）。
    const holders = [...CITY_LOCATION_IDS]
    const ordered = typeof shuffle === 'function' ? shuffle([...holders]) : holders
    if (!Array.isArray(ordered) || ordered.length !== holders.length) throw new TypeError('钥匙洗牌回调必须返回同一数量')
    const specs = CITY_KEY_VALUES.map((value, index) => ({
      id: `city-key-${index + 1}`, value, holder: locationHolder(ordered[index]),
    }))
    initializeValueKeys(state, specs)
    return { cityscapes: readCityscapes(state), startLocation: START_LOCATION_BY_VERSION[key], keyCount: specs.length }
  },

  // ---- 遭遇牌库：按版本 gather（参考 CityOfTheElderThings.hs DoStep 1/2/3） ----
  // definition.encounterDeck 是三套 setup 的并集（静态声明/审计用），真实开局在这里收窄为
  // 本章该版本的牌库，并把「放一边」的遭遇组放进场景区（act 1 背面再洗回牌库）。
  modifyDeck(state, deck) {
    const version = versionOf(state)
    const versionDeck = ENCOUNTER_DECK_BY_VERSION[version]
    if (!Array.isArray(versionDeck)) return deck
    const zones = (state.scenarioZones ||= {})
    const aside = [...(SET_ASIDE_BY_VERSION[version] || [])]
    const kept = Array.isArray(zones.setAside) ? zones.setAside : []
    zones.setAside = [...kept, ...aside]
    zones.removed = [...(REMOVED_BY_VERSION[version] || [])]
    return [...versionDeck]
  },

  // ---- 混乱袋追加（参考 setup 的 addElderThingToken / checkDifficulty） ----
  afterChaosBagSetup(state) {
    const version = versionOf(state)
    // v1/v2 的 setup 追加 1 个 [elder_thing] 标记；v3 不追加。
    if (version !== 'v3') state.chaosBag.push('elderthing')
    const extraDoom = state.difficulty === 'expert' ? 2 : state.difficulty === 'hard' ? 1 : 0
    if (extraDoom) state.doom = (state.doom || 0) + extraDoom
  },

  // ---- 地图/钥匙只读入口 ----
  cityscapeAt(state, locationId) {
    return cityscapeOf(state, locationId)
  },
  mapRows(state) {
    return [...new Set((readCityscapes(state) || []).map(item => item.row))].sort((a, b) => a - b)
  },
  mapColumns(state) {
    return [...new Set((readCityscapes(state) || []).map(item => item.column))].sort((a, b) => a - b)
  },
  gridLocationsInRow(state, row) {
    return gridLocations(state, { row })
  },
  /** 议程行动「查看所在行/列一个城市景观的已揭示面」：私密窥视，调用方只发给该座位。 */
  lookAtRow(state, seat, row) {
    return visibleOnRow(state, row, { seat })
  },
  lookAtColumn(state, seat, column) {
    return visibleOnColumn(state, column, { seat })
  },
  lookRowCards(state, inv) {
    const cell = cityscapeOf(state, inv?.location)
    return cell ? lookRow(state, cell.row) : []
  },
  lookColumnCards(state, inv) {
    const cell = cityscapeOf(state, inv?.location)
    return cell ? lookColumn(state, cell.column) : []
  },
  keysAtLocation(state, locationId) {
    return valueKeysAt(state, locationHolder(locationId))
  },
  keysControlled(state, seat) {
    return valueKeysAt(state, investigatorHolder(seat))
  },
  keyCount(state, seat) {
    return behavior.keysControlled(state, seat).length
  },
  /** 免费取得地点钥匙：地点无线索时，把该地点一把钥匙的控制权交给调查员。 */
  claimKey(state, seat, locationId) {
    const location = (state.locations || []).find(item => item.id === locationId)
    if (!location) return false
    if ((location.clues || 0) > 0) return false
    const keys = behavior.keysAtLocation(state, locationId)
    if (!keys.length) return false
    const claimed = spendValueKeys(state, locationHolder(locationId), { values: [keys[0].value], destination: investigatorHolder(seat) })
    return claimed
  },
  /** [action] 把任意数量自己控制的钥匙交给同地点另一位调查员。 */
  giveKeys(state, seat, targetSeat, values = null) {
    const keys = behavior.keysControlled(state, seat)
    if (!keys.length) return false
    const selected = values || keys.map(key => key.value)
    return spendValueKeys(state, investigatorHolder(seat), { values: selected, destination: investigatorHolder(targetSeat) })
  },
  /** cultist 符号：把一把控制的钥匙放到你所在地点。 */
  placeControlledKeyAtLocation(state, seat, locationId) {
    const keys = behavior.keysControlled(state, seat)
    if (!keys.length) return false
    return spendValueKeys(state, investigatorHolder(seat), { values: [keys[0].value], destination: locationHolder(locationId) })
  },

  // ---- 幕/议程钩子：逐卡 actRule/agendaRule.onReveal/onActions 分派 ----
  actReveal(state, act, api) {
    const rule = actRuleFor(codeOf(act))
    if (!rule) return false
    if (typeof rule.onReveal === 'string') {
      const handler = ACT_REVEAL_HANDLERS[rule.onReveal]
      if (handler) return handler(state, act, rule, api) !== false
      if (rule.onReveal.startsWith('resolution')) {
        behavior.resolution(state, rule.onReveal, [], api)
        api?.finish?.(rule.onReveal)
        return true
      }
      return false
    }
    if (typeof rule.onReveal === 'function') return rule.onReveal(state, act, api) === true
    return false
  },
  agendaReveal(state, agenda, api, type = 'campaignRule') {
    const rule = agendaRuleFor(codeOf(agenda))
    if (!rule?.onReveal) return false
    if (typeof rule.onReveal === 'function') return rule.onReveal(state, agenda, api) === true
    const handler = AGENDA_REVEAL_HANDLERS[rule.onReveal]
    if (handler) return handler(state, agenda, rule, api) !== false
    // 08623 背面（→结局 2）：引擎的 runAgendaReveal 交回剧本后，用真实 finishScenario 结束本关。
    if (String(rule.onReveal).startsWith('resolution')) {
      if (!Object.hasOwn(state.scenario?.resolutions || {}, rule.onReveal)) return false
      behavior.resolution(state, rule.onReveal, [], api)
      api?.finish?.(rule.onReveal)
      return true
    }
    return false
  },

  // ---- 目标检查 ----
  // 引擎的 checkLinearAct 只调用本钩子、不读返回值（目标推进由剧本自己发起，与
  // theWitchingHour / theSecretName 等章节同口径）：达成后用 runtime 的真实 advanceAct() 推进。
  checkObjectives(state, api = {}) {
    const act = state.acts?.[state.actIndex ?? 0]
    const rule = actRuleFor(codeOf(act))
    if (!rule?.objective) return false
    let met = false
    if (rule.objective.type === 'cityKeys') {
      const records = recordsFor(state)
      const remember = rule.objective.remember || []
      met = remember.length > 0 && remember.every(key => records[key] === true)
    } else if (rule.objective.type === 'hiddenTunnel') {
      const tunnel = (state.locations || []).find(item => item.id === HIDDEN_TUNNEL)
      const alive = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
      met = Boolean(tunnel) && (tunnel.clues || 0) === 0 && alive.length > 0
        && alive.every(inv => inv.location === HIDDEN_TUNNEL)
    }
    if (met && typeof api?.advanceAct === 'function') api.advanceAct()
    return met
  },

  // ---- 移动限制：隐秘隧道未揭示前不能进入（孤立格） ----
  moveError(state, inv, destination, id) {
    const toId = typeof destination === 'string' ? destination : (destination?.id ?? id)
    if (toId !== HIDDEN_TUNNEL) {
      const cell = cityscapeOf(state, toId)
      return cell ? null : '目标不是城市景观或隐秘隧道'
    }
    if (state.scenarioFlags?.hiddenTunnelRevealed !== true) return '隐秘隧道尚未揭示，不能进入'
    return null
  },

  // ---- Keys 特别规则：控制钥匙的调查员被击败/退场时，把钥匙放到其所在地点 ----
  // 线索仍由引擎默认的 placeCluesOnLocation 处理，因此本钩子返回 false。
  investigatorEliminated(state, inv, clues, api) {
    const keys = behavior.keysControlled(state, inv.seat)
    if (!keys.length) return false
    const destination = locationHolder(inv.location)
    let moved = 0
    for (const key of keys) {
      if (spendValueKeys(state, investigatorHolder(inv.seat), { values: [key.value], destination })) moved += 1
    }
    if (moved) api?.info?.(`🔑 ${inv.name} 退场：把 ${moved} 把钥匙留在「${locationOf(state, inv)?.name || inv.location}」。`)
    return false
  },

  // ---- 08629（幕 2 v3）强制：修格斯或精英敌人进入地点时，击败该地点的所有古老者敌人 ----
  // 引擎读点：敌人移动后（movement.js/enemies.js/locations.js 的 enemyMoved）与生成后
  // （enemies.js/turn-flow.js 的 enemySpawned）。声明在 08629.js 的 actRule.forcedOnEnemyEnter。
  enemyMoved(state, enemy, previous, api) {
    return applyForcedEnemyEnter(state, enemy, api)
  },
  enemySpawned(state, enemy, api) {
    return applyForcedEnemyEnter(state, enemy, api)
  },

  // ---- 行动：议程自由行动、幕 1 钥匙研究、幕 2 追踪、进入隐秘隧道 ----
  actions(state, inv, api) {
    const moves = []
    const flags = (state.scenarioFlags ||= {})
    const location = locationOf(state, inv)
    const agendaRule = agendaRuleFor(codeOf(state.agendas?.[state.agendaIndex ?? 0]))
    for (const free of agendaRule?.freeActions || []) {
      if (free.oncePerRound && flags[`cityActions:${inv.seat}:${state.round}`]?.[free.rule]) continue
      if ((inv.clues || 0) < (free.clues || 0)) continue
      moves.push({ action: 'scenarioAction', rule: free.rule, actions: 0, clues: free.clues || 0, label: free.label })
    }
    const hereRule = locationRuleFor(codeOf(location))
    for (const option of hereRule?.actions || []) {
      if (option.teamOnce && flags[`cityTeamOnce:${option.rule}`]) continue
      if (option.values && option.values.some(value => !valueKeyAtPlaceExists(state, inv, value))) continue
      moves.push({ action: 'scenarioAction', rule: `loc:${option.rule}`, actions: 1, data: option, label: option.label })
    }
    const roundKey = `cityActions:${inv.seat}:${state.round}`
    const used = (flags[roundKey] || {})
    // Keys 特别规则（08621）：[fast] 所在地点无线索时取得地点上 1 把钥匙；
    // [action] 把任意数量自己控制的钥匙交给同地点的另一位调查员。
    // 08641 星之恐怖重整时，其所在地点的调查员不能花费或控制钥匙（enemyRule.blocksKeysWhileReady）。
    if (!keysBlockedByReadyTerror(state, inv)) {
      const here = locationOf(state, inv)
      if (here && (here.clues || 0) === 0 && behavior.keysAtLocation(state, here.id).length > 0) {
        moves.push({ action: 'scenarioAction', rule: 'key:claim', actions: 0, label: `🔑 取得「${here.name}」上的一把钥匙（快速）` })
      }
      if (behavior.keysControlled(state, inv.seat).length > 0
        && sameLocationOtherInvestigators(state, inv).length > 0) {
        moves.push({ action: 'scenarioAction', rule: 'key:give', actions: 1, label: '🔑 把自己的钥匙交给同地点的另一位调查员' })
      }
    }
    if ((inv.clues || 0) >= 1 && !(used.look || used.cityLookRowOrColumn)) {
      moves.push({ action: 'scenarioAction', rule: 'cityLookRowOrColumn', actions: 0, label: '🗺️ 花费 1 线索：查看所在行/列一个城市景观的已揭示面（每轮一次）' })
    }
    if ((inv.clues || 0) >= 3 && !(used.cityMoveAlongRowOrColumn)) {
      moves.push({ action: 'scenarioAction', rule: 'cityMoveAlongRowOrColumn', actions: 0, label: '🗺️ 花费 3 线索：移动到所在行/列的任意地点（每轮一次）' })
    }
    const act = state.acts?.[state.actIndex ?? 0]
    const actRule = actRuleFor(codeOf(act))
    if (actRule?.keyActions) {
      for (const option of actRule.keyActions) {
        if (!canPayValueKeys(state, inv.seat, option.values)) continue
        moves.push({ action: 'scenarioAction', rule: `actKey:${option.action}`, actions: 1, data: option, label: option.label })
      }
    }
    if (flags.hiddenTunnelRevealed === true && inv.location !== HIDDEN_TUNNEL) {
      moves.push({ action: 'scenarioAction', rule: 'enterHiddenTunnel', actions: 1, label: '🕳️ 进入隐秘隧道' })
    }
    if (actRule?.actTwoActions) {
      for (const option of actRule.actTwoActions) {
        if (option.values && !canPayValueKeys(state, inv.seat, option.values)) continue
        moves.push({ action: 'scenarioAction', rule: `actTwo:${option.action}`, actions: 1, data: option, label: option.label })
      }
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move) return false
    const act = state.acts?.[state.actIndex ?? 0]
    const actRule = actRuleFor(codeOf(act))
    const flags = (state.scenarioFlags ||= {})
    const roundKey = `cityActions:${inv.seat}:${state.round}`
    flags[roundKey] ||= {}
    // Keys 特别规则：[fast] 取得地点钥匙 / [action] 交出自己控制的钥匙（目标座位经真实选择事务）。
    if (move.rule === 'key:claim') {
      if (keysBlockedByReadyTerror(state, inv)) return false
      const here = locationOf(state, inv)
      if (!here || (here.clues || 0) > 0) return false
      const claimed = behavior.claimKey(state, inv.seat, here.id)
      if (claimed) api?.info?.(`🔑 ${inv.name} 取得了「${here.name}」上的一把钥匙。`)
      return claimed
    }
    if (move.rule === 'key:give') {
      if (keysBlockedByReadyTerror(state, inv)) return false
      const targets = sameLocationOtherInvestigators(state, inv)
      if (!targets.length || !behavior.keysControlled(state, inv.seat).length) return false
      const answer = api?.choice?.({ kind: 'investigator', source: 'key:give', seat: inv.seat,
        prompt: '把钥匙交给同地点的哪位调查员？',
        options: targets.map(other => ({ id: String(other.seat), label: other.name })) })
      const targetSeat = Number(answer)
      if (!Number.isInteger(targetSeat) || !targets.some(other => other.seat === targetSeat)) return false
      const given = behavior.giveKeys(state, inv.seat, targetSeat)
      if (given) api?.info?.(`🔑 ${inv.name} 把自己控制的钥匙交给了${state.investigators[targetSeat]?.name || `座位 ${targetSeat}`}。`)
      return given
    }
    if (move.rule === 'cityLookRowOrColumn') {
      if ((inv.clues || 0) < 1) return false
      inv.clues -= 1
      flags[roundKey]['cityLookRowOrColumn'] = true
      const row = api?.chooseRowOrColumn?.()
      api?.info?.('🗺️ 花费 1 线索：查看所在行/列一个城市景观的已揭示面。')
      return { look: row ?? behavior.mapRows(state) }
    }
    if (move.rule === 'cityMoveAlongRowOrColumn') {
      if ((inv.clues || 0) < 3) return false
      inv.clues -= 3
      flags[roundKey]['cityMoveAlongRowOrColumn'] = true
      api?.info?.('🗺️ 花费 3 线索：移动到所在行/列的任意地点。')
      return true
    }
    if (move.rule.startsWith('loc:')) {
      const name = move.rule.slice('loc:'.length)
      const handler = LOCATION_ACTION_HANDLERS[name]
      if (!handler) return false
      const result = handler(state, inv, move.data || {}, api)
      if (result !== false && move.data?.teamOnce) (state.scenarioFlags ||= {})['cityTeamOnce:' + name] = true
      return result
    }
    if (move.rule === 'enterHiddenTunnel') {
      if (flags.hiddenTunnelRevealed !== true) return false
      inv.location = HIDDEN_TUNNEL
      api?.info?.('🕳️ 进入隐秘隧道。')
      return true
    }
    if (move.rule.startsWith('actKey:')) {
      const action = move.rule.slice('actKey:'.length)
      const option = (actRule?.keyActions || []).find(item => item.action === action)
      if (!option) return false
      const spent = spendValueKeys(state, investigatorHolder(inv.seat), { values: option.values })
      if (!spent) return false
      const records = recordsFor(state)
      for (const key of option.remember || []) records[key] = true
      api?.info?.(`🔑 ${option.label}：已记录。`)
      return true
    }
    if (move.rule.startsWith('actTwo:')) {
      const action = move.rule.slice('actTwo:'.length)
      const option = (actRule?.actTwoActions || []).find(item => item.action === action)
      if (!option) return false
      const spent = spendValueKeys(state, investigatorHolder(inv.seat), { values: option.values })
      if (!spent) return false
      api?.info?.(`🔑 ${option.label}。`)
      return true
    }
    const rule = encounterResolveFor(codeOf(move.card || {}))
    if (rule) return rule(state, inv, move.card, api, {})
    return false
  },

  // ---- 遭遇卡结算 ----
  resolveEncounter(state, inv, card, api) {
    const code = codeOf(card)
    const entryResolve = encounterResolveFor(code)
    if (entryResolve) return entryResolve(state, inv, card, api, { location: locationOf(state, inv) })
    const kind = treacheryRuleFor(code)?.resolveKind
    const handler = kind && TREACHERY_HANDLERS[kind]
    if (handler) return handler(state, inv, card, api) !== false
    const declarative = treacheryTestFor(code)
    if (declarative) return resolveDeclarativeTreacheryTest(state, inv, card, api, declarative)
    return false
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token) {
    return cityOfTheElderThingsChaosToken(state, inv, token)
  },

  afterTest(state, inv, result, api) {
    const riders = cityOfTheElderThingsAfterTest(state, inv, result) || []
    for (const rider of riders) {
      if (rider === 'placeKey') behavior.placeControlledKeyAtLocation(state, inv.seat, inv.location)
      else if (rider === 'autoFail') {
        // 由引擎的 testAutoFail 钩子真正生效；这里只记事件，避免重复改值。
        ;(state.scenarioFlags ||= {}).lastAutoFailReason = 'tabletFrost'
      } else if (rider === 'autoFailDamage') {
        inv.damage = (inv.damage || 0) + 1
        ;(state.scenarioFlags ||= {}).lastAutoFailReason = 'tabletFrostDamage'
      } else if (rider === 'nearestEnemy') nearestEnemyMovesAndAttacks(state, inv, api)
    }
    if (frostRevealed(result)) (state.scenarioFlags ||= {}).frostRevealedThisTest = true
    return riders
  },

  testAutoFail(state, inv, result) {
    const tokens = result?.drawn || []
    // 08645 崩塌废墟：本次检定期间揭示与「钥匙面」一致的标记 → 自动失败。
    const keyFaces = state.scenarioFlags?.crumblingRuinsKeys
    if (Array.isArray(keyFaces) && keyFaces.length
      && tokens.some(token => keyFaces.includes(String(token)))) return true
    if (!frostRevealed(result)) return false
    const hard = ['hard', 'expert'].includes(String(state.difficulty || 'standard'))
    return tokens.includes('tablet') && (hard || !result?.success)
  },

  // ---- 敌人修正：星之恐怖 +3/人生命 ----
  enemyStatModifier(state, enemy, stat) {
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule?.perInvestigatorHealth) return 0
    if (stat !== 'health') return 0
    return 3 * (Number(state.numInvestigators) || (state.investigators || []).length || 1)
  },

  // 引擎签名：resolution(state, resolutionKey, events, api)（同 TIC/TDE/Heart of Madness）。
  // 参考 CityOfTheElderThings.hs ScenarioResolution：R1 记录「队伍找到了隐秘隧道」，
  // R2 记录「队伍被引导至隐秘隧道」，noResolution 两者都不记录。
  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    records.theTeamFoundTheHiddenTunnel = key === 'resolution1'
    records.theTeamWasGuidedToTheHiddenTunnel = key === 'resolution2'
    return key
  },

  // 结局分派（备用读点；08623 背面直接声明 resolution2，finalResolution 供旧调用方/测试读取）。
  finalResolution(state) {
    return state.scenarioFlags?.hiddenTunnelRevealed === true ? 'resolution1' : 'resolution2'
  },

  resolutionIds: ['noResolution', 'resolution1', 'resolution2'],
}

function nearestEnemyMovesAndAttacks(state, inv, api) {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location)
  if (!enemies.length) return false
  const target = enemies.sort((a, b) =>
    neighborRank(state, a.location, inv.location) - neighborRank(state, b.location, inv.location))[0]
  if (target.location !== inv.location) target.location = inv.location
  inv.damage = (inv.damage || 0) + (ALL_CARDS[codeOf(target)]?.damage || 1)
  inv.horror = (inv.horror || 0) + (ALL_CARDS[codeOf(target)]?.horror || 0)
  target.engagedSeat = inv.seat
  api?.info?.(`🏙️ 最近的敌人向 ${inv.name} 移动并攻击。`)
  return true
}
function neighborRank(state, fromId, toId) {
  if (!fromId || !toId) return 99
  if (fromId === toId) return 0
  const from = (state.locations || []).find(item => item.id === fromId)
  return from && (from.connections || []).includes(toId) ? 1 : 2
}

// 08629 actRule.forcedOnEnemyEnter = 'defeatElderThingsAtLocation' 的引擎读点实现。
// 参考 PursuitOfTheUnknownV3.hs：EnemyEnters #when (LocationWithEnemy (EnemyWithTrait ElderThing))
// (hasAnyTrait [Shoggoth, Elite]) → 击败该地点的所有古老者敌人。
const ENTERING_TRAITS = Object.freeze(['shoggoth', 'elite'])
const ELDER_THING_TRAIT = 'elder thing'
const enemyTraitsOf = enemy => {
  const traits = ALL_CARDS[codeOf(enemy)]?.traits || enemy?.traits || []
  return traits.map(trait => String(trait).toLowerCase())
}
function applyForcedEnemyEnter(state, enemy, api) {
  const act = state.acts?.[state.actIndex ?? 0]
  const rule = actRuleFor(codeOf(act))
  if (rule?.forcedOnEnemyEnter !== 'defeatElderThingsAtLocation') return false
  if (!enemy || enemy.defeated || !enemy.location) return false
  const enteringTraits = enemyTraitsOf(enemy)
  if (!enteringTraits.some(trait => ENTERING_TRAITS.includes(trait))) return false
  const targets = (state.enemies || []).filter(other => other !== enemy && !other.defeated
    && other.location === enemy.location && enemyTraitsOf(other).includes(ELDER_THING_TRAIT))
  if (!targets.length) return false
  let defeated = 0
  for (const target of targets) {
    if (typeof api?.defeatEnemy === 'function') {
      if (api.defeatEnemy(target)) defeated += 1
    } else {
      // 单元测试直调钩子（无 runtime）时的最小落地：标记击败即可被目标判定读到。
      target.defeated = true
      defeated += 1
    }
  }
  if (!defeated) return false
  const locationName = (state.locations || []).find(item => item.id === enemy.location)?.name || enemy.location
  api?.info?.(`🌠 ${cardNameOf(codeOf(enemy))}进入「${locationName}」：击败该地点的 ${defeated} 个古老者敌人。`)
  return true
}

export { HIDDEN_TUNNEL, RAW_CODES, CITY_LOCATION_IDS, ENEMY_CODES, TREACHERY_CODES }
export const enemyCodes = ENEMY_CODES


// ---------------------------------------------------------------------------
// 逐卡数据驱动的结算实现（behavior 只按 kind/rule 分派，不按卡号分支）。
// ---------------------------------------------------------------------------

function valueKeyAtPlaceExists(state, inv, value) {
  return behavior.keysControlled(state, inv.seat).some(key => String(key.value) === String(value))
}

const addFrostToken = (state, api) => {
  state.chaosBag ||= []
  state.chaosBag.push('frost')
  api?.addChaosToken?.('frost')
  api?.info?.('❄️ 混乱袋加入 1 个 [frost] 标记。')
}

// 议程背面按名字分派的处理器（扩展点；08623 的 'resolution2' 走 agendaReveal 的通用
// resolution* 分支：写记录 + 真实 finishScenario）。
export const AGENDA_REVEAL_HANDLERS = Object.freeze({})

export const ACT_REVEAL_HANDLERS = Object.freeze({
  // 08624/08625/08626 背面（参考 SprawlingCityV1/V2/V3.hs AdvanceAct）：
  //   洗入「放一边」的遭遇组 + 遭遇弃牌堆 → 揭示隐秘隧道 → 版本追加效果。
  act1BackV1(state, act, rule, api) {
    shuffleSetAsideIntoDeck(state, api, SET_ASIDE_BY_VERSION.v1.filter(code => code !== RAW_CODES.terrorOfTheStars))
    state.scenarioFlags ||= {}
    state.scenarioFlags.hiddenTunnelRevealed = true
    api?.reveal?.(HIDDEN_TUNNEL)
    // 星之恐怖：从放一边取出，在隐秘隧道横置入场。
    if (api?.takeFromSetAside?.(RAW_CODES.terrorOfTheStars)) {
      api?.spawn?.(RAW_CODES.terrorOfTheStars, HIDDEN_TUNNEL, { exhausted: true })
    }
    api?.info?.('🕳️ 错综复杂之城背面：修格斯组与遭遇弃牌堆洗入牌库；揭示隐秘隧道；星之恐怖在隧道横置入场。')
    return true
  },
  act1BackV2(state, act, rule, api) {
    shuffleSetAsideIntoDeck(state, api, SET_ASIDE_BY_VERSION.v2)
    state.scenarioFlags ||= {}
    state.scenarioFlags.hiddenTunnelRevealed = true
    api?.reveal?.(HIDDEN_TUNNEL)
    addFrostToken(state, api)
    api?.info?.('🕳️ 错综复杂之城背面：冰中生物组与遭遇弃牌堆洗入牌库；揭示隐秘隧道；加入 1 个 [frost]。')
    return true
  },
  act1BackV3(state, act, rule, api) {
    shuffleSetAsideIntoDeck(state, api, SET_ASIDE_BY_VERSION.v3)
    state.scenarioFlags ||= {}
    state.scenarioFlags.hiddenTunnelRevealed = true
    api?.reveal?.(HIDDEN_TUNNEL)
    for (const inv of state.investigators || []) {
      if (!inv.defeated && !inv.resigned) api?.drawEncounter?.(inv.seat)
    }
    api?.info?.('🕳️ 错综复杂之城背面：修格斯组与遭遇弃牌堆洗入牌库；揭示隐秘隧道；每位调查员抽取 1 张遭遇牌。')
    return true
  },
})

// 背面「洗入放一边的遭遇组 + 遭遇弃牌堆」：只把本版本放一边的卡移出场景区，
// 其余放一边的东西（未来可能出现的地点）原样保留。
function shuffleSetAsideIntoDeck(state, api, codes = []) {
  const zones = (state.scenarioZones ||= {})
  const aside = Array.isArray(zones.setAside) ? zones.setAside : []
  const moved = []
  for (const code of codes) {
    if (!aside.includes(code)) continue
    if (api?.takeFromSetAside?.(code)) moved.push(code)
  }
  const discard = Array.isArray(state.encounterDiscard) ? state.encounterDiscard.splice(0) : []
  if (!moved.length && !discard.length) return []
  if (typeof api?.shuffleIntoEncounterDeck === 'function') {
    api.shuffleIntoEncounterDeck([...moved, ...discard])
  } else {
    state.encounterDeck = [...(state.encounterDeck || []), ...moved, ...discard]
  }
  return [...moved, ...discard]
}

export const TREACHERY_HANDLERS = Object.freeze({
  // 08644 真相开端：意志(2)；本次检定难度 + 所在地点上的钥匙数 + 你控制的钥匙数；
  // 失败受到 2 点恐惧（失败差值 ≥3 时改为 3 点）。
  dawningOfTheTruth(state, inv, card, api) {
    const here = locationOf(state, inv)
    const hereKeys = here ? behavior.keysAtLocation(state, here.id).length : 0
    const controlled = behavior.keyCount(state, inv.seat)
    const difficulty = 2 + hereKeys + controlled
    // 引擎签名：test(seat, skill, difficulty, resolve, skillBonus?, source?, options?)。
    api?.test?.(inv.seat, 'willpower', difficulty, result => {
      if (result?.success) return
      const failedBy = Math.max(0, Number(result?.difficulty ?? difficulty) - Number(result?.value ?? 0))
      inv.horror = (inv.horror || 0) + (failedBy >= 3 ? 3 : 2)
      api?.info?.(failedBy >= 3 ? '😱 真相开端：受到 3 点恐惧。' : '😱 真相开端：受到 2 点恐惧。')
    }, 0, { type: 'scenario', code: '08644', name: '真相开端', action: 'revelation', ability: true })
    return true
  },

  // 08645 崩塌废墟：敏捷(3)；本次检定期间若揭示与「地点上的钥匙 / 同地点调查员控制的钥匙」
  // 一致的混乱标记则自动失败；失败每低于难度 1 点受 1 点伤害（至少 1）。
  crumblingRuins(state, inv, card, api) {
    const here = locationOf(state, inv)
    const keys = [
      ...(here ? behavior.keysAtLocation(state, here.id) : []),
      ...(state.investigators || [])
        .filter(other => other.location === inv.location && !other.defeated && !other.resigned)
        .flatMap(other => behavior.keysControlled(state, other.seat)),
    ]
    const faces = [...new Set(keys.map(key => String(key.value)))]
    const flags = (state.scenarioFlags ||= {})
    const previous = flags.crumblingRuinsKeys
    flags.crumblingRuinsKeys = faces
    try {
      api?.test?.(inv.seat, 'agility', 3, result => {
        if (result?.success) return
        const failedBy = Math.max(1, Number(result?.difficulty ?? 3) - Number(result?.value ?? 0))
        inv.damage = (inv.damage || 0) + failedBy
        api?.info?.(`🧱 崩塌废墟：受到 ${failedBy} 点伤害。`)
      }, 0, { type: 'scenario', code: '08645', name: '崩塌废墟', action: 'revelation', ability: true })
    } finally {
      // 自动失败条件只属于本次检定：结算完立即恢复（引擎的 testAutoFail 在检定内部读取）。
      if (previous === undefined) delete flags.crumblingRuinsKeys
      else flags.crumblingRuinsKeys = previous
    }
    return true
  },

  // 08646 冻伤：放入威胁区（1 点「伤害」计数器；治愈近似为弃掉自身）。
  frostbitten(state, inv, card, api) {
    if (api?.threat) api.threat(inv.seat, '08646', { threatEffect: { counters: 1, healAs: 'damage' } })
    else {
      inv.threat ||= []
      inv.threat.push({ id: 'threat-08646', code: '08646', originalCode: '08646', counters: 1, forcedFrost: 'damage' })
    }
    api?.info?.('🥶 冻伤进入威胁区域（可如同你身上的 1 点伤害被治愈）。')
    return true
  },

  // 08647 附身：放入威胁区（1 点「恐惧」计数器；threatHorrorSink 原语接管治愈）。
  possessed(state, inv, card, api) {
    if (api?.threat) api.threat(inv.seat, '08647', { threatEffect: { counters: 1, threatHorrorSink: true } })
    else {
      inv.threat ||= []
      inv.threat.push({ id: 'threat-08647', code: '08647', originalCode: '08647', counters: 1, threatHorrorSink: true })
    }
    api?.info?.('👁️ 附身进入威胁区域（可如同你身上的 1 点恐惧被治愈）。')
    return true
  },
})

export const LOCATION_ACTION_HANDLERS = Object.freeze({
  // 08630 隐秘隧道：检定(4)；成功把隧道 1 线索放回供应堆（花 skull 钥匙则 2）。
  tunnelInvestigate(state, inv, data, api) {
    const location = (state.locations || []).find(item => item.id === inv.location)
    if (!location) return false
    const difficulty = 4
    api?.test?.(inv.seat, 'willpower', difficulty, result => {
      if (!result?.success) return
      let amount = 1
      if (spendValueKeys(state, investigatorHolder(inv.seat), { values: ['skull'] })) amount = 2
      location.clues = Math.max(0, (location.clues || 0) - amount)
      api?.info?.(`🕳️ 隐秘隧道：把 ${amount} 个线索放回供应堆。`)
    }, 0, { type: 'scenario', code: RAW_CODES.hiddenTunnel, name: '隐秘隧道', action: 'activate', ability: true })
    return true
  },
  // 08631 古代天文馆：花费 2 个「0」钥匙；记录研究。
  planetariumStudy(state, inv, data, api) {
    if (!spendValueKeys(state, investigatorHolder(inv.seat), { values: data.values })) return false
    if (data.remember) recordsFor(state)[data.remember] = true
    addFrostToken(state, api)
    api?.info?.('🔭 古代天文馆：拍摄天文图照片（记录），混乱袋加入 1 个 [frost]。')
    return true
  },
  // 08632 石桥：战斗/敏捷(4) 发现 1 线索（无选择入口时按战斗检定，难度相同）。
  bridgeDiscover(state, inv, data, api) {
    const location = (state.locations || []).find(item => item.id === inv.location)
    if (!location) return false
    api?.test?.(inv.seat, 'combat', 4, result => {
      if (!result?.success) return
      if ((location.clues || 0) > 0) { location.clues -= 1; inv.clues = (inv.clues || 0) + 1 }
      api?.info?.('🌉 石桥：发现 1 个线索。')
    }, 0, { type: 'scenario', code: RAW_CODES.stoneBridge, name: '石桥', action: 'activate', ability: true })
    return true
  },
  // 08632 石桥：移动到另一个石桥地点。
  bridgeTravel(state, inv, data, api) {
    const bridgeCodes = new Set(['08632'])
    const target = (state.locations || []).find(item => item.id !== inv.location
      && bridgeCodes.has(String(item.originalCode || item.code)))
    if (!target) return false
    inv.location = target.id
    api?.info?.('🌉 石桥：移动到另一个石桥地点。')
    return true
  },
  // 08633 圆柱塔：花费 2 个「-2」钥匙；抽 2、得 2 资源、移除 2 个 frost；记录。
  towerStudy(state, inv, data, api) {
    if (!spendValueKeys(state, investigatorHolder(inv.seat), { values: data.values })) return false
    inv.deck ||= []
    for (let index = 0; index < 2; index += 1) { const card = inv.deck.pop(); if (card) inv.hand.push(card) }
    inv.resources = (inv.resources || 0) + 2
    removeFrostTokens(state, 2)
    if (data.remember) recordsFor(state)[data.remember] = true
    api?.info?.('🗼 圆柱塔：抽 2 张牌、获得 2 资源、移除 2 个 [frost]（记录）。')
    return true
  },
  // 08635 地图资料室：花费 2 个「-3」钥匙；揭示 3 个地点并各发现 1 线索；记录。
  mapRoomStudy(state, inv, data, api) {
    if (!spendValueKeys(state, investigatorHolder(inv.seat), { values: data.values })) return false
    const hidden = (state.locations || []).filter(item => !item.revealed && item.id !== HIDDEN_TUNNEL).slice(0, 3)
    for (const location of hidden) { location.revealed = true; location.clues = Math.max(0, (location.clues || 0) - 1) }
    if (data.remember) recordsFor(state)[data.remember] = true
    api?.info?.('🗺️ 地图资料室：揭示 3 个地点并各发现 1 个线索（记录）。')
    return true
  },
  // 08636 无顶堡垒：花费 2 个「-1」钥匙；移除密谋 1 毁灭或弃掉非精英敌人；记录。
  rampartStudy(state, inv, data, api) {
    if (!spendValueKeys(state, investigatorHolder(inv.seat), { values: data.values })) return false
    if ((state.doom || 0) > 0) state.doom -= 1
    else {
      const enemy = (state.enemies || []).find(item => !item.elite && !item.defeated)
      if (enemy) enemy.defeated = true
    }
    if (data.remember) recordsFor(state)[data.remember] = true
    api?.info?.('🏰 无顶堡垒：移除 1 个毁灭或弃掉一个非精英敌人（记录）。')
    return true
  },
  // 08637 破败街道：发现最后一个线索后，发现连接地点的 1 个线索。
  streetsReactionClue(state, inv, data, api) {
    const here = (state.locations || []).find(item => item.id === inv.location)
    const neighbor = here && (state.locations || []).find(item => (here.connections || []).includes(item.id) && (item.clues || 0) > 0)
    if (!neighbor) return false
    neighbor.clues -= 1
    inv.clues = (inv.clues || 0) + 1
    api?.info?.('🧱 破败街道：发现连接地点的 1 个线索。')
    return true
  },
  // 08638 巨大尖顶：把本行另一地点 1 个钥匙移到巨大尖顶。
  moveKeyToSpires(state, inv, data, api) {
    const target = (state.locations || []).find(item => item.id === inv.location)
    if (!target) return false
    const cell = cityscapeOf(state, inv.location)
    if (!cell) return false
    const source = (state.locations || []).find(item => {
      const other = cityscapeOf(state, item.id)
      return other && other.row === cell.row && item.id !== inv.location && behavior.keysAtLocation(state, item.id).length
    })
    if (!source) return false
    const key = behavior.keysAtLocation(state, source.id)[0]
    spendValueKeys(state, locationHolder(source.id), { values: [key.value], destination: locationHolder(inv.location) })
    api?.info?.('🗼 巨大尖顶：移动本行另一个地点的 1 个钥匙到尖顶。')
    return true
  },
  // 08639 埋没通路：把本地点 1 个线索移到本行/列一个未揭示地点。
  moveClueToHidden(state, inv, data, api) {
    const here = (state.locations || []).find(item => item.id === inv.location)
    if (!here || (here.clues || 0) < 1) return false
    const cell = cityscapeOf(state, inv.location)
    const target = (state.locations || []).find(item => {
      const other = cityscapeOf(state, item.id)
      return other && !item.revealed && ((cell && (other.row === cell.row || other.column === cell.column)))
    })
    if (!target) return false
    here.clues -= 1
    target.clues = (target.clues || 0) + 1
    api?.info?.('🕳️ 埋没通路：把 1 个线索移到同行/同列的未揭示地点。')
    return true
  },
  // 08640 古老者之庙：没有线索时交换两个有钥匙地点的所有钥匙。
  swapKeys(state, inv, data, api) {
    const temple = (state.locations || []).find(item => item.id === inv.location)
    if (!temple || (temple.clues || 0) > 0) return false
    const holders = CITY_LOCATION_IDS.filter(id => behavior.keysAtLocation(state, id).length >= 2)
    if (holders.length < 2) return false
    const [a, b] = holders
    const keysA = behavior.keysAtLocation(state, a).map(key => key.value)
    const keysB = behavior.keysAtLocation(state, b).map(key => key.value)
    for (const value of keysA) spendValueKeys(state, locationHolder(a), { values: [value], destination: locationHolder(b) })
    for (const value of keysB) spendValueKeys(state, locationHolder(b), { values: [value], destination: locationHolder(a) })
    api?.info?.('🏛️ 古老者之庙：交换两个地点的所有钥匙。')
    return true
  },
})

function removeFrostTokens(state, amount) {
  let left = amount
  state.chaosBag = (state.chaosBag || []).filter(token => {
    if (left > 0 && token === 'frost') { left -= 1; return false }
    return true
  })
  return amount - left
}

function spendValueKeysFor(state, inv, values) {
  return spendValueKeys(state, investigatorHolder(inv.seat), { values })
}

export { addFrostToken }
