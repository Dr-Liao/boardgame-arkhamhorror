// 存档向下兼容与修复。
//
// 读取旧存档时按以下顺序处理，任一步失败都明确拒绝，不在新规则下静默续算：
//   1. 结构／规则迁移：按 STATE_MIGRATIONS 逐级把 schemaVersion + rulesVersion 升到当前版本；
//      没有登记迁移路径的旧版本直接拒绝。
//   2. 资源升级：卡牌数据重新生成后，核对存档引用的卡号仍然存在，再刷新内嵌卡牌定义与 resourceVersion。
//   3. 修复：补齐后续版本新增、旧存档缺失的空字段，重算合法行动列表。
//   4. 冒烟校验：当前全部合法行动都能通过校验，并抽样在副本上执行，确认迁移后的存档可以续玩。
//
// 迁移是纯函数：不修改传入的状态，需要变更时在副本上进行。

import { META } from '../cards/cards-data.js'
import {
  LEGACY_AGENDA_DOOM_PER_INVESTIGATOR, LEGACY_STRAITJACKET_CODE, LEGACY_FIGHT_OR_FLIGHT_CODE,
} from '../cards/card-rules.js'
import { STATE_SCHEMA_VERSION, RULES_VERSION, stateCompatibilityError } from './rules-state.js'
import { createGameState, refreshStateResources, unknownCardCodes, legalMoves, validateMove, applyMove, decisionSeat } from './engine.js'

function fixEchoesAgendaThresholds(state) {
  for (const agendas of [state.agendas, state.scenario?.agendas]) {
    for (const agenda of agendas || []) {
      const perInvestigator = LEGACY_AGENDA_DOOM_PER_INVESTIGATOR[agenda.originalCode || agenda.code]
      if (perInvestigator == null) continue
      agenda.doomThresholdPerInvestigator = perInvestigator
      agenda.doomThreshold = perInvestigator * state.numInvestigators
    }
  }
}

function fixCourageCardIdentity(state) {
  for (const inv of state.investigators || []) {
    for (const asset of inv.assets || []) {
      if (asset.code !== 'xcourage' || !asset.originalCode) continue
      asset.underlyingCode = asset.originalCode
      delete asset.originalCode
    }
  }
}

function fixStraitjacketZoneAndAbility(state) {
  state.encounterDiscard ||= []
  for (const inv of state.investigators || []) {
    inv.assets ||= []
    inv.threat ||= []
    const legacy = inv.assets.filter(asset => asset.code === LEGACY_STRAITJACKET_CODE)
    inv.assets = inv.assets.filter(asset => asset.code !== LEGACY_STRAITJACKET_CODE)
    const jackets = [...inv.threat.filter(card => card.code === LEGACY_STRAITJACKET_CODE), ...legacy]
    if (!jackets.length) continue
    inv.threat = inv.threat.filter(card => card.code !== LEGACY_STRAITJACKET_CODE)
    const jacket = jackets[0]
    Object.assign(jacket, {
      slots: ['Body', 'Hand x2'],
      cannotLeavePlay: true,
      threatEffect: {
        discardCost: { action: 2 },
        sameLocationAction: true,
      },
    })
    inv.threat.push(jacket)
    for (const duplicate of jackets.slice(1)) state.encounterDiscard.push(duplicate.code)
  }
}

// 结构 v7（Phase 1 · A1）：持续效果实体落进 state.effects[]。
// 旧存档里「本阶段/本轮 +X」是写在调查员身上的裸字段（phaseStatBonus(s) / fightOrFlight），
// 这里把它们折算成等价的持久效果记录，避免读档后修正直接消失。
function addEffectEntities(state) {
  state.effects ||= []
  for (const inv of state.investigators || []) {
    if (inv.phaseStatBonus?.skill) {
      state.effects.push({
        id: 'migrated-phase-' + inv.seat,
        sourceCode: null,
        sourceInstanceId: null,
        controllerSeat: inv.seat,
        duration: 'endOfPhase',
        label: `旧存档：本阶段${inv.phaseStatBonus.skill} +${inv.phaseStatBonus.amount || 0}`,
        modifiers: [{ target: `skill:${inv.phaseStatBonus.skill}`, amount: inv.phaseStatBonus.amount || 0 }],
        abilities: [],
        createdAt: { round: state.round ?? 0, phase: state.phase ?? null, turnSerial: state.turnSerial ?? 0 },
      })
      inv.phaseStatBonus = null
    }
    for (const bonus of inv.phaseStatBonuses || []) {
      if (!bonus?.skill) continue
      state.effects.push({
        id: `migrated-phase-${inv.seat}-${state.effects.length}`,
        sourceCode: null,
        sourceInstanceId: null,
        controllerSeat: inv.seat,
        duration: 'endOfPhase',
        label: `旧存档：本阶段${bonus.skill} +${bonus.amount || 0}`,
        modifiers: [{ target: `skill:${bonus.skill}`, amount: bonus.amount || 0 }],
        abilities: [],
        createdAt: { round: state.round ?? 0, phase: state.phase ?? null, turnSerial: state.turnSerial ?? 0 },
      })
    }
    if (inv.phaseStatBonuses) inv.phaseStatBonuses = []
    if (inv.fightOrFlight?.round === state.round && inv.fightOrFlight?.amount != null) {
      state.effects.push({
        id: `migrated-fightOrFlight-${inv.seat}`,
        sourceCode: LEGACY_FIGHT_OR_FLIGHT_CODE,
        sourceInstanceId: null,
        controllerSeat: inv.seat,
        duration: 'endOfRound',
        label: '旧存档：战斗或逃跑',
        modifiers: [
          { target: 'skill:combat', amount: inv.fightOrFlight.amount || 0 },
          { target: 'skill:agility', amount: inv.fightOrFlight.amount || 0 },
        ],
        abilities: [],
        createdAt: { round: state.round ?? 0, phase: state.phase ?? null, turnSerial: state.turnSerial ?? 0 },
      })
    }
    delete inv.fightOrFlight
  }
}

