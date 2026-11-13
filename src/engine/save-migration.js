import { validateDraftState } from '../deck/draft-mode.js'
import { contentRegistry } from '../../content/registered.js'
import { investigatorRule } from '../cards/card-rules.js'
import { registeredEntry } from './ability.js'
import { bondedPoolMain, bondedCardList } from './bonded.js'
import { ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'
import { validateMechanicState } from './mechanic-state.js'
import { validateInvestigatorMechanics } from './investigator-mechanics.js'
import { validateEoteState } from './eote-primitives.js'
import { validateEotePlayerPrimitives } from './effect-state.js'
import { validateTskState } from './tsk-primitives.js'
import { discardDreamGateIntruders } from './dream-gate.js'
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
  entryNeedsReactionPrompt,
} from '../cards/card-rules.js'
import { STATE_SCHEMA_VERSION, RULES_VERSION, stateCompatibilityError } from './rules-state.js'
import { createGameState, scenarioRuntime, refreshStateResources, unknownCardCodes, legalMoves, validateMove, applyMove, decisionSeat } from './engine.js'

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
      slotsOverride: true,
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

// 卡面「快速反应」开关也来自条目声明。口径在 card-rules.js#entryNeedsReactionPrompt：
// explicitReactionPrompt（如 02305 黄金怀表），以及所有快速事件（played + fast，含 01050 逃避隐藏
// 这类没有触发时机、只在收尾玩家窗口以「⚡ 快速打出」出现的卡）。条目补上口径后，旧存档内嵌的卡面
// 定义同样是旧值、资源版本却没变；检测到「条目声明了开关但内嵌定义仍为 false」就强制刷新一次，
// 否则读档后手牌上没有闪电开关，玩家关不掉本局提示。
function needsReactionPromptFlags(state) {
  const cards = state.cards
  if (!cards || typeof cards !== 'object') return false
  return Object.values(cards).some(def => def && typeof def === 'object'
    && def.hasReactionPrompt !== true
    && entryNeedsReactionPrompt(def.code || def.originalCode))
}

// 待决选择存在、但派生缓存 `legalMoves` 整个缺失：客户端按缓存渲染选项（observation.js#viewState
// 对决策座位直接复制 `state.legalMoves`），缓存缺失会让窗口只剩提示、没有按钮，整局卡死。
// 已知来源：P10 之前的并行开局在 launchParallelLanes 里直接跑 resolveTransaction（事务重建会丢掉
// 派生缓存），若第一处待决选择正好问本线真人（没有 AI 先提交动作刷新缓存），B 线从开局第一秒就卡住。
// 建局/正常行动路径都会补算这个缓存；这里只在旧存档缺字段时重算一次（migrateRuntime 的 playable 分支）。
function needsCachedLegalMoves(runtime) {
  return !!runtime?.pendingChoice && !Array.isArray(runtime.legalMoves)
}

