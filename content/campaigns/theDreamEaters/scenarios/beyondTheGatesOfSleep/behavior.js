// 梦境门外（Beyond the Gates of Sleep · 06039）· 引擎钩子（章节流程）。
//
// 约定：`behavior = { ...encounterRules, id, ... }`；覆盖共享钩子时显式转发 encounterRules.<hook>(...)。
// 逐卡规则在单卡条目的 actRule / agendaRule / locationRule / enemyScript / flags；
// behavior 只做分派与本章专属流程（开局梦境、幕 3 背面组牌库、Steps 地点的「入梦」标识）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, enemyScriptFor, entryFlags, locationRuleFor,
} from '../../../../../src/cards/card-rules.js'
import { encounterRules, activeInvestigators, original, here } from '../../encounter-rules.js'
import {
  BEYOND_THE_GATES_TOKEN_MEANINGS, beyondTheGatesOfSleepChaosToken, beyondTheGatesOfSleepChaosAfterTest,
} from './chaos.js'
import { ANCIENT_ZOOG, CAVERN_OF_FLAME, ENCHANTED_PATH, KAMAN_THAH, LABORING_GUG, NASHT, RANDOLPH_CARTER, SET_ASIDE_ENEMY_CODES, SET_ASIDE_LOCATIONS, WOOD_CODES, WOODS, RAW_CODES as RAW } from './definition.js'

const CHAPTER_ID = 'beyondTheGatesOfSleep'
const codeOf = card => original(card)
const traitsOf = card => (ALL_CARDS[codeOf(card)]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())
const locationOf = (state, inv) => (state.locations || []).find(location => location.id === inv?.location) || null
const locationIdOfCode = (state, code) => Object.entries(state.scenario?.locations || {})
  .find(([, definition]) => codeOf(definition) === code)?.[0] || null
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const leadSeat = state => Number(state.campaign?.leadSeat ?? 0)
const isWoodsCode = code => WOOD_CODES.includes(code)

// 梦境标签（UI 提示；梦境正文属 P8-T，不写进本章）。
const DREAM_LABELS = Object.freeze({
  guardian: '守卫者之梦：从牌库找 1 张[守卫者]卡并打出（支付其费用）',
  seeker: '探求者之梦：从牌库找 1 张[探求者]卡并打出（支付其费用）',
  rogue: '流浪者之梦：从牌库找 1 张[流浪者]卡并打出（支付其费用）',
  mystic: '神秘学家之梦：从牌库找 1 张[神秘学家]卡并打出（支付其费用）',
  survivor: '幸存者之梦：从牌库找 1 张[幸存者]卡并打出（支付其费用）',
  criminal: '罪犯之梦：从牌库找 1 张[[罪犯]]或[[非法]]卡并打出（支付其费用）',
  drifter: '漂泊者之梦：可以把牌组里的一张基础弱点换成随机基础弱点；若换则承受 1 点创伤',
  hunter: '猎人之梦：从牌库找 1 张[[武器]]卡并打出（支付其费用）',
  medicOrAssistant: '医生/助手之梦：选择另一位调查员；该调查员开局多得 2 资源与 1 张起始手牌',
  miskatonicOrScholar: '密斯卡托尼克/学者之梦：从牌库找 1 张[[典籍]]卡并打出（支付其费用）',
  veteran: '老兵之梦：从牌库找至多 2 张[[战术]]/[[补给]]卡作为额外起始手牌',
  wayfarer: '旅人之梦：从牌库找 1 张[[旅人]]或[[遗物]]卡并打出（支付其费用）',
  neutral1: '中立之梦 1：开局多 2 资源',
  neutral2: '中立之梦 2：开局多 1 张起始手牌',
})