// 每次提升 STATE_SCHEMA_VERSION 或 RULES_VERSION 时，在这里登记从上一版本到新版本的一步迁移。
// up(state) 原地改写状态副本；不能安全迁移时抛出错误说明原因。
// 示例：{ from: [6, 'n5.1'], to: [7, 'n5.2'], note: '为调查员补充 xxx 字段', up(state) { ... } }
export const STATE_MIGRATIONS = Object.freeze([
  {
    from: [6, 'n5.1'],
    to: [6, 'n5.2'],
    note: '规则更新（存档结构不变）',
    up() {},
  },
  {
    from: [6, 'n5.2'],
    to: [6, 'n5.3'],
    note: '按调查员人数修正“往事回声”密谋毁灭阈值',
    up: fixEchoesAgendaThresholds,
  },
  {
    from: [6, 'n5.3'],
    to: [6, 'n5.4'],
    note: '修正“胆量”的卡牌身份与底牌记录',
    up: fixCourageCardIdentity,
  },
  {
    from: [6, 'n5.4'],
    to: [6, 'n5.5'],
    note: '将旧存档中的“约束衣”迁入威胁区并恢复双行动弃置能力',
    up: fixStraitjacketZoneAndAbility,
  },
  {
    from: [6, 'n5.5'],
    to: [7, 'n6.0'],
    note: 'Phase 1：持续效果实体化（state.effects[]），旧临时修正折算为效果记录',
    up: addEffectEntities,
  },
])

const SMOKE_APPLY_LIMIT = 6
const MAX_STEPS = 64

const isEmptyDefault = value => value === null || value === false || value === 0 || value === ''
  || (Array.isArray(value) && value.length === 0)
  || (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)

function versionLabel(schemaVersion, rulesVersion) {
  return `结构 v${schemaVersion ?? '?'} / 规则 ${rulesVersion ?? '?'}`
}

function migrateVersions(state, migrations, changes) {
  for (let steps = 0; state.schemaVersion !== STATE_SCHEMA_VERSION || state.rulesVersion !== RULES_VERSION; steps++) {
    if (steps >= MAX_STEPS) throw new Error('存档迁移步骤过多，可能存在循环')
    const step = migrations.find(item => item.from[0] === state.schemaVersion && item.from[1] === state.rulesVersion)
    if (!step) {
      throw new Error(`存档版本（${versionLabel(state.schemaVersion, state.rulesVersion)}）暂无迁移路径，当前为 ${versionLabel(STATE_SCHEMA_VERSION, RULES_VERSION)}，请重新开局`)
    }
    step.up(state)
    const before = versionLabel(state.schemaVersion, state.rulesVersion)
    ;[state.schemaVersion, state.rulesVersion] = step.to
    changes.push(`${before} → ${versionLabel(state.schemaVersion, state.rulesVersion)}${step.note ? '：' + step.note : ''}`)
  }
}

function upgradeResources(state, changes, force) {
  const outdated = state.resourceVersion !== META.resourceVersion
  if (!outdated && !force) return
  const missing = unknownCardCodes(state)
  if (missing.length) {
    const shown = missing.slice(0, 8).join('、') + (missing.length > 8 ? ` 等 ${missing.length} 张` : '')
    throw new Error(`存档引用的卡牌在当前资源中已不存在（${shown}），无法升级`)
  }
  const before = JSON.stringify([state.cards, state.investigatorDefs])
  refreshStateResources(state)
  if (outdated) changes.push('卡牌资源升级到当前版本')
  else if (JSON.stringify([state.cards, state.investigatorDefs]) !== before) changes.push('刷新内嵌卡牌定义')
}

// 三态自动反应给卡面加了 hasAutoReaction / autoByDefault。旧存档的资源版本可能没变，
// 但内嵌卡牌仍是旧定义；检测到缺字段就强制刷新一次，避免读档后按钮/默认值缺失。
function needsAutoReactionFlags(state) {
  const cards = state.cards
  if (!cards || typeof cards !== 'object') return false
  return Object.values(cards).some(def => def && typeof def === 'object'
    && (def.type === 'investigator' || def.hasReactionPrompt
      || (Array.isArray(def.reactionIds) && def.reactionIds.length))
    && !Object.hasOwn(def, 'autoByDefault'))
}

