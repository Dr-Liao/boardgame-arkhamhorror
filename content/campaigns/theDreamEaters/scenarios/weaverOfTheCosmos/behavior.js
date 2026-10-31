// 《编织宇宙》（Weaver of the Cosmos，06333）· 章节行为（P8 w-p8-f）
//
// 职责分工：
//   · 本文件只写流程（setup/幕推进/旋转/目标/结局/章节级数据分派）；
//   · 单卡规则在 `src/cards/encounter-entries/theDreamEaters/{weaverOfTheCosmos,_shared}/**`
//     （encounterResolve / locationRule / enemyScript / actRule / agendaRule / threatAction …）；
//   · 共享钩子全部来自 `../../encounter-rules.js`（TCU 同构），覆盖时显式转发。
//
// 覆盖率声明：12 项章节目录检查里，本文件负责 setupAndZones / actsAndAgendas /
// locationsAndConnections / encounterBehaviors / chaosEffects / resolutionsAndRecords / saveReplay；
// literalCardBehavior 由单卡条目证据 + 测试承担；storyText / browserAcceptance 是 P8 pending。
import {
  encounterRules, activeInvestigators, original, hasTrait, playerOrder, here,
} from '../../encounter-rules.js'
import {
  actRuleFor, agendaRuleFor, enemyScriptFor, entryFlags, locationRuleFor,
} from '../../../../../src/cards/card-rules.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { scenario, WEB, RING, EXPANSION, LEGS_HOME, ATLACH_NACHA, LEGS, SPINNER, WEB_SPINNER, ACT_CODES, AGENDA_CODES, RAW_CODES as RAW } from './definition.js'
import { weaverChaosToken, weaverChaosAfterTest } from './chaos.js'

const codeOf = card => String(card?.originalCode || card?.code || '')
const locById = (state, id) => (state.locations || []).find(location => location.id === id) || null
const recordOf = (state, key) => state?.campaign?.records?.[key] ?? null
const flag = (state, key) => state?.scenarioFlags?.[key] ?? null
const flagsOf = state => (state.scenarioFlags ||= {})
const zonesOf = state => (state.scenarioZones ||= {})
const isHard = state => ['hard', 'expert'].includes(state?.difficulty)

// 本章单卡条目（审计 literalCardBehavior 的兜底证据；逐卡条目仍是主证据）。
export const implementedEncounterCodes = Object.freeze([
  RAW.c06334, RAW.c06335, RAW.c06336, RAW.c06337, RAW.c06338, RAW.c06339, RAW.c06340, RAW.c06341, RAW.c06342, RAW.c06343,
  RAW.c06344, RAW.c06345, RAW.c06346, RAW.c06347, RAW.c06348, RAW.c06349, RAW.c06350, RAW.c06351, RAW.c06352, RAW.c06353, RAW.c06354,
  RAW.c06084, RAW.c06085, RAW.c06086, RAW.c06087, RAW.c06088, RAW.c06089, RAW.c06090, RAW.c06091, RAW.c06092, RAW.c06093, RAW.c06094,
  RAW.c06095, RAW.c06096, RAW.c06097, RAW.c06098, RAW.c06099, RAW.c06100, RAW.c06101, RAW.c06102, RAW.c06103, RAW.c06104, RAW.c06105,
  RAW.c06106, RAW.c06107, RAW.c06108, RAW.c06109, RAW.c06271, RAW.c06272, RAW.c06273, RAW.c06274,
])

export const scenarioApproximations = Object.freeze([
  '阿特拉克·纳克亚的中心牌面（Global 位置）没有实体：幕 1 背面把四条腿放到 11/5/9/7，幕 2 推进时直接在毁灭最多的地点生成 06346（翻面）。',
  '「旋转阿特拉克·纳克亚」= 沿 8 段巨网环（RING 顺序）把四条腿（幕 2）或 06346（幕 3）各移动 1 个地点；中心牌的 45° 视觉旋转以 scenarioFlags.atlachRotation 记录。',
  '15 张印刷巨网在 definition 落地为 11 个实例（4 个初始 + 7 个展开）；4 张未用副本不建实例，抽取顺序按固定表（见 definition 注释）。',
  '「Steps of the Bridge」记录数的开局毁灭在 afterDeckSetup 直接写在地点实例上（引擎没有 setup 阶段的 doom API 参数）。',
  '遭遇组 Ancient Evils / Chilling Cold 是跨循环共享组（TDE 包内重印），遭遇定义取 cards-data 中对应 encounterCode 的记录。',
  '[[cultist]] 的「再揭示一个标记」由引擎的额外标记语义承担；本章 chaos.afterTest 只结算「失败且所在地点有[[古神]]敌人 → 其攻击」。',
])