function dreamMatches(card, dream) {
  if (!card) return false
  const klass = String(card.klass || '').toLowerCase()
  const traits = (card.traits || []).map(trait => String(trait).toLowerCase())
  const effect = dream.effect || {}
  if (dream.klass && klass !== dream.klass) return false
  if (dream.trait && !traits.includes(String(dream.trait).toLowerCase())) return false
  if (dream.traitAny && !dream.traitAny.some(trait => traits.includes(String(trait).toLowerCase()))) return false
  if (effect.trait && !(traits.includes(String(effect.trait).toLowerCase()) || klass === String(effect.trait).toLowerCase())) return false
  if (effect.traitAny && !effect.traitAny.some(trait => traits.includes(String(trait).toLowerCase()))) return false
  return true
}

// 从牌库里找 1 张匹配卡（不入场，先放手上；卡面「打出并支付费用」以「进手牌 + 支付印刷费用」近似）。
function searchDreamCard(state, inv, dream, api) {
  const effect = dream.effect || {}
  const index = (inv.deck || []).findIndex(code => dreamMatches(ALL_CARDS[code], {
    ...dream, effect: { ...effect, trait: effect.trait, traitAny: effect.traitAny },
  }))
  if (index < 0) return null
  const [code] = inv.deck.splice(index, 1)
  const cost = Number(ALL_CARDS[code]?.cost || 0)
  if (cost > 0) api.loseResources?.(inv.seat, cost)
  inv.hand.push(code)
  api.info?.(`🌙 ${inv.name} 的梦境：从牌库找出「${ALL_CARDS[code]?.nameZh || code}」并支付其费用。`)
  return code
}

function applyDream(state, inv, dream, api) {
  const effect = dream.effect || {}
  if (effect.kind === 'searchPlay') {
    searchDreamCard(state, inv, dream, api)
    return
  }
  if (effect.kind === 'startingCards') {
    let taken = 0
    while (taken < (effect.count || 1)) {
      const index = (inv.deck || []).findIndex(code => dreamMatches(ALL_CARDS[code], {
        effect: { traitAny: effect.traitAny },
      }))
      if (index < 0) break
      const [code] = inv.deck.splice(index, 1)
      inv.hand.push(code)
      taken += 1
      api.info?.(`🌙 ${inv.name} 的梦境：把「${ALL_CARDS[code]?.nameZh || code}」加入起始手牌。`)
    }
    return
  }
  if (effect.kind === 'resources') {
    api.gainResources?.(inv.seat, effect.amount || 2)
    api.info?.(`🌙 ${inv.name} 的梦境：开局多 ${effect.amount || 2} 点资源。`)
    return
  }
  if (effect.kind === 'openingHand') {
    api.drawCards?.(inv.seat, effect.amount || 1)
    api.info?.(`🌙 ${inv.name} 的梦境：开局多抽 ${effect.amount || 1} 张卡。`)
    return
  }
  if (effect.kind === 'giftOther') {
    const others = activeInvestigators(state).filter(other => other.seat !== inv.seat)
    if (!others.length) return
    const answer = api.choose?.({
      kind: 'investigator', source: '06039-dream', seat: inv.seat,
      prompt: '选择另一位调查员：该调查员开局多 2 资源与 1 张起始手牌。',
      options: others.map(other => ({ id: String(other.seat), label: other.name })),
    })
    const chosen = others.find(other => String(other.seat) === String(answer)) || others[0]
    api.gainResources?.(chosen.seat, 2)
    api.drawCards?.(chosen.seat, 1)
    api.info?.(`🌙 ${inv.name} 的梦境：${chosen.name} 开局多 2 资源与 1 张牌。`)
    return
  }
  if (effect.kind === 'replaceBasicWeakness') {
    api.info?.('🌙 漂泊者之梦：基础弱点替换在 P8 走 simple 结算（引擎无收藏检索接口，见 scenarioApproximations）。')
  }
}