// 以同一战役新开局的状态为模板，只补齐缺失且模板值为空的字段（[]、{}、null、0、false）。
function fillMissingFields(state, changes) {
  const players = (state.investigators || []).map(inv => ({ seat: inv.seat, role: state.humanSeats?.includes(inv.seat) ? 'human' : 'ai' }))
  if (!players.length) throw new Error('存档缺少调查员，无法修复')
  const template = createGameState({ campaignId: state.campaign.id, campaignHub: !!state.hubFlow, seed: 'save-repair-template' }, players)
  const filled = []
  for (const [target, source, prefix] of [[state, template, ''], [state.campaign, template.campaign, 'campaign.']]) {
    for (const [key, value] of Object.entries(source)) {
      if (Object.hasOwn(target, key) || !isEmptyDefault(value)) continue
      target[key] = structuredClone(value)
      filled.push(prefix + key)
    }
  }
  if (filled.length) changes.push('补齐缺失字段：' + filled.join('、'))
}

function moveKey(move) {
  return move.action === 'choose' ? 'choose:' + move.optionId : move.action
}

// 迁移后的存档必须能续玩：当前合法行动全部可通过校验，抽样在副本上执行不报错。
function smokeCheck(state) {
  const compatibility = stateCompatibilityError(state, META.resourceVersion)
  if (compatibility) throw new Error(compatibility)
  if (state.status !== 'playing') return
  const seat = decisionSeat(state)
  const moves = legalMoves(state)
  const tried = new Set()
  for (const move of moves) {
    const key = moveKey(move)
    if (tried.size >= SMOKE_APPLY_LIMIT || tried.has(key)) continue
    tried.add(key)
    const error = validateMove(state, seat, move)
    if (error) throw new Error(`迁移后合法行动校验失败（${move.label || move.action}）：${error}`)
    const after = structuredClone(state)
    try { applyMove(after, seat, move) } catch (err) {
      throw new Error(`迁移后无法继续行动（${move.label || move.action}）：${err?.message || err}`)
    }
    const afterError = stateCompatibilityError(after, META.resourceVersion)
    if (afterError) throw new Error(`迁移后执行「${move.label || move.action}」版本回退：${afterError}`)
  }
}

/**
 * 把存档状态迁移到当前版本。
 * @param {object} state 读取到的存档状态（不会被修改）
 * @param {{ force?: boolean, migrations?: Array }} options force：版本一致时也执行资源刷新与修复检查
 * @returns {{ state: object, changes: string[] }} 无需迁移时返回原对象与空列表
 * @throws {Error} 无法安全迁移时抛出，message 可直接展示给玩家
 */
function parallelLaneEntries(state) {
  const lanes = state?.parallel?.lanes
  if (!lanes?.A || !lanes?.B) return []
  return [['A', lanes.A], ['B', lanes.B]]
}

function runtimeNeedsWork(runtime, force) {
  return !!force || needsAutoReactionFlags(runtime) || !!stateCompatibilityError(runtime, META.resourceVersion)
}

// 一条可续玩的运行时（单线对局，或并行里的一条线）。容器本身在并行时只是外壳。
function migrateRuntime(runtime, { force, migrations, changes, label, playable }) {
  if (typeof runtime.schemaVersion !== 'number') throw new Error(`${label}缺少结构版本，无法识别，请重新开局`)
  if (runtime.schemaVersion > STATE_SCHEMA_VERSION) throw new Error(`${label}来自更新版本（结构 v${runtime.schemaVersion}），请升级游戏后再读取`)
  if (!runtime.campaign?.id) throw new Error(`${label}缺少战役信息，无法修复`)
  const local = []
  migrateVersions(runtime, migrations, local)
  upgradeResources(runtime, local, force || needsAutoReactionFlags(runtime))
  fillMissingFields(runtime, local)
  if (playable) {
    const moves = legalMoves(runtime)
    if (JSON.stringify(moves) !== JSON.stringify(runtime.legalMoves)) {
      runtime.legalMoves = moves
      local.push('重算合法行动')
    }
    smokeCheck(runtime)
  }
  for (const change of local) changes.push(label === '存档' ? change : `${label}：${change}`)
}

export function migrateState(state, { force = false, migrations = STATE_MIGRATIONS } = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('存档缺少合法的对局状态')
  const lanes = parallelLaneEntries(state)
  const laneNeedsWork = lanes.some(([, lane]) => runtimeNeedsWork(lane, false))
  if (!runtimeNeedsWork(state, force) && !laneNeedsWork) return { state, changes: [] }
  const next = structuredClone(state)
  const changes = []
  const nextLanes = parallelLaneEntries(next)
  // 并行容器没有自己的关卡循环；冒烟只跑两条线，避免把外壳当成一局可下的牌。
  migrateRuntime(next, { force, migrations, changes, label: '存档', playable: nextLanes.length === 0 })
  for (const [part, lane] of parallelLaneEntries(next)) {
    migrateRuntime(lane, { force, migrations, changes, label: `${part} 线`, playable: true })
  }
  return changes.length ? { state: next, changes } : { state, changes }
}