export const scenarioGaps = Object.freeze([])

// ---------------------------------------------------------------------------
// 大网环（4→5→…→11→4）
// ---------------------------------------------------------------------------
function ringLocations(state) {
  return RING.map(id => locById(state, id)).filter(Boolean)
}

function nextRingLocation(state, fromId, times = 1) {
  const ring = ringLocations(state)
  if (!ring.length) return null
  const index = ring.findIndex(location => location.id === fromId)
  if (index < 0) return ring[0]
  return ring[(index + times) % ring.length]
}

const legsEnemies = state => (state.enemies || []).filter(enemy => LEGS.includes(codeOf(enemy)))
const atlachEnemy = state => (state.enemies || []).find(enemy => codeOf(enemy) === ATLACH_NACHA) || null
const atlachFlipped = state => flag(state, 'atlachNachaEnemySide') === true

function legsInVictory(state) {
  return (state.victoryDisplay || []).filter(card => LEGS.includes(codeOf(card))).length
}

// 「旋转」：幕 2 转四条腿，幕 3 转 06346 本身；每转一次沿环移动一格。
function spinAtlachNacha(state, api, times) {
  const steps = Math.max(0, Number(times) || 0)
  if (!steps) return 0
  const flipped = atlachFlipped(state)
  let moved = 0
  for (let step = 0; step < steps; step += 1) {
    const movers = (flipped ? [atlachEnemy(state)] : legsEnemies(state)).filter(Boolean)
    for (const enemy of movers) {
      const target = nextRingLocation(state, enemy.location, 1)
      if (!target || target.id === enemy.location) continue
      api.moveEnemy?.(enemy, target.id)
      moved += 1
    }
    flagsOf(state).atlachRotation = ((Number(flag(state, 'atlachRotation')) || 0) + 45) % 360
  }
  if (moved) {
    api.info?.(flipped
      ? `🕷️ 阿特拉克·纳克亚顺时针旋转 ${steps} 次（移动 ${moved} 格）。`
      : `🕷️ 四条阿特拉克·纳克亚之腿顺时针旋转 ${steps} 次（共移动 ${moved} 格）。`)
  }
  return moved
}

// 幕 1 背面：移除 1-3、展开 7 张、按标签放四条腿、把 2 张黑暗中的织网者洗入遭遇牌库。
function expandWeb(state, api) {
  const zones = zonesOf(state)
  zones.removed ||= []
  for (const id of WEB.slice(0, 3)) {
    const location = locById(state, id)
    if (!location) continue
    zones.removed.push(location.originalCode || location.code)
    api.remove?.(id)
  }
  for (const id of EXPANSION) {
    if (locById(state, id)) continue
    api.place?.(id)
  }
  // 四条腿：06347→theGreatWeb11、06348→5、06349→9、06350→7。
  for (const [code, locationId] of Object.entries(LEGS_HOME)) {
    if ((state.enemies || []).some(enemy => codeOf(enemy) === code)) continue
    if (!locById(state, locationId)) continue
    api.spawn?.(code, locationId)
  }
  flagsOf(state).atlachCenter = { assembled: true, enemySide: false }
  flagsOf(state).atlachRotation = Number(flag(state, 'atlachRotation')) || 0
  // 2 张黑暗中的织网者从「放一边」洗入遭遇牌库；顺手把遭遇弃牌堆洗回牌库。
  const aside = zones.setAside || []
  for (let index = 0; index < 2; index += 1) {
    const at = aside.indexOf(SPINNER)
    if (at >= 0) aside.splice(at, 1)
  }
  api.shuffleIntoEncounterDeck?.([SPINNER, SPINNER])
  api.shuffleDiscard?.()
  api.info?.('🕸️ 大网展开：移除 1-3 号网，放上 7 张巨网组成 8 段环；四条腿出现在 11/5/9/7。')
}