// 幕 3 背面：把「放在一边」的剧本卡洗成遭遇牌库 + 放 6 张魔幻森林 + 移除台阶地点（卡面逐句）。
function resolveTheFinalDescent(state, api) {
  for (const inv of activeInvestigators(state)) {
    if (Number(inv.clues || 0) > 0) api.spendClues?.(inv.seat, Number(inv.clues))
  }
  // 「你的睡眠更深了：战役余下时间向混乱袋加入 1 个 skull」。
  state.chaosBag = [...(state.chaosBag || []), 'skull']
  if (state.campaign) state.campaign.chaosBag = [...(state.campaign.chaosBag || []), 'skull']
  // 移除所有[[台阶]]地点（Steps 特性；含火焰洞穴）。
  for (const location of [...(state.locations || [])]) {
    if (!traitsOf(location).includes('steps')) continue
    api.removeLocationFromGame?.(location.id)
  }
  // 随机 6 张「魔幻森林」入场，另 1 张移出游戏。
  const zones = (state.scenarioZones ||= {})
  const setAside = Array.isArray(zones.setAside) ? zones.setAside : []
  const woodsInAside = WOOD_CODES.filter(code => setAside.includes(code))
  const shuffled = typeof api.shuffle === 'function' ? api.shuffle([...woodsInAside]) : [...woodsInAside]
  const placed = shuffled.slice(0, 6)
  const removed = shuffled.slice(6)
  for (const code of placed) {
    api.takeFromSetAside?.(code)
    const id = locationIdOfCode(state, code)
    if (id) api.place?.(id)
  }
  for (const code of removed) {
    api.takeFromSetAside?.(code)
    zones.removed ||= []
    zones.removed.push(code)
  }
  // 其余放一边的剧本卡（除辛劳的古革巨人与伦道夫·卡特）洗成遭遇牌库。
  const pile = (Array.isArray(zones.encounterAside) ? zones.encounterAside : [])
    .filter(code => code !== LABORING_GUG && code !== RANDOLPH_CARTER)
  if (pile.length) api.shuffleIntoEncounterDeck?.(pile)
  zones.encounterAside = []
  api.info?.(`🌲 「最后一阶」背面：放入 ${placed.length} 张魔幻森林；遭遇牌库由 ${pile.length} 张卡组成（此后神话阶段正常抽牌）。`)
}

function forbiddenEnemyLocations(state, code) {
  const rule = entryFlags(code)
  if (!rule?.cannotEnterOriginalCodes) return []
  return (state.locations || [])
    .filter(location => rule.cannotEnterOriginalCodes.includes(codeOf(location)))
    .map(location => location.id)
}

// 共享 resolveChaosToken 的数值之外，另把 [tablet] 的「攻击/躲避带蜂拥敌人」补蜂拥卡在 afterTest 结算。
function resolveChaosAfterTest(state, inv, result, api) {
  const consequence = beyondTheGatesOfSleepChaosAfterTest(state, inv, result)
  if (!consequence) return
  const enemy = (state.enemies || []).find(item => String(item.id) === String(consequence.swarmingEnemyId))
  if (!enemy) return
  const placed = api.swarm?.place?.(enemy, consequence.amount, { source: '06039-tablet' }) || []
  if (placed.length) api.info?.(`🪨 [tablet]：给「${enemy.name || codeOf(enemy)}」加 ${placed.length} 张蜂拥卡。`)
}

