// 万千骇形（06168）· 章节引擎钩子（逐卡规则在各单卡条目的 locationRule/actRule/agendaRule/treacheryRule/enemyScript 里；
// behavior 只做流程分派与章节级顺序，不写卡号分支——需要区分时读条目数据/flow id）。
//
// 覆盖约定：`behavior = { ...encounterRules, id, ...章节钩子 }`；覆盖共享钩子时必须转发 encounterRules.<hook>(...)。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, entryFlags, enemySpawnRuleFor, enemyStatRuleFor, locationRuleFor,
} from '../../../../../src/cards/card-rules.js'
import { swarmCountOf } from '../../../../../src/engine/swarm.js'
import { encounterRules, original, activeInvestigators, here, recordsFor } from '../../encounter-rules.js'
import { tshChaosAfterTest, tshChaosToken } from './chaos.js'
import { ATTIC, ENDLESS_DESCENT, MYSTERIOUS_STAIRS, SILVER_KEY, STAIRS_IDS, THE_UNNAMABLE, UNMARKED_TOMB, RAW_CODES as RAW } from './definition.js'

const codeOf = card => original(card)
const UNNAMABLE_CODE = THE_UNNAMABLE
const REMEMBERED_FACTS = ['foundACrackedMirror', 'studiedADesecratedPortrait', 'noticedTheMissingBones']
const SECRETS_IN_THE_ATTIC = RAW.c06194
const LOCKED_DOOR_NAME = 'Locked Door'

const isStairsId = id => STAIRS_IDS.includes(id)
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const locationByCode = (state, code) => Object.values(state.scenario?.locations || {})
  .find(location => String(location.originalCode || location.code) === String(code)) || null
const inPlayByCode = (state, code) => (state.locations || []).find(location => String(codeOf(location)) === String(code)) || null

function takeFromSetAside(state, code) {
  const list = state.scenarioZones?.setAside || []
  const index = list.indexOf(String(code))
  if (index >= 0) list.splice(index, 1)
  return index >= 0
}

function setAsideList(state) {
  return (state.scenarioZones ||= {}).setAside || (state.scenarioZones.setAside = [])
}

const currentActRule = state => actRuleFor(codeOf(state.acts?.[state.actIndex]))
const currentAgendaRule = state => agendaRuleFor(codeOf(state.agendas?.[state.agendaIndex]), state.scenario?.id)
const currentAgenda = state => state.agendas?.[state.agendaIndex] || null
const currentLocationOf = (state, inv) => here(state, inv)

function locationRuleOf(state, inv) {
  const location = currentLocationOf(state, inv)
  return location ? locationRuleFor(codeOf(location)) : null
}

const remembered = state => (state.scenarioFlags?.remembered || [])

// --- 地点锁定（三条阶梯的「不能移动/撤退」共用同一份数据判定） ---
function lockMessageFor(state, inv) {
  const location = currentLocationOf(state, inv)
  if (!location) return undefined
  const rule = locationRuleFor(codeOf(location)) || {}
  if (rule.blockWhileClues && (Number(location.clues) || 0) > 0) return rule.blockWhileClues.message
  if (rule.blockWhileReadyEnemy
    && (state.enemies || []).some(enemy => !enemy.defeated && enemy.location === location.id && !enemy.exhausted)) {
    return rule.blockWhileReadyEnemy.message
  }
  if (rule.blockWhileLocationCounter) {
    const { key, message } = rule.blockWhileLocationCounter
    if ((Number(location[key]) || 0) > 0) return message
  }
  if (rule.blockWhileUnnamableDamageBelow) {
    const spec = rule.blockWhileUnnamableDamageBelow
    const unnamable = (state.enemies || []).find(enemy => String(codeOf(enemy)) === spec.enemyCode && !enemy.defeated)
    const threshold = Math.max(1, Number(state.numInvestigators) || 1) * (spec.perInvestigator || 1)
    if (unnamable && unnamable.location === location.id && (Number(unnamable.damageTaken) || 0) < threshold) return spec.message
  }
  return undefined
}