// 幕 2 背面：把阿特拉克·纳克亚翻到敌人面，放在毁灭最多的地点。
function flipAtlachNacha(state, api) {
  flagsOf(state).atlachCenter = { assembled: true, enemySide: true }
  flagsOf(state).atlachNachaEnemySide = true
  const existing = atlachEnemy(state)
  const ranked = (state.locations || [])
    .map(location => ({ location, doom: Number(location.doom) || 0 }))
    .sort((left, right) => right.doom - left.doom)
  const target = ranked[0]?.location || null
  if (!target) return
  if (existing) {
    api.moveEnemy?.(existing, target.id)
    return
  }
  const spawned = api.spawn?.(ATLACH_NACHA, target.id)
  if (spawned) api.info?.(`🕷️ 阿特拉克·纳克亚翻至敌人面，生成在毁灭最多的「${target.name}」。`)
}

// 幕 3 推进：按战役记录决定 R3/R4/R5（参考实现的 R1 只是经验结算点）。
function finishFinale(state, api) {
  const foundAWayOut = recordOf(state, 'theInvestigatorsFoundAWayOutOfTheUnderworld') === true
  const trapped = recordOf(state, 'theInvestigatorsAreTrappedInAtlachNachasRealm') === true
  const key = foundAWayOut ? 'resolution3' : trapped ? 'resolution4' : 'resolution5'
  flagsOf(state).finaleResolution = key
  const text = scenario.interludeTexts?.theSpiderQueen4
  api.present?.(text?.body || '[pending-self-translation] The Spider Queen 4', {
    kind: 'story', title: text?.title || 'Scenario Interlude: The Spider Queen',
  })
  api.finish?.(key)
}

// 幕 1 背面的剧情幕间（The Spider Queen 1-4 的分支与记录写入）。
function applySpiderQueen(state, api) {
  const survived = recordOf(state, 'randolphSurvivedTheDescent') === true
  const knowsTheTruth = recordOf(state, 'theBlackCatKnowsTheTruth') === true
  const texts = scenario.interludeTexts || {}
  let index = 4
  if (survived && !knowsTheTruth) index = 3
  else if (survived) index = 2
  const text = texts[`theSpiderQueen${index}`] || texts.theSpiderQueen1
  api.present?.(text?.body || `[pending-self-translation] The Spider Queen ${index}`, {
    kind: 'story', title: text?.title || 'Scenario Interlude: The Spider Queen',
  })
  if (survived && !knowsTheTruth) {
    api.setCampaignRecord?.('theInvestigatorsAreTrappedInAtlachNachasRealm', true)
    const token = state.difficulty === 'easy' ? '-3'
      : state.difficulty === 'hard' ? '-5'
        : state.difficulty === 'expert' ? '-7' : '-4'
    api.addChaosToken?.(token, 1)
    api.info?.(`🕸️ 记录「调查员被困在阿特拉克·纳克亚的领域」；混乱袋加入 ${token} 标记。`)
  }
  if (!survived) api.info?.('🕸️ 伦道夫没能活过下降：直接进入 The Spider Queen 4。')
}

// 各混乱袋档位的「负面标记数值」（旋转 X 用；[skull] 按本章 chaos.js 的场地毁灭口径）。
function chaosTokenValue(state, token) {
  if (typeof token === 'number') return token
  const text = String(token || '')
  const numeric = /^([+-]?\d+)$/.exec(text)
  if (numeric) return Number(numeric[1])
  if (['autofail', 'auto_fail', 'eldersign', 'elder_sign'].includes(text)) return null
  if (['skull', 'cultist', 'tablet', 'elderthing', 'elder_thing'].includes(text)) {
    const normalized = text === 'elder_thing' ? 'elderthing' : text
    return weaverChaosToken(state, null, normalized, null)
  }
  return null
}