export const scenarioApproximations = Object.freeze([
  '14 种梦境的选择与效果按 BeyondTheGatesOfSleep.hs:2150-2236 实现；梦境正文属 P8-T（本章只放效果声明，'
    + 'intro 用 dreamSelection 原文）。「从牌库找 X 卡并打出（支付费用）」近似为「进手牌 + 支付印刷费用」（引擎无搜索牌库并打出的原语）。',
  '「漂泊者之梦：把牌组里 1 张基础弱点换成随机基础弱点」：引擎没有收藏检索接口，先记录并提示（P8 简化）。',
  '幕 1–3「神话阶段不要从遭遇牌库抽卡」按「本章开局没有遭遇牌库」自然满足（behavior.modifyDeck 把牌库清空、'
    + '全部卡放到 encounterAside）；引擎仍会执行 mythos 抽牌调用，但牌库为空时无牌可抽。',
  '「火焰洞穴」未揭示面限制（发现七十级台阶全部线索后才能进入）走 locationRule.entryError（引擎直读）。',
  '「辛劳的古革巨人不能进入魔幻小路」走条目 flags + behavior.hunterMove / enemyMoved 拦截（引擎没有敌人入场限制读点）。',
  '「远古祖格鼠生成在任一魔幻森林（优先未揭示）」走条目 flags + behavior.spawnLocation（引擎没有「任意某名地点」生成器）。',
  '「魔幻森林·祖格鼠村落：祖格鼠蜂拥敌人生成后额外加 1 张蜂拥卡」走条目 flags + behavior.enemySpawned。',
  '「魔幻森林·迷失森林：本轮不离开则议程 +1 毁灭」用 scenarioFlags.lostWoodsPending + roundEnded/locationLeft 结算。',
  '故事面 06057b/06058b 不建条目（Lead 口径）：谈判/击败分支用 api.cardFlip 展示正文，故事卡「加入胜利区」'
    + '以 scenarioFlags.trialOf* 记录近似（0 胜利点，不影响经验）。',
])

export const scenarioGaps = Object.freeze([])

// 本章单卡条目的原卡号（审计/覆盖用；剧本参考卡 06039 与背面故事面 06057b/06058b 不建条目）。
export const implementedEncounterCodes = Object.freeze([
  RAW.c06040, RAW.c06041, RAW.c06042, RAW.c06043, RAW.c06044,
  RAW.c06045, RAW.c06046, RAW.c06047, RAW.c06048, RAW.c06049,
  ...WOODS.map(entry => entry.code),
  RAW.c06057, RAW.c06058, RAW.c06059, RAW.c06060, RAW.c06061, RAW.c06062,
])