// --- 阶梯纵向链：只能走到上下相邻层（Endless Descent 重排后仍成立） ---
function stairsMoveError(state, inv, destination) {
  const from = currentLocationOf(state, inv)
  const dest = typeof destination === 'string' ? locationOf(state, destination) : destination
  if (!from || !dest || !isStairsId(from.id) || !isStairsId(dest.id)) return undefined
  const fromLevel = Number.isInteger(from.verticalIndex) ? from.verticalIndex : null
  const toLevel = Number.isInteger(dest.verticalIndex) ? dest.verticalIndex : null
  if (fromLevel == null || toLevel == null) return undefined
  if (Math.abs(fromLevel - toLevel) === 1) return undefined
  return '「神秘阶梯」只与上方和下方的阶梯相连。'
}

// --- 已记住事实的敌人（不可名状之物）数值修正 ---
function rememberedFactBonus(state) {
  return REMEMBERED_FACTS.filter(fact => remembered(state).includes(fact)).length
}

// --- 蜂拥授予（议程 06170/06171：每张鼠群获得蜂拥 1/2） ---
function grantedSwarmingFor(state, enemy) {
  const rule = currentAgendaRule(state)
  const grant = rule?.grantsSwarming
  if (!grant) return 0
  if (String(codeOf(enemy)) !== String(grant.code)) return 0
  return Number(grant.amount) || 0
}