// 2026-11-13：回合收尾流程模型从 1（旧：行动点用尽自动推进 + 收尾玩家窗口）升到 2
// （行动点用尽后停在空档期，快速卡/[free] 能力是 legalMoves 直接行动，玩家必须主动 endTurn）。
// 旧存档若正好停在已移除的「收尾玩家窗口」暂停点上，恢复凭据里的窗口答案会在续玩时变成
// 「未消费的选择恢复凭据」并报错；这里按「玩家让过收尾窗口」处理：清掉暂停、把回合交还给行动者。
// 返回变更说明；无需升级时返回 null。
function upgradeTurnFlowModel(state, { silent = false } = {}) {
  if (!state || state.turnFlowModel === 2) return null
  state.turnFlowModel = 2
  const choice = state.pendingChoice
  if (choice && choice.kind === 'playerWindow' && choice.source === 'investigation.afterAction') {
    const actorSeat = state.turnSeat ?? state.currentSeat
    const actor = state.investigators?.[actorSeat]
    if (actor && ((actor.actionsLeft || 0) <= 0 || actor.turnEnded === true)) {
      state.pendingChoice = null
      delete state.continuation
      state.currentSeat = actorSeat
      delete state.turnSeat
      return silent ? null : '回合收尾流程升级：已移除的收尾玩家窗口按让过处理（行动点用尽后需主动结束回合）'
    }
  }
  return silent ? null : '回合收尾流程升级：行动点用尽后不会自动结束回合，需主动提交「结束回合」'
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

const scenarioBehavior = state => state.scenario?.id ? contentRegistry.getBehavior(state.scenario.id) || {} : {}

// ---------------------------------------------------------------------------
// 旧存档修复：调查员卡面属性被《天机之城》换身还原污染成 2/2/2/2。
//
// v0.4.0 及更早的换身还原直接照抄身份快照，而快照是「先把四属性覆盖成伊斯人身体 04244 的
// 2/2/2/2、之后才拍」的污染快照：还原后卡号/名字/牌组都回到本人，四属性却留在 2，且不再带
// 任何换身标记。检查点的 continuation.base（关卡开局事务基座）也会留这份污染，从检查点重新
// 开始时开局重建沿用基座，就把两名调查员都变成 2/2/2/2。
// 修复口径与 content/.../body-swap.js#reapplyCampaignIdentity 一致：按战役记录里的调查员卡号
// 重建卡面身份；仍在换身中的卡（form/formOriginal/yithianBody）不动，由内容层换身钩子处理。
// ---------------------------------------------------------------------------
function investigatorCardDefinition(code) {
  if (!code) return null
  if (INVESTIGATORS[code]) return INVESTIGATORS[code]
  const card = ALL_CARDS[code]
  return card?.type === 'investigator' ? card : null
}

function campaignInvestigatorRecord(state, seat) {
  const list = state.campaign?.investigators
  return Array.isArray(list) ? list[seat] : list?.[seat]
}

function investigatorIdentityNeedsRepair(state) {
  for (const inv of state.investigators || []) {
    if (!inv || inv.form || inv.formOriginal || inv.yithianBody) continue
    const record = campaignInvestigatorRecord(state, inv.seat)
    if (!record?.code || record.code !== inv.code) continue
    const def = investigatorCardDefinition(record.code)
    if (!def) continue
    if (inv.willpower !== def.willpower || inv.intellect !== def.intellect
      || inv.combat !== def.combat || inv.agility !== def.agility) return true
  }
  return false
}

const INVESTIGATOR_IDENTITY_REPAIR_NOTE = '按战役记录重建调查员卡面属性（旧版《天机之城》换身还原残留的 2/2/2/2）'

function repairInvestigatorIdentity(state, changes) {
  let repaired = 0
  for (const inv of state.investigators || []) {
    if (!inv || inv.form || inv.formOriginal || inv.yithianBody) continue
    const record = campaignInvestigatorRecord(state, inv.seat)
    if (!record?.code || record.code !== inv.code) continue
    const def = investigatorCardDefinition(record.code)
    if (!def) continue
    const identity = {
      name: def.nameZh || def.name,
      nameEn: def.name,
      klass: def.klass,
      willpower: def.willpower,
      intellect: def.intellect,
      combat: def.combat,
      agility: def.agility,
    }
    let changed = false
    for (const [key, value] of Object.entries(identity)) {
      if (inv[key] === value) continue
      inv[key] = value
      changed = true
    }
    if (changed) repaired += 1
  }
  if (repaired && !changes.includes(INVESTIGATOR_IDENTITY_REPAIR_NOTE)) changes.push(INVESTIGATOR_IDENTITY_REPAIR_NOTE)
  return repaired
}

// ---------------------------------------------------------------------------
// 旧存档修复：敌人与调查员不在同一地点却仍处于交战。
//
// 已知成因（2026-11-13 实机）：卢克·罗宾逊（06004）「如同位于连接地点打出事件」期间新生成的
// 敌人会与卢克交战——例如在梦境之门「如同位于」打出「飞蛾扑火」（01064）时抽到没有生成指令
// 的敌人。事件结束后卢克已回到梦境之门/原地点，旧版 as-if-location.js#endAsIf 只解除开局接管
// 的那批敌人，这只新敌人仍留着 engagedSeat：敌方阶段按「交战」隔着地点攻击，卢克走到哪都挨打。
// 官方 FAQ（ArkhamDB › Luke Robinson）口径：事件结束后敌人留在那个连接地点、不能继续与卢克
// 交战。这里按同一口径只解除交战（不移动敌人）；只处理仍活着的调查员，避免误改已退场数据。
// ---------------------------------------------------------------------------
function crossLocationEngagedEnemies(state) {
  const alive = new Map((state.investigators || [])
    .filter(inv => inv && Number.isInteger(inv.seat) && !inv.defeated && !inv.resigned)
    .map(inv => [inv.seat, inv]))
  return (state.enemies || []).filter(enemy => enemy && Number.isInteger(enemy.engagedSeat)
    && alive.has(enemy.engagedSeat)
    && enemy.location !== alive.get(enemy.engagedSeat).location)
}

function repairCrossLocationEngagements(state, changes) {
  const broken = crossLocationEngagedEnemies(state)
  if (!broken.length) return 0
  const codes = []
  for (const enemy of broken) {
    const inv = state.investigators[enemy.engagedSeat]
    enemy.engagedSeat = null
    if (Array.isArray(inv?.engaged)) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
    codes.push(enemy.originalCode || enemy.code || enemy.name || '?')
  }
  const note = `解除 ${broken.length} 个跨地点交战（敌人不在调查员所在地点；${codes.join('、')}）`
  if (!changes.includes(note)) changes.push(note)
  return broken.length
}

function needsCardModelRepair(state) {
  return scenarioBehavior(state).needsSaveRepair?.(state) || (state.scenarioFlags?.agendaAside || []).length>0 || (state.enemies || []).some(host => !host.hostId && (host.swarmCards || []).some(card =>
    !card.defeated && (card.ownerSeat == null || !state.enemies.some(enemy => enemy.id === card.id && enemy.hostId === host.id))))
    || Object.keys(state.bondedSets || {}).some(key => bondedPoolMain(key.split('@')[0]) !== key.split('@')[0])
    || investigatorIdentityNeedsRepair(state)
}

// Repair both the live runtime and its transaction base so a resumed choice cannot restore obsolete physical cards.
export function repairRuntimeCardModels(state, changes = []) {
  repairInvestigatorIdentity(state, changes)
  const behavior = scenarioBehavior(state)
  if (behavior.needsSaveRepair?.(state)) {
    // 修复说明由剧本提供（例如天机之城的换身补齐）；没有提供时沿用旧文案。
    // 允许 saveRepairNoteFor(state) 覆盖固定文案（已结算关卡只做还原，与「补装换身」区分）。
    // 运行时与 continuation.base 会各修复一次，说明只记一条。
    const note = behavior.saveRepairNoteFor?.(state) || behavior.saveRepairNote
      || '恢复场外全局牌的实际实例与旋转角度'
    if (!changes.includes(note)) changes.push(note)
    behavior.repairSavedState(state, scenarioRuntime(state, []))
  }
  if (Array.isArray(state.scenarioFlags?.agendaAside) && state.scenarioFlags.agendaAside.length) {
    state.agendaAside ||= []
    for(const card of state.scenarioFlags.agendaAside) {
      const code=typeof card==='string'?card:card.code
      state.instanceSeq ||= {c:0,e:0}
      state.agendaAside.push(typeof card==='string' ? {code,originalCode:code,id:'agendaAside:c'+(++state.instanceSeq.c)} : card)
    }
    delete state.scenarioFlags.agendaAside
    changes.push('把密谋旁的旧标记恢复为公共区域实体')
  }
  for (const host of [...(state.enemies || [])].filter(enemy => !enemy.hostId)) {
    for (const card of host.swarmCards || []) {
      if (card.defeated) continue
      if (card.ownerSeat == null) {
        const seat = host.swarmOwnerSeat ?? host.engagedSeat ?? state.campaign?.leadSeat ?? 0
        const owner = state.investigators?.[seat]
        // Legacy placeholders came from the encounter deck. Return those physical cards before replacing them.
        state.encounterDeck ||= []
        state.encounterDeck.unshift(card.code)
        const code = owner?.deck.pop()
        if (!code) { card.defeated = true; continue }
        card.code = code; card.ownerSeat = seat
        changes.push('蜂拥：归还旧遭遇占位卡，改用所属调查员牌库中的实体卡')
      }
      if (state.enemies.some(enemy => enemy.id === card.id && enemy.hostId === host.id)) continue
      state.enemies.push({ ...host, id:card.id, hostId:host.id, kind:'swarm', underlyingCard:card.code,
        swarmOwnerSeat:card.ownerSeat, damageTaken:0, doom:0, clues:0, victory:0, vengeance:0,
        attachments:[], swarmCards:[], swarming:null, pendingSwarmCount:0 })
      const engaged = state.investigators?.[host.engagedSeat]
      if (engaged && !(engaged.engaged ||= []).includes(card.id)) engaged.engaged.push(card.id)
      changes.push('蜂拥：恢复可独立指定与攻击的敌人实例')
    }
  }
  if (!state.bondedSets) return
  const merged = {}
  for (const [key, set] of Object.entries(state.bondedSets)) {
    const main = bondedPoolMain(key.split('@')[0])
    const canonicalKey = merged[main] && merged[main].seat !== set.seat ? main+'@'+set.seat : main
    if (!merged[canonicalKey]) merged[canonicalKey] = { ...set, cards:[] }
    merged[canonicalKey].cards.push(...set.cards)
    merged[canonicalKey].retrieved ||= set.retrieved
    if (key !== canonicalKey) changes.push('绑定：合并同一调查员的同组升级卡场外集合')
  }
  for (const [key, set] of Object.entries(merged)) {
    const owner = state.investigators?.[set.seat]
    const codeOf = card => typeof card === 'string' ? card : card?.code
    const inPlay = owner ? ['hand','deck','discard','assets','threat'].flatMap(zone => owner[zone] || []).map(codeOf) : []
    const allowance = new Map(bondedCardList(ALL_CARDS[key.split('@')[0]]).map(entry =>
      [entry.code, Math.max(0,entry.count-inPlay.filter(code => code === entry.code).length)]))
    set.cards = set.cards.filter(card => {
      const code = codeOf(card), left = allowance.get(code) || 0
      if (!left) return false
      allowance.set(code,left-1); return true
    })
  }
  state.bondedSets = merged
}

function runtimeNeedsWork(runtime, force) {
  if ([runtime, runtime.continuation?.base].filter(Boolean).some(needsCardModelRepair)) return true
  // 旧存档里可能有敌人落在梦境之门上（06015a/b 禁止敌人进入/生成）。修复口径见
  // dream-gate.js#discardDreamGateIntruders：按 FAQ v2.1 改为弃掉该敌人。
  if ([runtime, runtime.continuation?.base].filter(Boolean).some(saved => (saved.enemies || []).some(enemy =>
    (saved.locations || []).some(location => location.id === enemy.location && location.dreamGate === true)))) return true
  // 旧存档里可能有「敌人不在调查员所在地点却仍交战」（卢克「如同位于」旧 bug）。修复见下方
  // repairCrossLocationEngagements：按官方 FAQ 解除交战，不移动敌人。
  if ([runtime, runtime.continuation?.base].filter(Boolean).some(saved => crossLocationEngagedEnemies(saved).length > 0)) return true
  if ([runtime, runtime.continuation?.base].filter(Boolean).some(saved => saved.investigators?.some(inv => investigatorRule(inv.code)?.resourceBank && inv.resourceBankModel !== 2) || saved.scenarioFlags?.dancerVoidCell)) return true
  return !!force || needsAutoReactionFlags(runtime) || needsReactionPromptFlags(runtime)
    || needsCachedLegalMoves(runtime)
    || runtime.turnFlowModel !== 2
    || !!stateCompatibilityError(runtime, META.resourceVersion)
}

// 一条可续玩的运行时（单线对局，或并行里的一条线）。容器本身在并行时只是外壳。
function migrateRuntime(runtime, { force, migrations, changes, label, playable }) {
  if (typeof runtime.schemaVersion !== 'number') throw new Error(`${label}缺少结构版本，无法识别，请重新开局`)
  if (runtime.schemaVersion > STATE_SCHEMA_VERSION) throw new Error(`${label}来自更新版本（结构 v${runtime.schemaVersion}），请升级游戏后再读取`)
  if (!runtime.campaign?.id) throw new Error(`${label}缺少战役信息，无法修复`)
  const local = []
  for (const saved of [runtime, runtime.continuation?.base].filter(Boolean)) repairRuntimeCardModels(saved, local)
  // 梦境之门（06015a/b）：旧存档里非法生成/进入的敌人按 FAQ v2.1 改为弃掉。
  for (const saved of [runtime, runtime.continuation?.base].filter(Boolean)) {
    const intruders = discardDreamGateIntruders(saved)
    if (intruders.length) local.push(`梦境之门：弃掉 ${intruders.length} 个非法进入的敌人（敌人不能进入/生成在梦境之门；${intruders.join('、')}）`)
  }
  // 跨地点交战（卢克「如同位于」旧 bug）：事件结束后敌人留在原地、解除交战（官方 FAQ）。
  for (const saved of [runtime, runtime.continuation?.base].filter(Boolean)) repairCrossLocationEngagements(saved, local)
  for (const saved of [runtime, runtime.continuation?.base].filter(Boolean)) for (const inv of saved.investigators || []) {
    if (!investigatorRule(inv.code)?.resourceBank || inv.resourceBankModel === 2) continue
    if (investigatorRule(inv.code)?.resourceBank) {
      const bank = inv.assets?.find(asset => asset.code === investigatorRule(inv.code).resourceBank.assetCode)
      inv.resources = Math.max(0, (inv.resources || 0) - (bank?.resources || 0))
      local.push('家族遗产：分离卡上资源与资源池')
    }
    inv.resourceBankModel = 2
  }
  if (runtime.scenarioFlags?.dancerVoidCell) {
    const dancers = runtime.enemies?.filter(enemy => registeredEntry(enemy.originalCode || enemy.code)?.movesThroughVoid) || []
    for (const enemy of dancers) {
      const cell = runtime.scenarioFlags.dancerVoidCell
      enemy.cosmosCell = { ...cell }; enemy.location = 'cosmosVoid:' + cell.x + ':' + cell.y
      enemy.dancerVoidRound = runtime.scenarioFlags.dancerVoidRound
    }
    delete runtime.scenarioFlags.dancerVoidCell
    delete runtime.scenarioFlags.dancerVoidRound
    delete runtime.scenarioFlags.pendingDancerVoidCell
    local.push('迁移盲目舞者的独立虚空位置')
  }
  migrateVersions(runtime, migrations, local)
  upgradeResources(runtime, local, force || needsAutoReactionFlags(runtime) || needsReactionPromptFlags(runtime))
  fillMissingFields(runtime, local)
  // 2026-11-13：回合收尾流程模型升级放在「补齐缺失字段」之后——旧存档清理收尾窗口暂停点时要删掉
  // turnSeat，而新开局模板的 turnSeat=0 会被 fillMissingFields 加回来。continuation.base 只补字段、
  // 不报变更（静态字段在续算时从 runtime 合并，见 resolution.js 的 STATIC_FIELDS）。
  const turnFlowNote = upgradeTurnFlowModel(runtime)
  if (turnFlowNote) local.push(turnFlowNote)
  if (runtime.continuation?.base) upgradeTurnFlowModel(runtime.continuation.base, { silent: true })
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
  // Optional extension v1 is inside the existing scenarioFlags schema; absent old saves stay untouched.
  validateDraftState(state)
  validateMechanicState(state)
  validateInvestigatorMechanics(state)
  // 七循环 P2：EotE 可选扩展（scenarioFlags.mechanics.eote / campaign.eote / 既有 mechanicState 的
  // 数值钥匙与隐藏剧本牌库）。旧存档没有这些键时各校验直接跳过，字节不变。
  validateEoteState(state)
  // P6：玩家卡原语的纯 JSON 归属记录（跨座位手牌转移等）。
  validateEotePlayerPrimitives(state)
  // 八循环 P2：TSK 可选扩展（scenarioFlags.mechanics.tsk / campaign.tsk / 既有 mechanicState 的
  // 场景扩展）。旧存档没有这些键时各校验直接跳过，字节不变。
  validateTskState(state)
  for (const saved of [state.continuation?.base, ...parallelLaneEntries(state).map(([, lane]) => lane)].filter(Boolean)) {
    validateDraftState(saved); validateMechanicState(saved); validateInvestigatorMechanics(saved); validateEoteState(saved); validateEotePlayerPrimitives(saved); validateTskState(saved)
  }
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