export const behavior = {
  ...encounterRules,
  id: CHAPTER_ID,
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,

  // ---- 开局：14 种梦境（玩家顺序各选一种；每种只能被选一次） ----
  preScenarioSetup(state, events, api) {
    const flags = (state.scenarioFlags ||= {})
    if (flags.dreamsResolved) return
    flags.dreamsResolved = true
    const used = []
    const dreams = state.scenario?.dreams || []
    const order = [...(state.investigators || [])].sort((left, right) =>
      (((left.seat - leadSeat(state)) % state.investigators.length) + state.investigators.length)
      % state.investigators.length - ((((right.seat - leadSeat(state)) % state.investigators.length)
      + state.investigators.length) % state.investigators.length))
    for (const inv of order) {
      if (inv.defeated || inv.resigned) continue
      const traits = (inv.traits || []).map(trait => String(trait).toLowerCase())
      const available = dreams.filter(dream => {
        if (used.includes(dream.key)) return false
        if (dream.klass && String(inv.klass || '').toLowerCase() !== dream.klass) return false
        if (dream.trait && !traits.includes(dream.trait)) return false
        if (dream.traitAny && !dream.traitAny.some(trait => traits.includes(trait))) return false
        return true
      })
      const pool = available.length ? available : dreams.filter(dream => !used.includes(dream.key))
      if (!pool.length) continue
      const answer = api.choose?.({
        kind: 'story', source: '06039-dreams', seat: inv.seat,
        prompt: `梦境选择（${inv.name}）：选择并朗读一种适用的梦境。`,
        options: pool.map(dream => ({ id: dream.key, label: DREAM_LABELS[dream.key] || dream.key })),
      })
      const dream = pool.find(entry => entry.key === String(answer)) || pool[0]
      used.push(dream.key)
      flags.dreams ||= []
      flags.dreams.push({ seat: inv.seat, key: dream.key })
      try {
        applyDream(state, inv, dream, api)
      } catch (error) {
        api.info?.(`🌙 梦境「${dream.key}」的结算被跳过：${error.message}`)
      }
    }
    api.info?.(`🌙 梦境已选定：${(flags.dreams || []).map(entry => `${state.investigators[entry.seat]?.name || entry.seat}:${entry.key}`).join('，')}。`)
  },

  // ---- 开局：两个台阶地点入场；其余地点/敌人/剧情支援/遭遇卡全部放一边 ----
  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    const flags = (state.scenarioFlags ||= {})
    const setAsideLocationCodes = SET_ASIDE_LOCATIONS
      .map(id => codeOf(state.scenario.locations?.[id]))
      .filter(Boolean)
    zones.setAside = [
      ...setAsideLocationCodes,
      RANDOLPH_CARTER,
      ...SET_ASIDE_ENEMY_CODES,
    ]
    // 本场开局没有遭遇牌库：其余遭遇卡全部放在一边（encounterAside），幕 3 背面再洗成牌库。
    zones.encounterAside = [...(state.scenario?.encounterDeck || [])]
    if (!zones.encounterAside.length) {
      zones.encounterAside = (state.scenario?.enemies ? Object.keys(state.scenario.enemies) : [])
        .filter(code => !SET_ASIDE_ENEMY_CODES.includes(code))
        .flatMap(code => Array(ALL_CARDS[code]?.quantity || 1).fill(code))
      const treacheryCodes = (state.scenario?.treacheries ? Object.keys(state.scenario.treacheries) : [])
      zones.encounterAside.push(...treacheryCodes.flatMap(code => Array(ALL_CARDS[code]?.quantity || 1).fill(code)))
    }
    zones.removed = []
    flags.dreams = flags.dreams || []
    flags.lostWoodsPending = []
    flags.returningGug = false
    helper.info?.('🌌 梦境门外：七十级台阶与火焰洞穴入场；其余地点、守门祭司、古革巨人与遭遇卡放在一边。')
    return ['seventySteps', 'cavernOfFlame']
  },

  setupEnemies() {},

  // ---- 幕的背面 ----
  actReveal(state, act, api) {
    const code = codeOf(act)
    const chapterFlow = act.chapterFlow || actRuleFor(code)?.chapterFlow || null
    if (chapterFlow === 'theFinalDescent') {
      resolveTheFinalDescent(state, api)
      return true
    }
    const rule = actRuleFor(code)
    if (rule?.onReveal) return rule.onReveal(state, act, api)
    return undefined
  },

  agendaReveal(state, agenda, api) {
    const rule = agendaRuleFor(codeOf(agenda), CHAPTER_ID)
    return rule?.onReveal ? rule.onReveal(state, agenda, api) : undefined
  },

  agendaForced(state, when, api, forcedType) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (!agenda) return undefined
    return agendaRuleFor(codeOf(agenda), CHAPTER_ID)?.forced?.[when]?.(state, agenda, api, forcedType)
  },

  // ---- 幕目标（自定义部分；clues/enterLocation 由引擎原生处理） ----
  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const objective = actRuleFor(codeOf(act))?.objective
    if (!objective) return
    if (objective.type === 'noEnemiesInPlay') {
      const codes = objective.originalCodes || []
      const inPlay = (state.enemies || []).some(enemy => codes.includes(codeOf(enemy)))
      if (!inPlay) api.advanceAct?.()
      return
    }
    if (objective.type === 'allInvestigatorsAt') {
      const locationId = locationIdOfCode(state, objective.originalCode)
      if (!locationId) return
      const active = activeInvestigators(state)
      if (active.length && active.every(inv => inv.location === locationId)) api.advanceAct?.()
    }
  },

  // ---- 玩家行动：地点条目行动（[fast] 弃牌、魔幻小路 3 行动等） ----
  actions(state, inv) {
    const moves = encounterRules.actions?.(state, inv) || []
    const location = here(state, inv)
    if (location) locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    return moves
  },

  fastActions(state, inv) {
    const moves = []
    const location = here(state, inv)
    if (location) locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    return moves.filter(move => move.actions === 0 && move.fast === true)
  },

  performAction(state, inv, move, api) {
    const location = here(state, inv)
    if (location && locationRuleFor(codeOf(location))?.performAction?.(state, inv, move, api)) return
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知梦境门外行动：${move.rule}`)
  },

  encounterActions(state, inv) {
    const moves = encounterRules.encounterActions?.(state, inv) || []
    for (const enemy of (state.enemies || []).filter(entry => entry.location === inv.location)) {
      const action = enemyScriptFor(codeOf(enemy))?.encounterAction?.(state, inv, enemy)
      if (action) moves.push(action)
    }
    return moves
  },

  performEncounterAction(state, inv, move, api) {
    if (move.enemyId) {
      const enemy = (state.enemies || []).find(entry => entry.id === move.enemyId && entry.location === inv.location)
      const handler = enemy ? enemyScriptFor(codeOf(enemy))?.performEncounterAction : null
      if (enemy && typeof handler === 'function') return handler(state, inv, enemy, move, api) === true
      return false
    }
    return encounterRules.performEncounterAction?.(state, inv, move, api) === true
  },

  resolveEncounter(state, inv, treachery, api) {
    return encounterRules.resolveEncounter(state, inv, treachery, api)
  },

  // ---- 议程 06040 正面强制：神话阶段放毁灭时，若有调查员在[[台阶]]地点，再放 1 毁灭 ----
  doomPlaced(state, payload, api) {
    if (state.phase !== 'mythos') return
    if (!payload || payload.agenda !== true) return
    const agenda = state.agendas?.[state.agendaIndex]
    if (!agenda) return
    const rule = agendaRuleFor(codeOf(agenda), CHAPTER_ID)
    const extra = rule?.extraDoomOnMythosPlacement
    if (!extra) return
    const atSteps = activeInvestigators(state).some(inv => {
      const location = locationOf(state, inv)
      return location && traitsOf(location).includes('steps')
    })
    if (!atSteps) return
    api.addDoom?.(Number(extra.amount) || 1)
    api.info?.(`🌌 「穿越门扉之旅」：有调查员位于[[台阶]]地点，额外放置 ${Number(extra.amount) || 1} 个毁灭。`)
  },

  // ---- 神话/回合/轮末 ----
  mythosEnded(state, api) {
    encounterRules.mythosEnded?.(state, api)
    for (const location of [...(state.locations || [])]) {
      locationRuleFor(codeOf(location))?.onMythosEnd?.(state, location, api)
    }
  },
  turnBegins(state, inv, api) {
    encounterRules.turnBegins?.(state, inv, api)
    const location = locationOf(state, inv)
    if (location) locationRuleFor(codeOf(location))?.onTurnBegins?.(state, inv, location, api)
  },
  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 魔幻森林·迷失森林：本轮结束前没离开 → 当前议程 +1 毁灭。
    const flags = (state.scenarioFlags ||= {})
    const pending = Array.isArray(flags.lostWoodsPending) ? [...flags.lostWoodsPending] : []
    const remaining = []
    for (const entry of pending) {
      const inv = state.investigators?.[entry.seat]
      const stillThere = inv && !inv.defeated && !inv.resigned
        && inv.location === entry.locationId && Number(entry.round) === Number(state.round)
      if (stillThere) {
        api.addDoom?.(1)
        api.info?.(`🌲 「迷失森林」：${inv.name} 本轮没有离开，当前议程放置 1 个毁灭。`)
      } else if (Number(entry.round) === Number(state.round)) {
        // 本轮的记录，人已离开（locationLeft 正常会清掉；这里兜底）
      } else {
        remaining.push(entry)
      }
    }
    flags.lostWoodsPending = remaining
  },

  // ---- 敌人：入场/生成地点/猎手移动限制 ----
  spawnLocation(state, code, fallbackLoc, engagedSeat, api) {
    if (entryFlags(code)?.spawnAtEnchantedWoods) {
      const woods = (state.locations || []).filter(location => isWoodsCode(codeOf(location)))
      const unrevealed = woods.filter(location => !location.revealed)
      const candidates = unrevealed.length ? unrevealed : woods
      if (candidates.length) {
        const answer = api?.choose?.({
          kind: 'location', source: code, seat: engagedSeat ?? leadSeat(state),
          prompt: '选择一个魔幻森林地点生成（若可能，优先未揭示）。',
          options: candidates.map(location => ({ id: location.id, label: location.name || location.id })),
        })
        const chosen = candidates.find(location => location.id === String(answer)) || candidates[0]
        return chosen.id
      }
    }
    return fallbackLoc
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    // 06051 祖格鼠村落：带蜂拥的[[祖格鼠]]敌人生成本地点后额外加 1 张蜂拥卡。
    const location = (state.locations || []).find(entry => entry.id === enemy.location)
    if (!location || !entryFlags(codeOf(location))?.addSwarmOnZoogSpawn) return
    if (!hasTrait(enemy, 'zoog')) return
    if (!(api.swarm?.countOf?.(enemy) > 0)) return
    if (!(state.encounterDeck || []).length) return
    api.swarm?.place?.(enemy, 1, { source: codeOf(location) })
    api.info?.(`🐀 「祖格鼠村落」：为「${enemy.name || codeOf(enemy)}」额外加 1 张蜂拥卡。`)
  },

  enemyMoved(state, enemy, locationArg, api, previousArg) {
    encounterRules.enemyMoved?.(state, enemy, locationArg, api, previousArg)
    const flags = (state.scenarioFlags ||= {})
    if (flags.returningGug) return
    const forbidden = forbiddenEnemyLocations(state, codeOf(enemy))
    if (!forbidden.length) return
    if (!forbidden.includes(enemy.location)) return
    // 效果移动把敌人送进禁区：移回移动前地点（引擎没有敌人入场限制读点）。
    const current = enemy.location
    const previous = locationArg === current ? (previousArg ?? null) : (locationArg ?? null)
    const target = previous && state.locations.some(location => location.id === previous)
      ? previous : (state.locations || []).find(location => location.id !== current && isWoodsCode(codeOf(location)))?.id
    if (!target) return
    flags.returningGug = true
    api.moveEnemy?.(enemy, target)
    flags.returningGug = false
    api.info?.(`🗿 「${enemy.name || codeOf(enemy)}」不能进入「${api.locName?.(current) || current}」：被移回「${api.locName?.(target) || target}」。`)
  },

  hunterMove(state, enemy, api) {
    const forbidden = forbiddenEnemyLocations(state, codeOf(enemy))
    if (!forbidden.length) return false
    const investigators = activeInvestigators(state).filter(inv => inv.location)
    if (!investigators.length) return false
    const targets = investigators.map(inv => inv.location)
    const defaultStep = api.stepToward?.(enemy.location, targets[0])
    // 引擎默认下一步合法：交给引擎移动。
    if (!defaultStep || !forbidden.includes(defaultStep)) return false
    const current = (state.locations || []).find(location => location.id === enemy.location)
    const candidates = (current?.connections || []).filter(id =>
      state.locations.some(location => location.id === id) && !forbidden.includes(id))
    if (!candidates.length) {
      api.info?.(`🗿 「${enemy.name || codeOf(enemy)}」被「魔幻小路」阻挡：本阶段无法移动。`)
      return true
    }
    const scored = candidates.map(id => ({ id, distance: api.locationDistance?.(id, targets) }))
      .filter(entry => Number.isFinite(entry.distance) && entry.distance >= 0)
    const next = (scored.length ? scored.sort((left, right) => left.distance - right.distance) : [{ id: candidates[0] }])[0]
    api.moveEnemy?.(enemy, next.id)
    return true
  },

  enemyDefeated(state, enemy, api) {
    return encounterRules.enemyDefeated?.(state, enemy, api)
  },
  enemyDamaged(state, enemy, api, seat, source) {
    encounterRules.enemyDamaged?.(state, enemy, api, seat, source)
  },
  enemyPhaseStart(state, api) {
    encounterRules.enemyPhaseStart?.(state, api)
  },
  enemyPhaseEnd(state, api) {
    encounterRules.enemyPhaseEnd?.(state, api)
  },
  enemyStatModifier(state, enemy, stat) {
    return encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
  },

  // ---- 检定后：[tablet] 给蜂拥敌人补蜂拥卡；共享 afterTest 转发 ----
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    resolveChaosAfterTest(state, inv, result, api)
  },

  resolveChaosToken(state, inv, token) {
    return beyondTheGatesOfSleepChaosToken(state, inv, token)
  },

  // ---- 地点：离开时清「迷失森林」记录；调查封锁/线索移除转发地点条目 ----
  locationLeft(state, inv, prevLocation) {
    const flags = (state.scenarioFlags ||= {})
    if (Array.isArray(flags.lostWoodsPending)) {
      flags.lostWoodsPending = flags.lostWoodsPending
        .filter(entry => !(Number(entry.seat) === Number(inv.seat) && entry.locationId === prevLocation.id))
    }
  },
  // 幕 4 正面强制：任意调查员首次进入[[魔幻森林]]后记录「入梦者偏离了道路」（actRule.forcedOnEnter）。
  locationEntered(state, inv, location, api) {
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const forced = actRuleFor(codeOf(act))?.forcedOnEnter
    if (!forced || !forced.record) return
    if (!WOOD_CODES.includes(codeOf(location))) return
    if (state.campaign?.records?.[forced.record]) return
    api.setCampaignRecord?.(forced.record, true)
    api.info?.('🌲 幕 4 正面强制：入梦者偏离了道路（记录到战役日志）。')
  },
  investigationError(state, inv, location) {
    return locationRuleFor(codeOf(location))?.investigationError?.(state, location, inv)
  },
  cluesRemoved(state, location, amount, api) {
    if (!location || (amount || 0) <= 0) return
    locationRuleFor(codeOf(location))?.cluesRemoved?.(state, location, amount, api)
  },

  // 地点揭示后的「未揭示面数据」由 definition 的 normal 地点承载；翻面流程不需要额外钩子。
  locationRevealed() {},

  tokenMeanings: BEYOND_THE_GATES_TOKEN_MEANINGS,

  // ---- 结局与战役记录 ----
  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    const addRandolph = (recordKey) => {
      if (recordKey) records[recordKey] = true
      const candidates = activeInvestigators(state).filter(inv => !inv.defeated)
      if (!candidates.length || typeof api.campaignCardChange !== 'function') return
      const answer = api.choose?.({
        kind: 'story', source: 'beyondTheGatesOfSleep-resolution', seat: leadSeat(state),
        prompt: '是否由一位调查员把「伦道夫·卡特（专家入梦者）」加入牌组？（不计入 30 张牌组上限）',
        options: [
          { id: 'skip', label: '不加入' },
          ...candidates.map(inv => ({ id: String(inv.seat), label: `${inv.name} 加入牌组` })),
        ],
      })
      const chosen = candidates.find(inv => inv.seat === Number(answer))
      if (chosen) api.campaignCardChange(state.campaign, chosen.seat, RANDOLPH_CARTER, 'add', '梦境门外结局')
    }
    if (key === 'noResolution') {
      records.theInvestigatorsWereSavedByRandolphCarder = true
      addRandolph(null)
      return { award: true, bonus: 0 }
    }
    if (key === 'resolution1') {
      records.theCatsCollectedTheirTributeFromTheZoogs = true
      addRandolph(null)
      return { award: true, bonus: 0 }
    }
    if (key === 'resolution2') {
      records.theInvestigatorsParleyedWithTheZoogs = true
      addRandolph(null)
      return { award: true, bonus: 0 }
    }
    return { award: true, bonus: 0 }
  },
}

// 供测试/工具读本章的常量（不参与 behavior 分派）。
export const CHAPTER_CONSTANTS = Object.freeze({
  CHAPTER_ID, KAMAN_THAH, NASHT, LABORING_GUG, ANCIENT_ZOOG, CAVERN_OF_FLAME, ENCHANTED_PATH, WOODS,
})