// --- 幕后流程：幕 I 背面「步入深渊」 ---
function resolveIntoTheDepths(state, act, api) {
  const zones = (state.scenarioZones ||= {})
  const flags = (state.scenarioFlags ||= {})
  // 1) 不可名状之物放在一边（保留标记与附属 → 这里保留伤害/毁灭/横置）。
  const unnamable = (state.enemies || []).find(enemy => String(codeOf(enemy)) === UNNAMABLE_CODE)
  if (unnamable) {
    flags.theUnnamableAside = {
      code: UNNAMABLE_CODE,
      damageTaken: Number(unnamable.damageTaken) || 0,
      doom: Number(unnamable.doom) || 0,
      exhausted: Boolean(unnamable.exhausted),
    }
    state.enemies = state.enemies.filter(enemy => enemy !== unnamable)
    setAsideList(state).push(UNNAMABLE_CODE)
    api.info?.('👁️ 「不可名状之物」被放在一边（保留所有标记与附属）。')
  }
  // 2) 移除其它所有地点：已揭示 + 带胜利点 + 无线索 → 进胜利区；否则移出游戏。
  const investigators = [...(state.investigators || [])]
  for (const location of [...(state.locations || [])]) {
    const victory = Number(location.victory) || 0
    const putToVictory = location.revealed === true && victory > 0 && (Number(location.clues) || 0) === 0
    if (putToVictory) {
      state.victoryDisplay ||= []
      if (!state.victoryDisplay.some(card => String(card.id) === String(location.id))) {
        state.victoryDisplay.push({ id: location.id, code: codeOf(location), originalCode: codeOf(location), victory })
      }
      api.info?.(`💎 「${location.name}」进入胜利展示区（已揭示、无线索、胜利 ${victory}）。`)
    } else {
      api.info?.(`🚫 「${location.name}」被移出游戏。`)
    }
    api.removeLocationFromGame?.(location.id)
  }
  // 3) 洗混 6 张放在一边的神秘阶梯，取 5 张纵向排列入场，剩 1 张移出游戏。
  const stairIds = STAIRS_IDS.filter(id => !state.locations.some(location => location.id === id))
  // 从「放在一边」按卡号逐一取走（STAIRS_IDS 与 MYSTERIOUS_STAIRS 同序）。
  STAIRS_IDS.forEach((id, index) => takeFromSetAside(state, MYSTERIOUS_STAIRS[index]))
  const shuffled = api.shuffle?.([...stairIds]) || [...stairIds]
  const placedIds = shuffled.slice(0, 5)
  const removedIds = shuffled.slice(5)
  for (const id of placedIds) api.place?.(id)
  for (const id of removedIds) {
    const code = MYSTERIOUS_STAIRS[STAIRS_IDS.indexOf(id)]
    zones.removed ||= []
    zones.removed.push(code)
    state.removedFromGame ||= []
    state.removedFromGame.push(code)
    api.info?.(`🚫 剩下的 1 张神秘阶梯被移出游戏。`)
  }
  const topId = placedIds[0]
  api.verticalChain?.link(placedIds)
  api.reveal?.(topId)
  // 4) 每位调查员 + 放在一边的不可名状之物放到最上方阶梯，揭示它。
  for (const inv of investigators) {
    if (inv.defeated || inv.resigned) continue
    api.moveInvestigator?.(inv.seat, topId)
  }
  if (flags.theUnnamableAside) {
    const aside = flags.theUnnamableAside
    delete flags.theUnnamableAside
    takeFromSetAside(state, UNNAMABLE_CODE)
    const enemy = api.spawn?.(UNNAMABLE_CODE, topId)
    if (enemy) {
      if (aside.damageTaken) enemy.damageTaken = aside.damageTaken
      if (aside.doom) enemy.doom = aside.doom
      if (aside.exhausted) enemy.exhausted = true
    }
    api.info?.('👁️ 「不可名状之物」被放到最上方的神秘阶梯并揭示该地点。')
  }
  // 5) 从遭遇牌库/弃牌堆移除两张上锁的门与两张阁楼的秘密。
  const removedCodes = []
  for (const code of [SECRETS_IN_THE_ATTIC, ...lockedDoorCodes()]) {
    for (let copy = 0; copy < 2; copy += 1) {
      if (api.discardEncounterCard?.(code)) { api.takeEncounterDiscard?.(code); removedCodes.push(code) }
      else if (api.takeEncounterDiscard?.(code)) removedCodes.push(code)
    }
  }
  for (const code of removedCodes) (state.removedFromGame ||= []).push(code)
  api.info?.(`🚫 从遭遇牌库/弃牌堆移出 ${removedCodes.length} 张「上锁的门」/「阁楼的秘密」。`)
  // 6) 放在一边的 4 张「无尽深入」与遭遇弃牌堆一起洗入遭遇牌库。
  const descents = []
  for (let copy = 0; copy < 4; copy += 1) if (takeFromSetAside(state, ENDLESS_DESCENT)) descents.push(ENDLESS_DESCENT)
  if (descents.length) api.shuffleIntoEncounterDeck?.(descents)
  api.shuffleDiscard?.()
  api.info?.('🔄 放在一边的「无尽深入」与遭遇弃牌堆一起洗入遭遇牌库。')
  return true
}

const lockedDoorCodes = () => Object.values(ALL_CARDS)
  .filter(card => card.type === 'treachery' && String(card.name) === LOCKED_DOOR_NAME)
  .map(card => card.code)