// ---------------------------------------------------------------------------
// 遭遇（spawn 数据分派）
// ---------------------------------------------------------------------------
function locationDistance(state, from, to) {
  if (from === to) return 0
  const distance = new Map([[from, 0]])
  const queue = [from]
  for (const current of queue) {
    const location = locById(state, current)
    for (const next of location?.connections || []) {
      if (distance.has(next) || !locById(state, next)) continue
      distance.set(next, distance.get(current) + 1)
      queue.push(next)
    }
  }
  return distance.get(to) ?? Infinity
}

function pickLocation(api, candidates, prompt) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const answer = api.choose?.({
    kind: 'location', seat: api.seatForChoice ?? 0, prompt,
    options: candidates.map(location => ({ id: location.id, label: location.name })),
  })
  return candidates.find(location => location.id === String(answer)) || candidates[0]
}

function spawnByRule(state, code, fallbackLoc, engagedSeat, api) {
  const rule = entryFlags(code)?.spawn
  if (!rule) return fallbackLoc
  const active = activeInvestigators(state)
  const empty = (state.locations || []).filter(location =>
    !active.some(inv => inv.location === location.id))
  if (rule.kind === 'anyEmptyLocation') {
    const candidates = empty.length ? empty : (state.locations || [])
    if (!candidates.length) return '__nowhere__'
    const index = Math.floor((api.random?.() ?? 0.5) * candidates.length)
    return candidates[Math.min(index, candidates.length - 1)].id
  }
  if (rule.kind === 'anyConnectingLocation') {
    const from = (state.investigators || []).find(inv => inv.seat === engagedSeat)?.location
      ?? state.investigators?.[state.campaign?.leadSeat ?? 0]?.location
    const hereLoc = locById(state, from)
    const candidates = (hereLoc?.connections || []).map(id => locById(state, id)).filter(Boolean)
    return pickLocation(api, candidates, `选择「${ALL_CARDS[code]?.nameZh || code}」生成的连接地点。`)?.id || fallbackLoc
  }
  if (rule.kind === 'nearestTrait' || rule.kind === 'titles') {
    const from = (state.investigators || []).find(inv => inv.seat === engagedSeat)?.location
      ?? state.investigators?.[state.campaign?.leadSeat ?? 0]?.location
    const matches = (state.locations || []).filter(location => rule.kind === 'titles'
      ? (rule.titles || []).includes(location.name)
      : (rule.traits || []).some(trait => (location.traits || []).some(value =>
        String(value).toLowerCase() === String(trait).toLowerCase())))
    const pool = rule.emptyIfAble && matches.some(location => !active.some(inv => inv.location === location.id))
      ? matches.filter(location => !active.some(inv => inv.location === location.id))
      : matches
    if (!pool.length) return fallbackLoc
    const ranked = pool
      .map(location => ({ location, steps: locationDistance(state, from, location.id) }))
      .sort((left, right) => left.steps - right.steps)
    const best = ranked[0].steps
    const candidates = ranked.filter(entry => entry.steps === best).map(entry => entry.location)
    return pickLocation(api, candidates, `选择「${ALL_CARDS[code]?.nameZh || code}」生成的地点。`)?.id || fallbackLoc
  }
  if (rule.kind === 'engagedWithLowestSkill') {
    const from = (state.investigators || []).find(inv => inv.seat === engagedSeat)?.location
      ?? state.investigators?.[state.campaign?.leadSeat ?? 0]?.location
    const candidates = active.filter(inv => inv.location === from)
    if (!candidates.length) return fallbackLoc
    const scored = candidates.map(inv => ({ inv, value: Number(inv[rule.skill]) || 0 }))
      .sort((left, right) => left.value - right.value)
    return scored[0].inv.location
  }
  return fallbackLoc
}