// --- 幕后流程：无尽深入（06190）的纵向链重排 ---
function resolveEndlessDescent(state, inv, card, api) {
  const stairs = (state.locations || []).filter(location => isStairsId(location.id))
    .sort((left, right) => (Number(left.verticalIndex) || 0) - (Number(right.verticalIndex) || 0))
  if (stairs.length < 2) {
    api.info?.('「无尽深入」：场上的神秘阶梯不足，效果结束。')
    return false
  }
  const [top, ...rest] = stairs
  const below = rest[0]
  for (const other of [...(state.investigators || [])].filter(item => item.location === top.id && !item.defeated && !item.resigned)) {
    api.moveInvestigator?.(other.seat, below.id)
  }
  for (const enemy of [...(state.enemies || [])].filter(item => item.location === top.id)) api.moveEnemy?.(enemy, below.id)
  // 翻至未揭示面：清空线索/毁灭/附属。
  const clues = Number(top.clues) || 0
  if (clues) api.removeLocationClues?.(top.id, clues)
  if (Number(top.doom) || 0) api.locationDoom?.remove?.(top, Number(top.doom) || 0)
  for (const attachment of [...(top.attachments || [])]) api.detachLocationAttachment?.(top.id, attachment.id)
  top.revealed = false
  const definition = state.scenario?.locations?.[top.id]
  const unrevealedFace = definition?.unrevealed
  if (unrevealedFace?.nameZh) top.name = unrevealedFace.nameZh
  // 重新排列：顶部地点移到最下方，其余保持不变；洗乱未揭示地点的位置。
  const order = [...rest.map(location => location.id), top.id]
  const revealed = new Set(order.filter(id => locationOf(state, id)?.revealed === true))
  const unrevealedSlots = order.map((id, index) => ({ id, index })).filter(item => !revealed.has(item.id))
  const shuffledIds = api.shuffle?.(unrevealedSlots.map(item => item.id)) || unrevealedSlots.map(item => item.id)
  const finalOrder = [...order]
  unrevealedSlots.forEach((slot, index) => { finalOrder[slot.index] = shuffledIds[index] })
  api.verticalChain?.link(finalOrder)
  // 本卡加入胜利区（卡片不再进遭遇弃牌堆）。
  state.victoryDisplay ||= []
  state.victoryDisplay.push({ id: card?.id || 'treachery-06190', code: ENDLESS_DESCENT })
  api.info?.('🪜 「无尽深入」：最上方地点被翻回未揭示面并移到底部，未揭示阶梯的位置被打乱；本卡加入胜利区。')
  return true
}

// --- 选项/目标 ---
function resolveActObjectives(state, api) {
  const act = state.acts?.[state.actIndex]
  if (!act) return
  const rule = actRuleFor(codeOf(act)) || {}
  const objective = rule.objective
  if (!objective) return
  if (objective.kind === 'allResigned') {
    const alive = (state.investigators || []).filter(inv => !inv.defeated)
    if (alive.length && alive.every(inv => inv.resigned)) api.advanceAct?.()
  }
}

function bottomStairs(state) {
  const stairs = (state.locations || []).filter(location => isStairsId(location.id) && location.verticalIndex != null)
  if (!stairs.length) return null
  return stairs.reduce((best, location) => (Number(location.verticalIndex) > Number(best.verticalIndex) ? location : best), stairs[0])
}

export const scenarioApproximations = Object.freeze([
  '神秘阶梯的「洗混位置使无法辨认」用 verticalIndex/connections 重排表达（地点卡号不变，不重建地点实体）；'
    + 'Endless Descent 的重排流程在 behavior.resolveEndlessDescent。',
  '议程 06171 的「不可名状之物失去冷漠/获得庞大」用章节内容层直接落实例字段（引擎无 mass 字段的 api），'
    + '在每回合开始与议程揭示后幂等执行。',
  '06224 银钥匙的「取消 1 点恐惧」走 harmDealt 窗口；「在你将要受到恐惧时」与参考实现的取消时机等价。',
  '06194 阁楼的秘密「放在密谋牌库旁」用 scenarioFlags.agendaAside 纯数据表达（TDE 共享层无 agendaAside 区）。',
])

export const scenarioGaps = Object.freeze([
  '06193 的「另一张卡进入你的威胁区域后弃 1 张手牌」没有引擎读点（记 simplified）。',
  '06168 剧本参考卡的混乱符号「再揭示一个标记」（cultist）没有剧本级额外揭示原语（chaos.js 记 simplified）。',
])

export const implementedEncounterCodes = Object.freeze([
  THE_UNNAMABLE, RAW.c06190, RAW.c06191, RAW.c06192, RAW.c06193, RAW.c06194,
])

export const behavior = {
  ...encounterRules,
  id: 'aThousandShapesOfHorror',
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,

  // ---- 开局 ----
  preScenarioSetup(state, events, api) {
    const flags = (state.scenarioFlags ||= {})
    flags.remembered ||= []
    flags.introResolved = true
    if (api.campaignRecord?.('theBlackCatIsAtYourSide')) {
      api.info?.('🐈 黑猫在你身边：按 Intro 2 的剧情处理（P8-T 前只记录状态）。')
    } else {
      api.info?.('🐈 黑猫不在你身边：按 Intro 3 的剧情处理（P8-T 前只记录状态）。')
    }
  },

  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    const flags = (state.scenarioFlags ||= {})
    flags.remembered ||= []
    const placed = ['burialGround', 'frontPorchEntryway', 'upstairsHallway', 'den', 'parlor', 'library', 'bedroom']
    zones.setAside = [
      THE_UNNAMABLE,
      ATTIC, UNMARKED_TOMB,
      ...MYSTERIOUS_STAIRS,
      ENDLESS_DESCENT, ENDLESS_DESCENT, ENDLESS_DESCENT, ENDLESS_DESCENT,
      SILVER_KEY,
    ]
    flags.pendingSetupReveals = ['burialGround'] // 调查员从已揭示的坟地开始
    helper.info?.('🏚️ 万千骇形：坟地、前廊（入口背面）、楼上的走廊与上下楼门道入场；其余地点放在一边。')
    return placed
  },

  setupEnemies() {
    // 不可名状之物在议程 I 背面按生成指示生成（见 06169a.js）。
  },

  // ---- 幕 / 议程 ----
  actReveal(state, act, api) {
    const rule = actRuleFor(codeOf(act)) || {}
    if (rule.chapterFlow) {
      if (rule.chapterFlow === 'intoTheDepths') return resolveIntoTheDepths(state, act, api)
      return undefined
    }
    if (rule.onReveal) return rule.onReveal(state, act, api)
    return undefined
  },

  agendaReveal(state, agenda, api) {
    const rule = agendaRuleFor(codeOf(agenda), state.scenario?.id) || {}
    if (rule.onReveal) return rule.onReveal(state, agenda, api)
    return undefined
  },

  agendaForced(state, when, api, forcedType) {
    const agenda = currentAgenda(state)
    if (!agenda) return undefined
    return agendaRuleFor(codeOf(agenda), state.scenario?.id)?.forced?.[when]?.(state, agenda, api, forcedType)
  },

  checkObjectives(state, api) {
    resolveActObjectives(state, api)
  },

  // ---- 回合 / 轮末 ----
  turnBegins(state, inv, api) {
    encounterRules.turnBegins?.(state, inv, api)
    const agenda = currentAgenda(state)
    const rule = agendaRuleFor(codeOf(agenda), state.scenario?.id)
    // 议程 06171：不可名状之物失去冷漠并获得庞大（幂等）。
    const modifiers = rule?.enemyModifiersOnReveal
    if (modifiers) {
      const enemy = (state.enemies || []).find(candidate => String(codeOf(candidate)) === modifiers.code && !candidate.defeated)
      if (enemy) {
        if ((modifiers.addKeywords || []).includes('massive')) enemy.massive = true
        if ((modifiers.removeKeywords || []).includes('aloof')) api.clearEnemyAloof?.(enemy)
      }
    }
    rule?.forced?.turnBegins?.(state, agenda, api)
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    for (const location of [...(state.locations || [])]) {
      locationRuleFor(codeOf(location))?.forced?.roundEnd?.(state, location, api)
    }
    // 06194 阁楼的秘密：轮末从场上弃掉 1 张（每轮最多一次）。
    const aside = state.scenarioFlags?.agendaAside
    if (Array.isArray(aside) && aside.includes(SECRETS_IN_THE_ATTIC)) {
      const index = aside.indexOf(SECRETS_IN_THE_ATTIC)
      aside.splice(index, 1)
      state.encounterDiscard.push(SECRETS_IN_THE_ATTIC)
      api.info?.('🕯️ 轮末：从场上弃掉 1 张「阁楼的秘密」（每轮最多一次）。')
    }
  },

  // ---- 玩家行动 ----
  actions(state, inv) {
    const moves = encounterRules.actions?.(state, inv) || []
    // 幕 II 目标：最下方的神秘阶梯被揭示时获得「[action]：撤退」。
    if (currentActRule(state)?.grantsResignAtBottomStairs) {
      const bottom = bottomStairs(state)
      if (bottom && bottom.revealed === true && inv.location === bottom.id) {
        moves.push({
          action: 'scenarioAction', rule: 'tshResignAtBottomStairs', actions: 1,
          label: `🏳️ 神秘阶梯：撤退（到达阶梯底部）`,
        })
      }
    }
    const location = here(state, inv)
    if (location) locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    return moves
  },

  fastActions(state, inv) {
    // 06194 阁楼的秘密在场时，地点上的 [fast] 能力不能触发。
    const aside = state.scenarioFlags?.agendaAside
    if (Array.isArray(aside) && aside.includes(SECRETS_IN_THE_ATTIC)) return []
    const moves = []
    const location = here(state, inv)
    if (location) locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    return moves.filter(move => move.actions === 0 && move.fast === true)
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'tshResignAtBottomStairs') {
      const bottom = bottomStairs(state)
      if (!bottom || inv.location !== bottom.id || bottom.revealed !== true) return undefined
      const rule = locationRuleFor(codeOf(bottom))
      if (rule?.beforeResign && rule.beforeResign(state, inv, api) === false) {
        api.info?.('付不起本地点移动/撤退的额外费用，撤退取消。')
        return undefined
      }
      api.resign?.(inv.seat)
      api.info?.(`🏳️ ${inv.name} 在最下方的神秘阶梯撤退。`)
      return undefined
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return undefined
    const location = here(state, inv)
    const rule = location ? locationRuleFor(codeOf(location)) : null
    if (rule?.performAction?.(state, inv, move, api)) return undefined
    throw new Error(`未知万千骇形行动：${move.rule}`)
  },

  actionBlocked(state, inv, move) {
    if (move?.action !== 'resign') return undefined
    const lock = lockMessageFor(state, inv)
    if (lock && locationRuleFor(codeOf(currentLocationOf(state, inv)))?.blockWhileClues?.resign !== false) {
      const rule = locationRuleFor(codeOf(currentLocationOf(state, inv))) || {}
      const blocks = rule.blockWhileClues?.resign || rule.blockWhileReadyEnemy?.resign
        || rule.blockWhileLocationCounter?.resign || rule.blockWhileUnnamableDamageBelow?.resign
      if (blocks) return lock
    }
    return undefined
  },

  // ---- 地点 ----
  locationRevealed(state, location, api) {
    // 双面地点揭示后恢复正面印刷名/副名/特性（未揭示面来自 definition 的 unrevealed 数据）。
    const card = ALL_CARDS[codeOf(location)]
    if (!card) return
    location.name = card.nameZh || card.name || location.name
    location.subname = card.subnameZh || card.subname || ''
    if (card.traits) location.traits = [...card.traits]
    api.info?.(`🚪 「${location.name}」揭示。`)
  },

  investigationError(state, inv, location) {
    if (!location) return undefined
    const rule = locationRuleFor(codeOf(location)) || {}
    if (rule.entryErrorWhenUnrevealed && location.revealed !== true) return rule.entryErrorWhenUnrevealed
    return undefined
  },

  investigatorEntryError(state, location, inv) {
    if (!location) return undefined
    if (location.revealed !== true) {
      const rule = locationRuleFor(codeOf(location)) || {}
      if (rule.entryErrorWhenUnrevealed) return rule.entryErrorWhenUnrevealed
    }
    return undefined
  },

  beforeInvestigate(state, inv, location, api) {
    if (!location) return undefined
    return locationRuleFor(codeOf(location))?.beforeInvestigate?.(state, inv, location, api)
  },

  afterInvestigate(state, inv, location, result, api) {
    if (!location) return
    locationRuleFor(codeOf(location))?.afterInvestigate?.(state, inv, location, result, api)
  },

  locationShroudModifier(state, location, inv) {
    if (!location) return 0
    return Number(locationRuleFor(codeOf(location))?.shroudModifier?.(state, location, inv) || 0)
  },

  moveError(state, inv, destination) {
    const lock = lockMessageFor(state, inv)
    if (lock) return lock
    const destinationLocation = typeof destination === 'string' ? locationOf(state, destination) : destination
    const stairs = stairsMoveError(state, inv, destinationLocation)
    if (stairs) return stairs
    const rule = locationRuleOf(state, inv)
    return rule?.moveError?.(state, inv, destination)
  },

  beforeMove(state, inv, destination, api) {
    const rule = locationRuleOf(state, inv)
    rule?.beforeMove?.(state, inv, destination, api)
  },

  // ---- 敌人 ----
  spawnLocation(state, code, fallbackLoc) {
    const rule = enemySpawnRuleFor(code)
    if (!rule?.spawnChoices) return fallbackLoc
    const candidates = (state.locations || []).filter(location => rule.spawnChoices.includes(String(codeOf(location))))
    if (!candidates.length) return fallbackLoc
    return candidates.length === 1 ? candidates[0].id : candidates[0].id
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    // 议程授予的蜂拥（06170/06171：每张鼠群获得蜂拥 1/2）。
    const amount = grantedSwarmingFor(state, enemy)
    if (amount > 0 && swarmCountOf(enemy) === 0) {
      const placed = api.swarm?.place?.(enemy, amount, { source: 'agendaGrantsSwarming' }) || []
      if (placed.length) api.info?.(`🐀 鼠群获得蜂拥 ${amount}：放置 ${placed.length} 张蜂拥卡。`)
    }
  },

  enemyStatModifier(state, enemy, stat) {
    let value = Number(encounterRules.enemyStatModifier?.(state, enemy, stat) || 0)
    const rule = enemyStatRuleFor(codeOf(enemy))
    const rememberedRule = rule?.rememberedFacts
    if ((stat === 'fight' || stat === 'evade') && rememberedRule) {
      const count = rememberedFactBonus(state)
      value += (Number(rememberedRule.amount) || -1) * Math.min(count, Number(rememberedRule.cap) || 3)
    }
    return value
  },

  // ---- 遭遇 ----
  resolveEncounter(state, inv, treachery, api) {
    const flow = entryFlags(codeOf(treachery))?.flow
    if (flow === 'endlessDescent') return resolveEndlessDescent(state, inv, treachery, api)
    return encounterRules.resolveEncounter?.(state, inv, treachery, api) ?? false
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token) {
    return tshChaosToken(state, inv, token)
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    tshChaosAfterTest(state, inv, result, api)
  },

  // ---- 结局 ----
  resolution(state, key, events, api) {
    const records = recordsFor(state)
    const resolveKey = input => {
      if (RESOLUTIONS.has(input)) return input
      throw new Error(`未知万千骇形结局：${input}`)
    }
    const finalKey = resolveKey(key === 'noResolution' ? 'resolution2' : key)
    if (finalKey === 'resolution2') {
      const rememberedKey = remembered(state).includes('recoveredAStrangeKey')
      return this.resolution(state, rememberedKey ? 'resolution3' : 'resolution4', events, api)
    }
    if (finalKey === 'resolution1') {
      records.randolphSurvivedTheDescent = true
      records.theInvestigatorsPossessTheSilverKey = true
      return { award: true, effects: [
        { record: { randolphSurvivedTheDescent: true, theInvestigatorsPossessTheSilverKey: true } },
        { chaos: { token: 'skull', amount: 1 } },
      ] }
    }
    if (finalKey === 'resolution3') {
      records.randolphSurvivedTheDescent = true
      return { award: true, effects: [
        { record: { randolphSurvivedTheDescent: true } },
        { chaos: { token: 'skull', amount: 1 } },
      ] }
    }
    records.randolphDidNotSurviveTheDescent = true
    return { award: true, effects: [{ record: { randolphDidNotSurviveTheDescent: true } }] }
  },
}

const RESOLUTIONS = new Set(['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