// 06103 恶心蛛网：附属地点上的[[蜘蛛]]敌人获得反击与警戒（引擎直接读 enemy.retaliate/alert，
// 章节在阶段切换/敌人入场后同步一次；移除附属后恢复印刷关键词）。
function syncSickeningWebs(state) {
  for (const enemy of state.enemies || []) {
    if (!enemy.weaverSickeningWebs) continue
    const printed = state.scenario?.enemies?.[codeOf(enemy)] || {}
    enemy.retaliate = printed.retaliate === true
    enemy.alert = printed.alert || false
    delete enemy.weaverSickeningWebs
  }
  for (const location of state.locations || []) {
    const attached = (location.attachments || []).some(attachment =>
      entryFlags(codeOf(attachment))?.spiderKeywords)
    if (!attached) continue
    for (const enemy of (state.enemies || []).filter(entry =>
      entry.location === location.id && hasTrait(entry, 'Spider'))) {
      enemy.retaliate = true
      enemy.alert = true
      enemy.weaverSickeningWebs = true
    }
  }
}

// ---------------------------------------------------------------------------
// behavior
// ---------------------------------------------------------------------------
export const behavior = {
  ...encounterRules,
  id: 'weaverOfTheCosmos',
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,

  // ---- 开局 ----
  preScenarioSetup(state, events, api) {
    const flags = flagsOf(state)
    flags.moveCounts = { round: 1, seats: {} }
    flags.setupDoomApplied = false
    void events
    void api
  },

  afterChaosBagSetup(state) {
    // 三张议程都是「+2[per_investigator] 毁灭阈值」：printed（7/9/11）+ 2 × 调查员数。
    for (const agenda of state.agendas || []) {
      const amount = entryFlags(codeOf(agenda))?.doomThresholdPerInvestigator
      if (!amount) continue
      agenda.doomThreshold = (Number(agenda.doomThreshold) || 0)
        + Number(amount) * (state.numInvestigators || 1)
    }
  },

  setupLocations(state, events, helper = {}) {
    const zones = zonesOf(state)
    const flags = flagsOf(state)
    zones.setAside = [ATLACH_NACHA, ...LEGS, SPINNER, SPINNER]
    zones.removed = []
    zones.locationSeq = 0
    flags.startWeb = WEB[0]
    flags.bottomWeb = WEB[3]
    helper.info?.('🕸️ 4 张巨网纵向排开：调查员从最上方的巨网开始。')
    return [...WEB]
  },

  setupEnemies() {
    // 阿特拉克·纳克亚/四条腿/黑暗中的织网者全部放在一边，幕 1 背面与遭遇牌库接管。
  },

  afterDeckSetup(state, events, helper = {}) {
    // 按战役记录「Steps of the Bridge」的 tally 数在**最下方**地点放 0-4 毁灭。
    const tally = Number(recordOf(state, 'stepsOfTheBridge') ?? 0)
    const count = tally >= 12 ? 4 : tally >= 9 ? 3 : tally >= 6 ? 2 : tally >= 3 ? 1 : 0
    if (count > 0) {
      const bottom = locById(state, WEB[3])
      if (bottom) {
        bottom.doom = (Number(bottom.doom) || 0) + count
        helper.info?.(`🕸️ 「Steps of the Bridge」${tally} 个计数：在最下方巨网放 ${count} 个毁灭标记。`)
      }
    }
    flagsOf(state).setupDoom = { tally, count }
    void events
  },

  spawnLocation(state, code, fallbackLoc, engagedSeat, api) {
    return spawnByRule(state, code, fallbackLoc, engagedSeat, api)
  },

  spawnForbiddenAt() {
    return false
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    syncSickeningWebs(state)
  },

  // ---- 阶段 ----
  phaseBegan(state, phase, api) {
    syncSickeningWebs(state)
    const flags = flagsOf(state)
    if (phase === 'mythos') {
      // 06342：调查阶段结束（神话阶段开始）时，有调查员的巨网各放 1 毁灭。
      for (const location of (state.locations || [])) {
        const rule = locationRuleFor(codeOf(location))
        rule?.onInvestigationPhaseEnd?.(state, location, api)
      }
      // 幕 2/3 的强制：神话阶段开始时揭示一个随机标记，负修正则旋转 X 次。
      const act = state.acts?.[state.actIndex]
      const actRule = act ? actRuleFor(codeOf(act)) : null
      if (actRule?.mythosSpin && (state.chaosBag || []).length) {
        const index = Math.floor((api.random?.() ?? 0.5) * state.chaosBag.length)
        const token = state.chaosBag[Math.min(index, state.chaosBag.length - 1)]
        const value = chaosTokenValue(state, token)
        api.info?.(`🕷️ 神话阶段开始：揭示混乱标记「${api.tokenLabel?.(token) || token}」（${value ?? '无修正'}）。`)
        if (value != null && value < 0) spinAtlachNacha(state, api, -value)
      }
    }
    if (phase === 'investigation' && !flags.setupDoomApplied) {
      flags.setupDoomApplied = true
      void api
    }
  },

  // ---- 幕 / 议程 ----
  actReveal(state, act, api) {
    const rule = actRuleFor(codeOf(act))
    if (rule?.onReveal) return rule.onReveal(state, act, api)
    return true // campaignRule 揭示由本章接管（无额外正面效果）
  },

  agendaReveal(state, agenda, api) {
    const rule = agendaRuleFor(codeOf(agenda))
    if (rule?.onReveal) return rule.onReveal(state, agenda, api)
    return true
  },

  agendaAdvancing(state, agenda, api) {
    const rule = agendaRuleFor(codeOf(agenda))
    const advance = rule?.advance
    if (!advance) return
    if (advance.shuffleEncounterDiscard) {
      api.shuffleDiscard?.()
      api.info?.('🃏 议程推进：遭遇弃牌堆洗回遭遇牌库。')
    }
    if (advance.finish) {
      api.finish?.(advance.finish)
    }
  },

  actLeftPlay(state, act, api) {
    const code = codeOf(act)
    if (code === ACT_CODES[0]) {
      applySpiderQueen(state, api)
      expandWeb(state, api)
      return
    }
    if (code === ACT_CODES[1]) {
      flipAtlachNacha(state, api)
      return
    }
    if (code === ACT_CODES[2]) finishFinale(state, api)
  },

  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const code = codeOf(act)
    const flags = flagsOf(state)
    if (flags.advancing) return
    if (code === ACT_CODES[0]) {
      const bottom = locById(state, WEB[3])
      if (!bottom) return
      const active = activeInvestigators(state)
      const allAtBottom = active.length > 0 && active.every(inv => inv.location === bottom.id)
      const required = 3 * (state.numInvestigators || 1)
      const clues = active.reduce((sum, inv) => sum + (inv.clues || 0), 0)
      if (!allAtBottom || clues < required) return
      flags.advancing = true
      api.advanceAct?.()
      flags.advancing = false
      return
    }
    if (code === ACT_CODES[1]) {
      if (legsInVictory(state) < 4) return
      flags.advancing = true
      api.advanceAct?.()
      flags.advancing = false
      return
    }
    if (code === ACT_CODES[2]) {
      const defeated = flags.atlachNachaDefeated === true || flag(state, 'atlachNachaDefeated') === true
      if (!defeated) return
      flags.advancing = true
      api.advanceAct?.()
      flags.advancing = false
    }
  },

  // ---- 玩家行动（幕数据 / 地点条目 / 附属在敌人身上的织网者）----
  actions(state, inv) {
    const moves = encounterRules.actions?.(state, inv) || []
    const act = state.acts?.[state.actIndex]
    const actRule = act ? actRuleFor(codeOf(act)) : null
    const actAction = actRule?.actions
    if (actAction?.rule === 'spendClueDamageAncientOne' && (inv.clues || 0) >= (actAction.clueCost || 1)) {
      const ancient = (state.enemies || []).find(enemy =>
        enemy.location === inv.location && hasTrait(enemy, actAction.trait || 'Ancient One'))
      if (ancient) {
        moves.push({
          action: 'scenarioAction', rule: 'spendClueDamageAncientOne', actions: 1,
          label: `🕸️ 花费 1 个线索：对「${ancient.name}」造成 ${actAction.damage || 3} 点伤害`,
        })
      }
    }
    const location = here(state, inv)
    if (location) {
      locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
      // 06103 恶心蛛网：附属地点上的 [action] 摆脱（战斗(3) 或 敏捷(3)）。
      for (const attachment of location.attachments || []) {
        const spec = entryFlags(codeOf(attachment))?.discardAction
        if (!spec) continue
        moves.push({
          action: 'scenarioAction', rule: `discardSickeningWebs:${attachment.id}`, actions: 1,
          label: `🕸️ 检定${(spec.skills || ['combat']).join('/')}(${spec.difficulty ?? 3})：弃掉「${ALL_CARDS[codeOf(attachment)]?.nameZh || '恶心蛛网'}」`,
        })
      }
    }
    for (const enemy of (state.enemies || []).filter(entry => entry.location === inv.location)) {
      const spinner = (enemy.attachments || []).find(attachment =>
        entryFlags(codeOf(attachment))?.discardSkillTest)
      if (spinner) {
        moves.push({
          action: 'scenarioAction', rule: `discardSpinner:${enemy.id}`, actions: 1,
          label: `🕷️ 检定任意技能(5)：弃掉「${ALL_CARDS[codeOf(spinner)]?.nameZh || '黑暗中的织网者'}」`,
        })
      }
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'spendClueDamageAncientOne') {
      const act = state.acts?.[state.actIndex]
      const actAction = act ? actRuleFor(codeOf(act))?.actions : null
      const cost = actAction?.clueCost || 1
      if ((inv.clues || 0) < cost) return
      api.spendClues?.(inv.seat, cost)
      const ancient = (state.enemies || []).find(enemy =>
        enemy.location === inv.location && hasTrait(enemy, actAction?.trait || 'Ancient One'))
      if (ancient) {
        api.damageEnemy?.(ancient, actAction?.damage || 3)
        api.info?.(`🕸️ ${inv.name} 花费 ${cost} 个线索，对「${ancient.name}」造成 ${actAction?.damage || 3} 点伤害。`)
      }
      return
    }
    if (String(move.rule).startsWith('discardSpinner:')) {
      const enemyId = String(move.rule).slice('discardSpinner:'.length)
      const enemy = (state.enemies || []).find(entry => String(entry.id) === enemyId)
      const spinner = (enemy?.attachments || []).find(attachment => entryFlags(codeOf(attachment))?.discardSkillTest)
      if (!enemy || !spinner) return
      const spec = entryFlags(codeOf(spinner))?.discardSkillTest
      const skills = spec?.skills || ['willpower', 'intellect', 'combat', 'agility']
      const skill = api.choose?.({
        kind: 'skill', source: codeOf(spinner), seat: inv.seat,
        prompt: '选择检定技能（任意技能，难度 5）。',
        options: skills.map(value => ({ id: value, label: value })),
      }) || skills[0]
      api.test?.(inv.seat, String(skill), Number(spec?.difficulty ?? 5), result => {
        if (!result.success) return
        api.detachEnemyAttachment?.(enemy.id, spinner.id)
        ;(state.encounterDiscard ||= []).push(codeOf(spinner))
        api.info?.(`🕷️ ${inv.name} 检定成功：弃掉附属在「${enemy.name}」上的「黑暗中的织网者」。`)
      })
      return
    }
    const location = here(state, inv)
    if (String(move.rule).startsWith('discardSickeningWebs:')) {
      const attachmentId = String(move.rule).slice('discardSickeningWebs:'.length)
      const attachment = (location?.attachments || []).find(entry => entry.id === attachmentId)
      if (!attachment) return
      const spec = entryFlags(codeOf(attachment))?.discardAction || {}
      const skills = spec.skills || ['combat', 'agility']
      const answer = skills.length === 1 || typeof api.choose !== 'function'
        ? skills[0]
        : api.choose({
          kind: 'skill', source: codeOf(attachment), seat: inv.seat,
          prompt: '选择摆脱恶心蛛网的检定技能。',
          options: skills.map(skill => ({ id: skill, label: skill })),
        })
      api.test?.(inv.seat, String(answer || skills[0]), Number(spec.difficulty ?? 3), result => {
        if (!result.success) return
        api.detachLocationAttachment?.(location.id, attachment.id)
        ;(state.encounterDiscard ||= []).push(codeOf(attachment))
        api.info?.(`🕸️ ${inv.name} 检定成功：弃掉「${location.name}」上的恶心蛛网。`)
      })
      return
    }
    if (location && locationRuleFor(codeOf(location))?.performAction?.(state, inv, move, api)) return
    encounterRules.performAction?.(state, inv, move, api)
  },

  beforeInvestigate(state, inv, location, api) {
    if (!location) return
    locationRuleFor(codeOf(location))?.beforeInvestigate?.(state, inv, location, api)
  },

  locationEntered(state, inv, location, api) {
    // 「每轮最多 N 次移动」（06353）的计数载体；由 moveError 读取。
    const flags = flagsOf(state)
    const counts = flags.moveCounts ||= { round: state.round, seats: {} }
    if (counts.round !== state.round) { counts.round = state.round; counts.seats = {} }
    counts.seats[inv.seat] = (counts.seats[inv.seat] || 0) + 1
    void location
    void api
  },

  moveError(state, inv, targetLocation) {
    // 共享 moveError：06084 灰织蛛重整封锁、06085 失败限制（本轮不能移动）。
    const shared = encounterRules.moveError?.(state, inv, targetLocation)
    if (shared) return shared
    // 06103 恶心蛛网：附属地点的调查员不能移动离开。
    const current = locById(state, inv?.location)
    const netted = (current?.attachments || []).find(attachment =>
      entryFlags(codeOf(attachment))?.blocksMovementOut)
    if (netted) return `「${ALL_CARDS[codeOf(netted)]?.nameZh || '恶心蛛网'}」：不能移动离开「${current.name}」`
    const flags = flagsOf(state)?.moveCounts
    if (!flags || flags.round !== state.round) return undefined
    const counts = flags.seats || {}
    const moved = counts[inv?.seat] || 0
    for (const threat of inv?.threat || []) {
      const max = entryFlags(codeOf(threat))?.maxMovesPerRound
      if (Number.isFinite(max) && moved >= max) {
        return `「${ALL_CARDS[codeOf(threat)]?.nameZh || '陷入网中'}」：每轮最多 ${max} 次移动`
      }
    }
    return undefined
  },

  afterEvade(state, inv, enemy, result, api) {
    // 共享 afterEvade 派发 enemyScript.onEvade（06346–06350 的躲避替代）。
    encounterRules.afterEvade?.(state, inv, enemy, result, api)
  },

  enemyAttackModifier(state, enemy) {
    let damage = 0
    let horror = 0
    for (const attachment of enemy?.attachments || []) {
      const bonus = entryFlags(codeOf(attachment))?.enemyAttackBonus
      if (!bonus) continue
      damage += Number(bonus.damage) || 0
      horror += Number(bonus.horror) || 0
    }
    if (!damage && !horror) return undefined
    return { damage, horror }
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token, api) {
    return weaverChaosToken(state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    weaverChaosAfterTest(state, inv, result, api)
  },

  // ---- 结局 ----
  resolution(state, key, events, api) {
    const records = state.campaign?.records || (state.campaign = state.campaign || {}, state.campaign.records = {})
    const active = activeInvestigators(state)
    if (key === 'noResolution') {
      records.theBridgeWasCompleted = true
      for (const inv of active) api.defeat?.(inv, 'killed')
      return { award: false, bonus: 0 }
    }
    if (key === 'resolution1') {
      records.theBridgeWasDestroyed = true
      return { award: true, bonus: 5 }
    }
    if (key === 'resolution2') {
      records.theBridgeWasCompleted = true
      for (const inv of active) api.defeat?.(inv, 'insane')
      return { award: true, bonus: 0 }
    }
    if (key === 'resolution3') {
      records.theInvestigatorsReturnedToReality = true
      for (const inv of active) api.trauma?.(inv.seat, 'physical', 2)
      return { award: true, bonus: 5 }
    }
    if (key === 'resolution4') {
      records.theInvestigatorsNeverEscaped = true
      for (const inv of active) api.defeat?.(inv, 'insane')
      return { award: true, bonus: 5 }
    }
    records.theInvestigatorsAreStillInTheDreamlands = true
    for (const inv of active) api.trauma?.(inv.seat, 'physical', 2)
    void events
    return { award: true, bonus: 5 }
  },

  allResigned(state, api) {
    api.finish?.('noResolution')
  },
}
