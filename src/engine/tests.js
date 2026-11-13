import { putInHand } from './hand-entry.js'
import { discardPlayerCards, replacePlayerZoneCards } from './player-zones.js'
import { modifierTotal } from './modifiers.js'
import { ignoreLocationTrigger } from './location-effect-scope.js'
import { withFailureRecipient, effectRecipient } from './effect-recipient.js'
import { bondedSetKey } from './bonded.js'
import { availableResources } from './resource-bank.js'
import { enemyRuleFlags, investigatorRule } from '../cards/card-rules.js'
import { SKILL_NAMES } from './presentation-constants.js'
import { handCommitBlocker } from './tarot-slot.js'
import { afterHandDiscard } from './hand-discard-window.js'
import { canCommitToTest, commitResourceCost, payCommitResourceCost } from './commit-rules.js'
import { returnCommitment } from './commit-origins.js'
import { addPoolTokens, releasePoolTokens } from './chaos-token-pool.js'
import { tokenEffect } from './chaos-token-effects.js'
import { floodLevel } from './flood.js'
import { notePromiseEvent } from './turn-promises.js'
import { nextInstanceId } from './rules-state.js'
// 07185 的条目级标记读点（floodedAttackExtraTokenRule）是模块级函数，需要 ability.js 的注册表读法。
import { registeredEntry } from './ability.js'
import { applyPendingFlipAfterTests, noteRoundEvent, sampleRoundEvents } from './eote-investigator-support.js'
import { noteCommitToOther } from './tsk-investigator-support.js'
// 技能检定主流程（performTest）从 engine.js 拆出的最大模块（Phase 6 · 6d-12）。
//
// 一次检定跨 ST.1–ST.8 八个阶段：投入 → 揭示标记 → 结算修正 → 结果回调 → 收尾。
// 它调用几乎所有子系统（卡牌投入、混乱标记、隐藏卡、反应窗口、暴露弱点），
// 因此依赖表有 61 项——这是拆分过程中依赖最多的一块，也是「engine.js 仍然是编排层」的关键证据：
// 主流程本身搬走后，engine.js 只剩各域动作与阶段机的调度。
//
// 依赖注入同前；resolve 回调不可序列化，仍然挂在 WeakMap（见 engine.js 的 testResolvers）。

// 第 2 步 P2.5：技能可以是单个技能名，也可以是 2–4 个技能的数组（阵法）。
// 规范化在进入检定流程前完成，单技能调用得到 ['<skill>']，后续求和与单值完全一致。
// 技能名表与引擎其它日志同源（presentation-constants），不复制中文。
const TEST_SKILL_NAMES = Object.freeze({ ...SKILL_NAMES, wild: '万能' })

// 07185 伏兵出水：「当你攻击淹没地点的敌人并揭示混乱标记时：再揭示一个混乱标记
//（每次检定最多一次）」。条目在 `treacheryRule.extraTokenOnAttackAtFlooded` 声明；
// 卡放在密谋牌库旁（state.agendaAside），只要仍在场就生效。
export function floodedAttackExtraTokenRule(state, options) {
  const enemyId = options?.source?.enemyId ?? options?.testTarget?.id ?? null
  if (enemyId == null) return false
  const enemy = (state.enemies || []).find(item => item.id === enemyId)
  if (!enemy || enemy.location == null) return false
  if (floodLevel(state, enemy.location) <= 0) return false
  return (state.agendaAside || []).some(card =>
    registeredEntry(card.originalCode || card.code)?.treacheryRule?.extraTokenOnAttackAtFlooded === true)
}

export function normalizeTestSkills(skill) {
  const list = Array.isArray(skill) ? skill : [skill]
  if (!list.length) throw new Error('技能检定至少需要一个技能')
  for (const name of list) {
    if (typeof name !== 'string' || !TEST_SKILL_NAMES[name]) throw new Error(`未知技能：${JSON.stringify(name)}`)
  }
  if (list.length > 4) throw new Error(`一次检定最多使用 4 项技能（收到 ${list.length} 项）`)
  return [...list]
}

// 单技能时返回与旧实现逐字一致的标签（'智识'），多技能用 '+' 连接（'意志+智识'）。
export function testSkillLabel(skill) {
  const list = Array.isArray(skill) ? skill : [skill]
  return list.map(name => TEST_SKILL_NAMES[name] || name).join('+')
}

export function createPerformTest(deps) {
  const {
    campaignState,
    capabilityBlocked,
    EFFECTS,
    SKILL_NAMES,
    ScenarioEnded,
    abilityApi,
    activeHiddenRules,
    aliveInvestigators,
    applyFreeTriggers,
    applyDamage,
    applyHorror,
    applySkillOnSuccess,
    applyTokenFx,
    beginChaosTest,
    canDiscardFromHand,
    cardDef,
    cardName,
    codexSealedElderSign,
    commitIcons,
    commitProfile,
    discoverClueAt,
    descriptorSources,
    // 场上非玩家实体（敌人/地点/幕/密谋）的监听者：窗口守卫必须一起看，
    // 否则「沉睡达贡」这类敌人卡的检定窗口强制能力永远不会被派发。
    nonPlayerAbilitySources,
    drawCards,
    drawChaosToken,
    elderSignEffect,
    endChaosTest,
    enemiesEngagedWith,
    enemyTextBlanked,
    exilePlayerCard,
    expireEffects,
    getMaxSanity,
    getStat,
    getThreatEffect,
    hasHiddenCard,
    hiddenCommitLimitReached,
    hiddenDefinition,
    hiddenRule,
    noteHiddenCommit,
    info,
    investigatorMoveDestinations,
    investigatorTextBlanked,
    isChargeAsset,
    isWeaknessCode,
    leaveAsset,
    locName,
    lolaCanUseCard,
    makeRuntime,
    minhCommitWildBonus,
    pendingTestResult,
    // 2026-10-27：「如同手牌」通道统一原语（技能检定投入的 beneath 通道）。
    playChannels,
    playerWindow,
    randomValue,
    reactionWindow,
    registeredEntry,
    relocateInvestigator,
    removeHiddenMarker,
    removeOne,
    requestChoice,
    resourceBank,
    resolveEffect,
    resolveSpecialToken,
    returnChaosToken,
    runtimeCardAvailable,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    summarizeTestResult,
    campaignBeforeChaosReveal,
    campaignFailedTestWindow,
    tokenLabel,
    triggerReaction,
  } = deps

// 第 59 轮：地点卡自己的「检定失败」规则（02133/02135/02136、02056 等）由条目声明。
// 引擎在内容层 afterTest 之后统一派发，避免每个章节 behavior 手写一遍。
// 2026-11-13 P1-6：同地点、条目声明 flags.testWindowObserver 的调查员（09015）也参与
// test.beforeCommit/afterCommit 窗口——卡面是「你所在地点的技能检定期间」而不是「你执行」。
function testWindowSeats(state, seat) {
  const performer = state.investigators?.[seat]
  if (!performer) return null
  const extra = aliveInvestigators(state)
    .filter(other => other.seat !== seat && other.location === performer.location
      && registeredEntry(other.code)?.flags?.testWindowObserver === true)
    .map(other => other.seat)
  return extra.length ? [seat, ...extra] : null
}

function runLocationTestFail(state, inv, result, events) {
  if (result.success) return
  const loc = state.locations.find(item => item.id === inv.location)
  if (!loc) return
  const hook = registeredEntry(loc.originalCode || loc.code)?.locationRule?.onTestFail
  if (hook && !ignoreLocationTrigger(state, loc.id, requestChoice, '地点的检定失败能力')) hook(state, loc, scenarioRuntime(state, events), effectRecipient(state, inv), result)
}

function performTest(state, seat, skill, difficulty, options = {}) {
  // 本次检定开始时已经存在的 endOfTest 效果。其中属于**其他调查员**的「下一次技能检定 +N」
  // 是留给对方下一次检定的：本次检定结束不能把它一起过期（扫描报告 P0-10 #1）。
  const carriedEndOfTestEffects = new Set((state.effects || [])
    .filter(effect => effect.duration === 'endOfTest').map(effect => effect.id))
  beginChaosTest(state)
  // P5 地球边缘：本轮技能检定计数（陈丽丽 Broken 演武的轮末条件读点）；
  // 检定发起也是一次「行动结算」，这里补采样手牌数/同地点敌人的粘性条件。
  noteRoundEvent(state, state.investigators?.[seat], 'tests', 1)
  sampleRoundEvents(state)
  // P2.5：多技能合成检定。单技能时 skillList=[skill]，所有求和退化为原值，行为逐字不变。
  let skillList = normalizeTestSkills(skill)
  let skillContext = skillList.length === 1 ? skillList[0] : [...skillList]
  const skillLabel = testSkillLabel(skillList)
  const skillTotal = () => skillList.reduce((sum, name) => sum + getStat(state, inv, name), 0)
  const previousTest = state.skillTest || null
  const typedTarget = (registeredEntry(state.scenario?.referenceCode)?.scenarioRule?.trackTestTarget === true || state.investigators.some(owner => owner.assets.some(card => registeredEntry(card.originalCode || card.code)?.assetRule?.trackTestTarget)))
    ? options.testTarget : null
  // 每次检定的实例 id（limit.perTest 的键）：修复前引擎从未给 state.skillTest.id 赋值，
  // perTest 退化成一串 round/turn 键，同一回合的第二次检定被误判为同一次（审计 M27/M32）。
  // 只在「章节开启 eventWindowInstances」的 TIC 写实例 id：其它战役的 skillTest 形状与
  // 重放指纹逐字不变（id 会出现在暂停中的检定状态里，属于基线指纹的一部分）。
  const enableTestInstance = state.scenario?.eventWindowInstances === true
  // 2026-11-13 P1-6：perTest 上限（limits.js#scopeKey）读 skillTest.id。此前只有声明
  // eventWindowInstances 的剧本才有 id，其余剧本退化为 round:turnSerial，同一回合的两次检定
  // 会被误判为同一次。这里始终提供唯一 id：启用的剧本仍持久化（旧口径），其余用瞬态
  // _testSerial（_ 前缀不进重放指纹）并写成非枚举属性。
  const transientTestSerial = (Number(state._testSerial) || 0) + 1
  state._testSerial = transientTestSerial
  const testInstanceId = enableTestInstance ? nextInstanceId(state, 'test') : `transienttest${transientTestSerial}`
  state.skillTest = { seat, skill: skillContext, difficulty: Math.max(0, difficulty), stage: 'ST.1', committed: [], publicLog: [...state.log],
    ...(enableTestInstance ? { id: testInstanceId } : {}),
    ...(typedTarget ? { actionKind: options.actionKind || typedTarget.actionKind, target: { kind: typedTarget.kind, id: typedTarget.id } } : {}),
    ...(options.actionKind ? { actionKind: String(options.actionKind) } : {}),
    ...(options.basicAction ? { basicAction: options.basicAction } : {}),
    ...(options.iconWeights ? { iconWeights: { ...options.iconWeights } } : {}),
    ...(options.blockCommitSeats ? { blockCommitSeats: [...options.blockCommitSeats] } : {}),
    source: options.source || { type: 'effect', label: '卡牌效果检定', name: skillLabel + '检定' } }
  if (!enableTestInstance) {
    Object.defineProperty(state.skillTest, 'id', { value: testInstanceId, enumerable: false, writable: true, configurable: true })
  }
  const scenarioTestFrame = state.skillTest
  // 2026-11-13 P1-8：检定来源的权威字段。09023「用附属枪械攻击」等条件读
  // skillTest.assetSourceId（此前全仓没有写入点，只有描述子路径顺带压 _resolvingAssetId）；
  // 09105/09108 等「难度 0 的某类检定/揭示标记前」需要 actionKind 与目标敌人。
  // 这些是**运行时元数据**：用非枚举属性写入（不进入存档与重放指纹，避免只加字段就全量指纹漂移）。
  const defineMeta = (key, value) => Object.defineProperty(state.skillTest, key,
    { value, enumerable: false, writable: true, configurable: true })
  if (options.source?.assetId != null) defineMeta('assetSourceId', options.source.assetId)
  if (!state.skillTest.actionKind && options.source?.actionKind) defineMeta('actionKind', String(options.source.actionKind))
  if (!state.skillTest.target && options.source?.enemyId != null) defineMeta('target', { kind: 'enemy', id: options.source.enemyId })
  const inv = state.investigators[seat]
  const events = []
  difficulty = Math.max(0, difficulty)
  const investigationLocation = options.investigation?.locationId
    && state.locations.find(location => location.id === options.investigation.locationId)
  const initiatedHook = investigationLocation && registeredEntry(investigationLocation.originalCode || investigationLocation.code)?.locationRule?.onInvestigationTestInitiated
  if (initiatedHook && !ignoreLocationTrigger(state, investigationLocation.id, requestChoice, '调查检定开始时的地点能力')) {
    const modifier = initiatedHook(state, inv, investigationLocation, scenarioRuntime(state, events)) || 0
    difficulty = Math.max(0, difficulty + modifier)
    state.skillTest.difficulty = difficulty
  }
  const nextReduction = inv.nextTestDifficultyReduction
  if (nextReduction) {
    delete inv.nextTestDifficultyReduction
    if (nextReduction.round === state.round && nextReduction.phase === (state.immediateAction?.returnPhase || state.phase)) {
      difficulty = Math.max(0, difficulty - nextReduction.amount)
      state.skillTest.difficulty = difficulty
    }
  }
  // 全局难度修正（03288 北部塔楼：a 密谋毁灭多于 c 时所有技能检定 -1）。
  const globalDifficulty = scenarioBehavior(state).testDifficultyModifier?.(state, inv, skillContext, difficulty, options.source) || 0
  if (globalDifficulty) {
    difficulty = Math.max(0, difficulty + globalDifficulty)
    state.skillTest.difficulty = difficulty
  }
  // 「纳克特手稿」：本回合下一场检定不揭示混乱标记。
  if (inv.nextTestNoTokens?.round === state.round) {
    delete inv.nextTestNoTokens
    state.skillTest.skipTokens = true
  }
  // 2026-10-25 第七轮修复 05029：资源技能检定——以当前资源数作为基值。
  let statReference = options.resourceSkill === true ? Math.floor((inv.resources || 0) / 2) : skillTotal()
  const startingStat = options.baseValue ?? statReference
  // Phase 5（5a-8）：「谈判」检定难度降低由条目级 negotiationDifficultyReduction 声明。
  const negotiationReduction = inv.assets.reduce((sum, asset) => sum + (registeredEntry(asset.code)?.negotiationDifficultyReduction || 0), 0)
  if (negotiationReduction && options.source?.label?.includes('谈判')) {
    difficulty = Math.max(0, difficulty - negotiationReduction)
    state.skillTest.difficulty = difficulty
  }
  const initialBonus = typeof options.skillBonus === 'function' ? options.skillBonus() : options.skillBonus || 0
  let value = startingStat + initialBonus
  for (const capture of state.victoryDisplay || []) {
    if (!options.source?.code || cardDef(capture.code)?.name !== cardDef(options.source.code)?.name) continue
    for (const attachment of capture.attachments || []) if (attachment.contributesIconsToSameNameTests) {
      value += commitIcons(state, state.investigators[attachment.ownerSeat] || inv, attachment.code, skillList)
    }
  }
  if (inv.fieldwork?.round === state.round && inv.fieldwork.phase === state.phase) {
    value += inv.fieldwork.amount || 2
    delete inv.fieldwork
  }
  if (inv.narrowEscape?.round === state.round && inv.narrowEscape.turnSeat === state.currentSeat) {
    value += inv.narrowEscape.amount || 2
    delete inv.narrowEscape
  }

  if (inv.testBonus) {
    value += inv.testBonus
    info(state, null, `${inv.name} 的检定加成 +${inv.testBonus} 生效。`)
    inv.testBonus = 0
  }

  state.skillTest.printedValue = options.baseValue ?? (options.resourceSkill === true ? Math.floor((inv.resources || 0) / 2) : skillList.reduce((sum, name) => sum + (inv[name] || 0), 0))
  state.skillTest.baseValue = startingStat
  state.skillTest.value = value

  // 「追忆未来」等：技能检定开始（投入之前）的反应窗口。
  // P6 原语：context 带本次检定的行动类型（fight/investigate/evade…）与目标；
  // 战斗/调查入口可传 `options.initiatedContext`，窗口内的卡面反应把本次攻击/调查的
  // 加值写回这个对象（08086「你发动一次攻击时 +1 伤害」读点），调用方在结算时读取。
  {
    const actionKind = options.actionKind ? String(options.actionKind)
      : (options.testTarget?.actionKind ? String(options.testTarget.actionKind) : null)
    const initiatedContext = options.initiatedContext && typeof options.initiatedContext === 'object'
      ? options.initiatedContext : null
    Object.assign(initiatedContext || {}, {
      when: 'testInitiated', seat, location: inv.location, skill: skillContext,
      ...(actionKind ? { actionKind } : {}),
      ...(options.testTarget ? { testTarget: options.testTarget } : {}),
    })
    const hasInitiatedListener = aliveInvestigators(state).some(owner => descriptorSources(state, owner).some(row =>
      row.entry?.abilities?.some(descriptor => descriptor.trigger?.includes('testInitiated'))))
    if (initiatedContext) {
      if (hasInitiatedListener) reactionWindow(state, 'testInitiated', initiatedContext, events, { allowNested: true })
    } else if (hasInitiatedListener) {
      reactionWindow(state, 'testInitiated', { when: 'testInitiated', seat, location: inv.location }, events, { allowNested: true })
    }
  }
  {
    const context = { when: 'testBegins', seat, location: inv.location, skill: skillContext, difficulty, baseValue: statReference,
      ...(options.actionKind ? { actionKind: String(options.actionKind) } : {}) }
    triggerReaction(state, seat, 'testBegins', events, context)
    reactionWindow(state, 'testBegins', { ...context, prompt: `${inv.name} 的${skillLabel}检定开始` }, events)
  }
  // 2026-10-25 第七轮修复 05029：testBegins 窗口里把检定改成资源技能检定后，
  // 重新同步 performTest 的局部变量（投入候选/最终值/成功判定都读它们）。
  if (state.skillTest.resourceSkill) {
    skillList = []
    skillContext = []
    statReference = 0
    value = state.skillTest.value
    state.skillTest.value = value
  }
  // 「手稿」等：显现效果期间的检定可以提前取消混乱标记。
  if (state._treacheryResolving) {
    const context = { when: 'revelationTest', seat, location: inv.location, skill: skillContext, difficulty }
    triggerReaction(state, seat, 'revelationTest', events, context)
    for (const other of aliveInvestigators(state).filter(owner => owner.location === inv.location)) {
      if (other.seat !== seat) triggerReaction(state, other.seat, 'revelationTestAlly', events, context)
    }
  }

  // 2026-10-25 本循环修复 testOtherInvestigatorTrigger（05246/05248）：在揭示混乱标记前，
  // 让同地点的「非检定者」各自决定是否花自己的线索降低本次检定难度（peril 检定不开放）。
  // 钩子内可用 api.choose({ seat: other.seat }) 单独询问、api.spendClues / api.reduceTestDifficulty 结算。
  if (!options.peril) {
    const otherRuntime = scenarioRuntime(state, events)
    for (const other of aliveInvestigators(state)) {
      if (other.seat === seat || other.defeated || other.resigned) continue
      scenarioBehavior(state).testOtherInvestigatorTrigger?.(state, other, inv, {
        skill: skillContext, difficulty, source: options.source || null,
        actionKind: options.actionKind ? String(options.actionKind) : null,
      }, otherRuntime)
    }
  }

  const continuousTestValue = modifierTotal(state, inv, 'testValue')
  value += continuousTestValue
  if (continuousTestValue) state.skillTest.value = value
  // A personal test stays with its owner until they explicitly ask for help.
  playerWindow(state, 'test.beforeCommit', events, seat, { onlySeats: testWindowSeats(state, seat) })
  if (!state.skillTest.resourceSkill && JSON.stringify(state.skillTest.skill) !== JSON.stringify(skillContext)) {
    const oldTotal = statReference
    skillList = normalizeTestSkills(state.skillTest.skill)
    skillContext = skillList.length === 1 ? skillList[0] : [...skillList]
    statReference = skillTotal()
    if (options.baseValue == null) value += statReference - oldTotal
    state.skillTest.baseValue = options.baseValue ?? statReference
    state.skillTest.printedValue = options.baseValue ?? skillList.reduce((sum, name) => sum + (inv[name] || 0), 0)
  }
  value += state.skillTest.pendingBonus || 0
  state.skillTest.pendingBonus = 0
  value += applyFreeTriggers(state, inv, skillContext, events)
  state.skillTest.stage = 'ST.2'

  const committed = []
  const committedCodes = new Set()
  const commitments = []
  let failureRecipientSeat
  const failureEffects = resolve => {
    if (failureRecipientSeat === undefined) {
      const recipients = [...new Set(commitments.filter(item => commitProfile(item.code)?.redirectFailureEffects).map(item => item.seat))]
      failureRecipientSeat = recipients.length > 1 ? Number(requestChoice(state, { kind: 'investigator', seat,
        source: 'failureRecipient', prompt: '选择由哪位投入者结算本次检定失败的效果。',
        options: recipients.map(target => ({ id: String(target), label: state.investigators[target].name })) })) : recipients[0] ?? seat
    }
    return withFailureRecipient(state, seat, failureRecipientSeat, resolve)
  }
  // Phase 5（5a-5）：远程投入的判据是「控制着带 remoteCommit 标记的支援」
  // （原来是两张卡的卡号组合判断）。卡面本来就是「缜密分析」授予、且只能出现在潘明的牌库里，
  // 因此行为等价；引擎不再认这两张卡的卡号（连注释里也不再写，便于 cards:workorder 收缩）。
  const grantsRemoteCommit = person => person.assets.some(asset => registeredEntry(asset.code)?.passive?.remoteCommit)
  const remoteMinhs = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && grantsRemoteCommit(other))
  const helpers = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && other.location === inv.location && !remoteMinhs.includes(other))
  // 2026-10-25：剧本级「跨地点投入」钩子（05062 女巫作祟之林：其他女巫作祟之林的调查员
  // 可以对本地点的技能检定各投入 1 张牌，反之亦然）。返回 true 的调查员加入投入方列表。
  const crossCommitOwners = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && !remoteMinhs.includes(other) && !helpers.includes(other)
    && scenarioBehavior(state).crossLocationCommit?.(state, other, inv, skillContext) === true)
  const testOwners = [inv, ...remoteMinhs, ...crossCommitOwners]
  // Phase 2（C1）：capability:commit —— 不能投入卡牌（队友投入不受影响）。
  const cannotCommit = capabilityBlocked(state, inv, 'commit')
  for (const owner of testOwners) {
    if (state.skillTest.blockCommitSeats?.includes(owner.seat)) continue
    if (owner !== inv && owner.threat.some(card => registeredEntry(card.code)?.cannotAffectOtherInvestigators)) continue
    let count = 0
    while (true) {
      // P8（食梦者 06319–06321 无眠之旅）：「每轮你不能投入超过 1 张卡牌到技能检定中」。
      // 计数在真正投入后由 noteHiddenCommit 写入 `state.scenarioFlags.hiddenCommitCounts`（按轮重置）。
      if (hiddenCommitLimitReached(state, owner)) break
      state.skillTest.value = value + skillTotal() - statReference
      const candidates = owner.hand.map((code, index) => ({ code, index }))
        .filter(() => !(cannotCommit && owner === inv))
        // 第 2 步 P2.9：手牌里有「不能投入」的卡（高塔）时，本人不能投入任何卡牌。
        // 2026-10-25 本循环修复 05042：按「手牌所有者」判定，而不是只查检定发起者——
        // 卡面「你不能在技能检定投入卡牌」不区分是谁的检定（本人/协助/远程投入都受限）。
        .filter(() => !handCommitBlocker(owner, registeredEntry))
        // 2026-11-13 P1-16（09766）：不能离开手牌的牌也不能投入（投入后进入检定堆）。
        .filter(item => registeredEntry(item.code)?.cannotLeaveHand !== true)
        .filter(item => {
          const rule = hiddenRule(state, item.code)
          if (hasHiddenCard(owner, item.code)) return rule?.allowCommit === true
          const profile = commitProfile(item.code)
          return runtimeCardAvailable(state, owner, item.code)
            && (!isWeaknessCode(item.code) || profile?.mustCommitNextTest === true || profile?.subtractIcons === true)
            && (commitIcons(state, owner, item.code, skillList) > 0 || profile?.anySkill === true)
        })
        .filter(item => lolaCanUseCard(owner, item.code))
        .filter(item => !activeHiddenRules(state, owner).some(hidden =>
          hidden.rule.cannotCommitTypes?.includes(cardDef(item.code)?.type)))
        .filter(item => scenarioBehavior(state).canCommitCard?.(state, owner, item.code) !== false)
        .filter(item => owner === inv || !commitProfile(item.code)?.selfTestOnly)
        .filter(item => !commitProfile(item.code)?.otherTestOnly || owner !== inv)
        .filter(item => !commitProfile(item.code)?.commitCondition
          || commitProfile(item.code).commitCondition({ state, owner, performer: inv, test: state.skillTest,
            baseSkillValue: skillList.reduce((sum, name) => sum + deps.baseStatValue(state, inv, name), 0) }))
        .filter(item => !commitProfile(item.code)?.requireClueAtLocation || (state.locations.find(loc => loc.id === owner.location)?.clues || 0) > 0)
        .filter(item => !commitProfile(item.code)?.requireDifficultyAboveBase
          || difficulty - skillTotal() >= commitProfile(item.code).requireDifficultyAboveBase)
        .filter(item => commitProfile(item.code)?.remainingSanityAtMost == null
          || getMaxSanity(owner) - owner.horror <= commitProfile(item.code).remainingSanityAtMost)
        .filter(item => !commitProfile(item.code)?.requireEngagedEnemy || enemiesEngagedWith(state, owner).length > 0)
        .filter(item => !commitProfile(item.code)?.maxPerTest
          || commitments.filter(committed => committed.code === item.code).length < commitProfile(item.code).maxPerTest)
        // 「重拾信念」等：可投入任意类型检定（不要求匹配图标）。
        .filter(item => hasHiddenCard(owner, item.code) || commitProfile(item.code)?.anySkill || commitIcons(state, owner, item.code, skillList) !== 0 || committedCodes.has(item.code))
        .filter(item => availableResources(owner) >= commitResourceCost(state, owner, item.code, deps))
        // 「殊死一搏」：只能单独投入。
        .filter(item => hasHiddenCard(owner, item.code) || !commitProfile(item.code)?.noOtherCommits || commitments.length === 0)
        // 已投入「殊死一搏」时不能再投入其他牌。
        .filter(item => !commitments.some(committed => commitProfile(committed.code)?.noOtherCommits)
          || item.code === commitments[0]?.code)
        // 「参透真谛」：只能投入冒险卡印刷能力的检定。
        .filter(item => hasHiddenCard(owner, item.code) || !commitProfile(item.code)?.scenarioAbilityOnly
          || options.source?.scenarioAbility === true || options.source?.ability === true
          || options.ability === true || options.scenarioAbility === true)
        .filter(item => !committedCodes.has(item.code) || !String(cardDef(item.code)?.textZh || '').includes('最多投入1张'))
      // 2026-10-27「如同手牌」通道统一原语：技能检定投入也从通道枚举（目前 beneath 声明支持投入，
      // 新增通道只要在 playChannels.commitEntries 里返回条目；进入/取牌也由原语统一）。
      for (const channelCandidate of playChannels.commitEntries(state, owner)) {
        if (!canCommitToTest(state, owner, channelCandidate.code, deps)) continue
        if (hasHiddenCard(owner, channelCandidate.code)) continue
        if (!commitProfile(channelCandidate.code)?.anySkill
          && commitIcons(state, owner, channelCandidate.code, skillList) === 0) continue
        candidates.push({
          code: channelCandidate.code, index: null, channelEntry: channelCandidate,
          optionId: channelCandidate.optionId, uiKey: channelCandidate.uiKey,
        })
      }
      const kingInYellow = investigatorRule(owner.code)?.wildCommitCompanionBonus
        && owner.threat.some(card => registeredEntry(card.code)?.kingInYellowThreat)
      if (kingInYellow && count === 0 && candidates.length < 3) candidates.length = 0
      if (owner !== inv && (!candidates.length || (!kingInYellow && count >= 1))) break
      const canFinish = !kingInYellow || count === 0 || count >= 3
      const forcedCommit = owner === inv
        ? candidates.find(item => (item.index != null && commitProfile(item.code)?.mustCommitNextTest === true) || item.channelEntry?.forced)
        : null
      const answer = forcedCommit ? forcedCommit.optionId || String(forcedCommit.index) : requestChoice(state, { kind: 'commit', source: `test:${seat}:${skillList.join(',')}`, seat: owner.seat,
        prompt: owner === inv ? `${inv.name} 的${skillLabel}检定：投入手牌后，可直接检定或求助队友。`
          : `${inv.name} 请求协助${skillLabel}检定；你可以投入一张牌，或放弃协助。`, canSkip: true,
        options: [...(canFinish ? [{ id: 'done', label: owner === inv ? '开始检定' : '放弃协助' }] : []),
          ...(owner === inv && helpers.length ? [{ id: 'help', label: '求助' }] : []),
          // 2026-10-27「如同手牌」通道统一：通道候选带 uiKey，界面据此把选项画成卡面，
          // 并让牌桌「下方」的牌成为可点的投入入口（web/card-interactions.js 的 choicePresentation）。
          ...candidates.map(item => (item.channelEntry
            ? { id: item.optionId, cardCode: item.code, uiKey: item.uiKey,
              label: item.channelEntry.label }
            : { id: String(item.index), label: '投入：' + cardName(item.code) }))] })
      if (answer === 'done') break
      if (answer === 'help') {
        state.skillTest.helpRequested = true
        testOwners.push(...helpers)
        info(state, null, `${inv.name} 请求同地点队友协助投入。`)
        break
      }
      const chosenCandidate = candidates.find(item => item.channelEntry
        ? item.optionId === answer
        : Number(item.index) === Number(answer))
      if (!chosenCandidate || !payCommitResourceCost(state, owner, chosenCandidate.code, deps)) break
      let code = null
      if (chosenCandidate?.channelEntry) {
        // 通道取牌（横置通道支援 / 从下方移出）由原语统一处理。
        code = playChannels.takeCommit(state, owner, chosenCandidate.channelEntry)
      } else code = owner.hand.splice(Number(answer), 1)[0]
      if (!code) break
      if (hasHiddenCard(owner, code)) removeHiddenMarker(owner, code)
      let icons = commitIcons(state, owner, code, skillList)
      // 「殊死一搏」：手牌越多失去越多万能图标；「占据先机」：本阶段每个行动减少 1 个万能图标。
      const skillRules = commitProfile(code)
      if (skillRules?.wildLosesPerHandCard) icons = Math.max(0, icons - owner.hand.length)
      if (skillRules?.wildLosesPerActionsThisPhase) {
        const performed = state.phaseActionCount || 0
        icons = Math.max(0, icons - performed)
      }
      const skillEffect = commitProfile(code)
      if (skillEffect?.wagerResources) {
        const maximum = Math.min(skillEffect.wagerResources, availableResources(owner))
        const wager = maximum ? Number(requestChoice(state, { kind: 'resource', source: code, seat: owner.seat,
          prompt: '选择为本次检定押注的资源。', options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount}资源` })) })) : 0
        resourceBank.spendFromPool(owner, wager, state)
        campaignState.addWager(owner, code, wager)
      }
      if (skillEffect?.spendChargesForIcons) {
        const chargeAssets = owner.assets.filter(asset => isChargeAsset(asset) && (asset.uses || 0) > 0)
        const maximum = Math.min(skillEffect.spendChargesForIcons, chargeAssets.reduce((sum, asset) => sum + asset.uses, 0))
        const spend = maximum ? Number(requestChoice(state, { kind: 'amount', source: code, seat: owner.seat,
          prompt: '选择为力量洪流花费的充能。', options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount}充能` })) })) : 0
        let remaining = spend
        for (const charged of chargeAssets) {
          const used = Math.min(remaining, charged.uses); charged.uses -= used; remaining -= used
          if (!remaining) break
        }
        icons += spend * (skillList.includes('willpower') ? 2 : 1)
      }
      if (skillList.some(name => skillEffect?.iconsPerEngagedEnemy?.includes(name))) icons += enemiesEngagedWith(state, owner).length
      if (owner !== inv && commitProfile(code)?.leadership) icons += skillList.includes('willpower') ? 2 : 1
      icons += minhCommitWildBonus(state, owner, events)
      const commitLocation = state.locations.find(location => location.id === owner.location)
      const hookMultiplier = scenarioBehavior(state).commitIconMultiplier?.(state, owner, commitLocation)
        || commitLocation?.commitIconMultiplier
      let multiplier = hookMultiplier
      // 04244 伊斯人身体：翻倍是可选反应，由玩家决定是否对刚投入的这张牌生效。
      if (hookMultiplier && typeof hookMultiplier === 'object' && hookMultiplier.multiplier) {
        const answer = requestChoice(state, {
          kind: 'reaction', source: hookMultiplier.source || 'commitIconMultiplier', seat: owner.seat, canSkip: true,
          prompt: hookMultiplier.prompt || '是否翻倍刚投入卡牌的技能图标？',
          options: [{ id: 'use', label: '翻倍' }, { id: 'skip', label: '不翻倍' }],
        })
        multiplier = answer === 'use' ? hookMultiplier.multiplier : 1
        if (answer === 'use' && hookMultiplier.once) state.skillTest[hookMultiplier.once] = true
      }
      const investigateOnly = commitLocation?.commitIconMultiplierInvestigateOnly
      if (multiplier && multiplier !== 1 && (!investigateOnly || state.skillTest.source?.label === '调查')) icons *= multiplier
      value += icons
      const committedEntry = { seat: owner.seat, code, icons,
        ...(chosenCandidate?.channelEntry ? { sourceChannel: chosenCandidate.channelEntry.channel } : {}) }
      state.skillTest.committed.push(committedEntry)
      committed.push(code)
      committedCodes.add(code)
      commitments.push(committedEntry)
      skillEffect?.onCommit?.({ state, inv: owner, source: state.skillTest.committed.at(-1),
        test: state.skillTest, api: abilityApi(state, events) })
      noteHiddenCommit(state, owner)
      notePromiseEvent(state, owner.seat, 'commit', context => reactionWindow(state, 'promiseBroken', context, events, { allowNested: true }))
      count++
      // 2026-11-09 P1 修复 05104「被困的灵魂」：投入卡牌的额外费用只在「确实投入了这张牌」之后
      // 结算（旧实现放在询问「投入/开始检定/放弃协助」之前，投入 0 张或放弃协助也会被迫结算闹鬼）。
      if (count === 1) {
        scenarioBehavior(state).beforeCommitCard?.(state, owner, {
          skill: skillContext, difficulty, committed: state.skillTest.committed || [], committedCode: code,
        }, scenarioRuntime(state, events))
      }
      // 2026-10-25 第六轮修复 05119：卡牌进入投入区后的窗口（可追加本次检定图标）。
      {
        const commitContext = { when: 'committedCard', seat: owner.seat, location: owner.location, cardCode: code, card: code, icons }
        triggerReaction(state, owner.seat, 'committedCard', events, commitContext)
        reactionWindow(state, 'committedCard', { ...commitContext, prompt: `${owner.name} 投入「${cardName(code)}」后` }, events)
      }
      info(state, null, `${owner.name} 投入「${cardName(code)}」。`, null, { public: true })
    }
    const analyticalMind = owner.assets.find(asset => !asset.exhausted
      && registeredEntry(asset.code)?.passive?.analyticalMind)
    if (count === 1 && analyticalMind) {
      const answer = requestChoice(state, { kind: 'reaction', source: analyticalMind.code, seat: owner.seat, canSkip: true,
        prompt: '是否横置「分析性思维」并抽1张牌？',
        options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '横置并抽1张牌' }] })
      if (answer === 'trigger') {
        analyticalMind.exhausted = true
        for (const line of drawCards(state, owner, 1, events)) info(state, events, line)
      }
    }
  }

  function collectForcedCommitments() {
    for (const item of commitments.slice()) if (item.withdrawn) {
      value -= item.icons || 0
      commitments.splice(commitments.indexOf(item), 1)
      const index = committed.indexOf(item.code)
      if (index >= 0) committed.splice(index, 1)
    }
    // onCommit may commit another skill. Drain the physical-card queue until
    // stable so every card contributes and resolves its own trigger once.
    for (let index = 0; index < state.skillTest.committed.length; index++) {
      const item = state.skillTest.committed[index]
      if (item.cancelled || commitments.includes(item)) continue
      value += item.icons || 0
      commitments.push(item); committed.push(item.code)
      notePromiseEvent(state, item.seat, 'commit', context => reactionWindow(state, 'promiseBroken', context, events, { allowNested: true }))
      commitProfile(item.code)?.onCommit?.({ state, inv: state.investigators[item.seat], source: item,
        test: state.skillTest, api: abilityApi(state, events) })
      if (item.seat !== state.skillTest.seat) noteCommitToOther(state, state.investigators[item.seat])
    }
  }
  collectForcedCommitments()
  state.skillTest.value = value + skillTotal() - statReference + (state.skillTest.extraCommittedIcons || 0)
  const locationRule = registeredEntry(state.locations.find(loc => loc.id === inv.location)?.originalCode
    || state.locations.find(loc => loc.id === inv.location)?.code)?.locationRule
  const committedDifficulty = locationRule?.difficultyAfterCommit?.(state, inv, scenarioRuntime(state, events)) || 0
  if (committedDifficulty) {
    difficulty = Math.max(0, difficulty + committedDifficulty)
    state.skillTest.difficulty = difficulty
  }
  const doubleOrNothing = commitments.some(item => commitProfile(item.code)?.doubleDifficultyAndRewards)
  if (doubleOrNothing) {
    difficulty *= 2
    state.skillTest.difficulty = difficulty
    info(state, events, `「孤注一掷」使本次检定难度翻倍至 ${difficulty}；成功效果将结算两次。`)
  }
  let defiedToken = null
  const defied = commitments.find(item => commitProfile(item.code)?.defiance)
  if (defied) {
    defiedToken = requestChoice(state, { kind: 'token', source: defied.code, seat, prompt: `${cardName(defied.code)}：选择本次检定要忽略的混乱符号。`,
      options: ['skull', 'cultist', 'tablet', 'elderthing'].map(id => ({ id, label: tokenLabel(id) })) })
  }
  playerWindow(state, 'test.afterCommit', events, options.peril || !state.skillTest.helpRequested ? seat : null,
    { onlySeats: testWindowSeats(state, seat) })
  value += state.skillTest.pendingBonus || 0
  state.skillTest.pendingBonus = 0
  value += applyFreeTriggers(state, inv, skillContext, events)
  value += skillTotal() - statReference
  state.skillTest.stage = 'ST.3'
  const sealElderSign = commitments.some(item => commitProfile(item.code)?.elderSignInsteadOfChaos)
  const closeTest = (resolved, result = null) => {
    if (aliveInvestigators(state).some(owner => descriptorSources(state, owner).some(row =>
      row.entry?.abilities?.some(descriptor => descriptor.trigger?.includes('testEnds'))))
      // 场上非玩家实体（敌人/地点/幕/密谋/剧情资产）也可能是 testEnds 的监听者。
      || (nonPlayerAbilitySources?.(state, { seat }) || []).some(row =>
        row.entry?.abilities?.some(descriptor => descriptor.trigger?.includes('testEnds')))) {
      reactionWindow(state, 'testEnds', { when: 'testEnds', seat, result, source: options.source }, events, { allowNested: true })
    }
    // P5 地球边缘：检定结束后的延迟翻面（08013a「那次技能检定结束后翻面」）。
    // 只处理**本次检定执行者**自己的资产；配合 closeTest 之后的座位化效果过期，
    // 别人的检定既不会消耗「下一次检定 +N」，也不会触发延迟翻面。
    // 放在 testEnds 窗口与条件块之后：无论本局是否有 testEnds 监听者都必须执行。
    applyPendingFlipAfterTests(state, seat)
    state.skillTest.stage = 'ST.8'
    for (const item of state.skillTest.committed) {
      const profile = commitProfile(item.code)
      const owner = state.investigators[item.seat]
      const ctx = { state, inv: owner, source: item, result, test: state.skillTest, api: abilityApi(state, events) }
      profile?.afterTest?.(ctx)
      if (returnCommitment(state, item)) continue
      const destination = (result?.success ? item.onSuccessDestination : item.onFailDestination)
        || item.destination || profile?.destination?.(ctx)
      if (destination === 'attached') continue
      if (destination === 'setAside') {
        const group = ctx.api.bonded.group(item.code)
        if (group) {
          state.bondedSets ||= {}
          const set = state.bondedSets[bondedSetKey(state, group.main, item.seat)] ||= { seat: item.seat, cards: [], retrieved: true }
          set.cards.push(item.code)
        } else { state.setAsideCards ||= []; state.setAsideCards.push(item.code) }
        continue
      }
      if (destination === 'hand') { putInHand(state, owner, item.code); continue }
      if (destination === 'deckTop') { owner.deck.push(item.code); continue }
      if (destination === 'deckBottom') { owner.deck.unshift(item.code); continue }
      if (profile?.exileAfterTest || destination === 'removedFromGame') {
        state.removedFromGame ||= []
        state.removedFromGame.push(item.code)
      } else if (hiddenDefinition(state, item.code)) {
        state.encounterDiscard.push(item.code)
      } else state.investigators[item.seat].discard.push(item.code)
    }
    if (strokeOfLuckExiled && exilableCode) {
      const owner = state.investigators[seat]
      const index = owner.discard.lastIndexOf(exilableCode)
      if (index >= 0) owner.discard.splice(index, 1)
      exilePlayerCard(state, owner, exilableCode, events)
    }
    const blessings = state.chaos.revealed.flatMap((face, index) => face === 'bless' && index >= state.chaos.frames.at(-1)
      && !state.skillTest.tokenTreatments?.[index]?.retain ? [index] : [])
    if (blessings.length && aliveInvestigators(state).some(owner => descriptorSources(state, owner).some(row =>
      row.entry?.abilities?.some(descriptor => descriptor.trigger.includes('blessTokensWouldReturnToPool'))))) {
      reactionWindow(state, 'blessTokensWouldReturnToPool', { when: 'blessTokensWouldReturnToPool', seat, indexes: blessings }, events, { allowNested: true })
    }
    for (const source of state.skillTest.releaseAfterTest || []) releasePoolTokens(state, source)
    endChaosTest(state, resolved)
    state.skillTest = previousTest
  }

  let summary = null
  const resolveResult = result => {
    if (!result.success) {
      for (const item of commitments) {
        const fail = commitProfile(item.code)?.onFail
        const owner = state.investigators[item.seat]
        if (typeof fail === 'function' && owner) fail({ state, inv: owner, source: state.skillTest.committed.find(row => row.code === item.code && row.seat === item.seat), result, api: abilityApi(state, events) })
        if (!owner || (!fail?.damage && !fail?.horror)) continue
        if (fail.damage) applyDamage(state, owner, fail.damage, events)
        if (fail.horror) applyHorror(state, owner, fail.horror, events)
        info(state, events, `${owner.name} 因「${cardName(item.code)}」检定失败受到伤害和恐惧。`)
      }
    }
    // 「第七印记的封印」（04311）：任何技能检定期间每揭示一个符号标记后移除 1 充能
    // （一次检定揭示多个符号时按符号个数各触发一次）；充能耗尽时移出游戏（离场时移出由 leaveAsset 处理）。
    const symbols = ['skull', 'cultist', 'tablet', 'elderthing']
    const symbolCount = (result.drawn || []).filter(token => symbols.includes(token)).length
    if (symbolCount > 0) {
      for (const owner of state.investigators) {
        for (const asset of owner.assets.slice()) {
          const amount = registeredEntry(asset.code)?.chargesOnSymbolReveal ?? 0
          if (!amount) continue
          const removed = amount * symbolCount
          asset.uses = Math.max(0, (asset.uses || 0) - removed)
          info(state, events, `🔮 「${cardName(asset.code)}」移除 ${removed} 点充能（剩余 ${asset.uses}）。`)
          const removeWhenEmpty = registeredEntry(asset.code)?.removeFromGameWhenEmpty
    if ((asset.uses || 0) === 0 && removeWhenEmpty) {
            leaveAsset(state, owner, asset, events)
            info(state, events, `「${cardName(asset.code)}」没有充能，被移出游戏。`)
          }
        }
      }
    }
    // Public, confirmed result for the UI. Transaction replay already deduplicates
    // emitted events across choice pauses; no random draw happens in the client.
    state._resolution?.events.push({ type: 'presentation', kind: 'test', seat, name: inv.name,
      skill: skillContext, value: result.value, difficulty: result.difficulty, success: result.success,
      autoFail: !!result.autoFail, drawn: [...result.drawn], source: state.skillTest.source })
    // Phase 2（B3）：标准化结果。三处共用一份：options.resolve 的入参、窗口的 ctx.result、
    // state.lastTestResult（结算后仍可读，随存档往返），以及 api.test() 的返回值。
    summary = summarizeTestResult(state.skillTest, { ...result, seat, skill: skillContext })
    state.lastTestResult = summary
    // 就地写入：调用方（performTest 的返回值、afterTest、窗口条件）拿到的是同一个对象。
    result.summary = summary
    try {
      if (result.success) options.resolve?.(result)
      else failureEffects(() => options.resolve?.(result))
    }
    catch (error) {
      if (error instanceof ScenarioEnded) closeTest(result.drawn, result)
      throw error
    }
    closeTest(result.drawn, result)
    if (!result.success) failureEffects(() => {
      for (const fx of pendingOnFail.filter(fx=>fx.type==='drawEnemyTrait')) applyTokenFx(state, failureRecipientSeat, effectRecipient(state, inv), fx, events)
    })
  }

  const necronomiconInPlay = inv.threat.some((t) => {
    const th = getThreatEffect(t)
    return th && th.eldersignToAutofail
  })

  let delta = 0
  let lastTokenDelta = 0
  let autoFail = commitments.some(item => hiddenRule(state, item.code)?.autoFailOnCommit)
  let committedCancelled = false
  let elderSign = false
  let elderAutoSuccess = state.skillTest.autoSuccess === true
  let elderOnSuccess = null
  let elderOnSuccessAlways = false
  let elderReturnCommittedSkill = false
  let elderMayMoveAfterTest = false
  let elderMayMoveAfterTestAlways = false
  let elderClueOnSuccessBy = 0
  let elderChosenReward = false
  let elderOptionalDraw = 0
  // P6（食梦者 · 派翠丝·海瑟薇）：本次检定结束后可把弃牌堆留 1 张、其余洗回牌库。
  let elderShuffleDiscardAfterTest = null
  const drawn = []
  const cancelledTokens = []
  const pendingOnFail = []
  let wendyRedrawUsed = false
  let strokeOfLuckExiled = false
  let exilableCode = null
  let extraChaosUsed = false
  // 07185：本次检定是否已经结算过「攻击淹没地点敌人 → 额外揭示」。
  let extraFloodedAttackTokenUsed = false
  const pendingTokens = []
  const replacedEffectTokens = []
  const processedPhysicalTokens = new Set()
  let guard = 0
  while (guard++ < 100) {
    if (inv.ignoreChaosThisTurn) { drawn.push('0'); break }
    // 「手稿」等：本次检定不揭示混乱标记。
    if (state.skillTest?.skipTokens && !state.skillTest.skipTokensUsed) {
      state.skillTest.skipTokensUsed = true
      info(state, events, `${inv.name} 本次检定不揭示混乱标记。`)
      drawn.push('0')
      break
    }
    let token = sealElderSign ? 'eldersign' : null
    if (token == null && !pendingTokens.length && aliveInvestigators(state).some(owner => descriptorSources(state, owner).some(row =>
      row.entry?.abilities?.some(descriptor => descriptor.trigger?.includes('beforeChaosTokenReveal'))))) {
      const context = { when: 'beforeChaosTokenReveal', seat, location: inv.location }
      reactionWindow(state, 'beforeChaosTokenReveal', context, events, { allowNested: true })
      if (context.replacementToken) token = context.replacementToken
    }
    if (token == null && pendingTokens.length) token = pendingTokens.shift()
    const extraChoices = Math.max(options.extraChaosChoices || 0, state.skillTest?.extraChaosChoices || 0)
    if (token == null && !extraChaosUsed && extraChoices > 0) {
      extraChaosUsed = true
      const pool = Array.from({ length: 1 + extraChoices }, () => drawChaosToken(state))
      const chosen = requestChoice(state, { kind: 'token', source: state.skillTest?.extraChaosSource || options.extraChaosSource || null, seat,
        prompt: `额外揭示了 ${pool.length} 个混乱标记，选择 1 个结算。`,
        options: pool.map((face, index) => ({ id: String(index), label: tokenLabel(face) })) })
      for (let index = 0; index < pool.length; index++) {
        if (index !== Number(chosen)) returnChaosToken(state, pool[index])
      }
      token = pool[Number(chosen)]
      info(state, events, `${inv.name} 结算额外混乱标记 ${tokenLabel(token)}，其余标记归还。`)
    }
    // Phase 5（5a-10）：「花 1 充能改揭示 2 枚标记」由条目级 chaosTokenExtraReveal 声明。
    const statue = token == null && inv.assets.find(asset => registeredEntry(asset.code)?.chaosTokenExtraReveal && (asset.uses || 0) > 0)
    if (statue) {
      const answer = requestChoice(state, { kind: 'reaction', source: statue.id, seat, canSkip: true, prompt: '是否花费 1 充能，改为揭示 2 个混乱标记并选择 1 个？', options: [{ id: 'skip', label: '不花费充能' }, { id: 'trigger', label: '花费 1 充能' }] })
      if (answer === 'trigger') {
        statue.uses -= 1
        const first = drawChaosToken(state)
        const second = state.chaosBag.length ? drawChaosToken(state) : null
        const chosen = requestChoice(state, { kind: 'token', source: statue.id, seat, prompt: '选择要结算的混乱标记。', options: [{ id: '0', label: tokenLabel(first) }, ...(second == null ? [] : [{ id: '1', label: tokenLabel(second) }])] })
        token = chosen === '0' ? first : second
        info(state, events, inv.name + ' 使用「诡秘石像」：揭示 ' + tokenLabel(first) + ' 与 ' + tokenLabel(second) + '，选择 ' + tokenLabel(token) + '。')
        if ((statue.uses || 0) <= 0) {
          leaveAsset(state, inv, statue)
          inv.discard.push(statue.code)
          info(state, events, '「诡秘石像」充能耗尽，弃掉。')
        }
      }
    }
    // 失落时代：揭示前的替代与额外揭示（危险预感 / 奥利芙 / 黑暗预言）。
    if (token == null) {
      const plan = campaignBeforeChaosReveal(state, seat, inv, events)
      if (plan?.token) token = plan.token
      else if (plan?.count > 1) {
        const pool = Array.from({ length: plan.count }, () => drawChaosToken(state))
        const keep = Math.max(1, Math.min(pool.length, plan.choose || 1))
        const options = plan.symbolOnly
          ? pool.map((face, index) => ({ face, index })).filter(item => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(item.face))
          : pool.map((face, index) => ({ face, index }))
        const usable = options.length ? options : pool.map((face, index) => ({ face, index }))
        const picked = []
        const remaining = [...usable]
        for (let pick = 0; pick < keep && remaining.length; pick++) {
          const answer = remaining.length === 1 ? '0' : requestChoice(state, {
            kind: 'token', source: plan.source || 'campaignReveal', seat,
            prompt: `${usable.length === pool.length ? `揭示 ${pool.length} 个混乱标记` : `揭示 ${pool.length} 个混乱标记，其中只有 ${usable.length} 个带有符号`}，选择第 ${pick + 1} 个要结算的标记。`,
            options: remaining.map((item, index) => ({ id: String(index), label: tokenLabel(item.face) })),
          })
          const chosen = remaining.splice(Number(answer) || 0, 1)[0]
          picked.push(chosen.index)
        }
        for (let index = 0; index < pool.length; index++) {
          if (!picked.includes(index)) returnChaosToken(state, pool[index])
        }
        token = pool[picked[0]]
        for (const extra of picked.slice(1)) pendingTokens.push(pool[extra])
        info(state, events, `${inv.name} 揭示了 ${pool.length} 个混乱标记（${pool.map(face => tokenLabel(face)).join('、')}），结算 ${picked.map(index => tokenLabel(pool[index])).join('、')}。`)
      }
    }
    if (token == null) token = codexSealedElderSign(state, inv, seat, events)
    if (token == null) token = drawChaosToken(state)
    if (state.skillTest.rerollGuard) {
      const { sourceId } = state.skillTest.rerollGuard
      delete state.skillTest.rerollGuard
      if (['curse', 'autofail'].includes(token)) {
        const owner = state.investigators.find(owner => owner.assets.some(card => card.id === sourceId))
        const source = owner?.assets.find(card => card.id === sourceId)
        if (source) abilityApi(state, events).returnAssetToHand(owner.seat, source)
      }
    }
    while (state.skillTest.tokenRedraws > 0) {
      const selected = requestChoice(state, { kind: 'token', seat, source: 'tokenRedraws', prompt: `是否取消并归还 ${tokenLabel(token)}，再揭示一个标记？`,
        options: [{ id: 'skip', label: '保留标记' }, { id: 'redraw', label: '取消并重抽' }] })
      if (selected !== 'redraw') break
      state.skillTest.tokenRedraws--
      cancelledTokens.push(token)
      returnChaosToken(state, token)
      token = drawChaosToken(state)
    }
    if (investigatorRule(inv.code)?.chaosTokenRedraw && !wendyRedrawUsed && !investigatorTextBlanked(state, inv)) {
      const candidates = inv.hand.map((code, index) => ({ code, index }))
        .filter(item => !isWeaknessCode(item.code) && canDiscardFromHand(inv, item.code))
      if (candidates.length) {
        const answer = requestChoice(state, { kind: 'reaction', source: 'wendyRedraw', seat,
          prompt: `已揭示混乱标记 ${tokenLabel(token)}，是否弃掉 1 张非弱点手牌取消并归还该标记，然后重抽？`, canSkip: true,
          options: [{ id: 'skip', label: '保留该标记' }, { id: 'trigger', label: '弃牌并重抽（每次检定限一次）' }] })
        if (answer === 'trigger') {
          const index = requestChoice(state, { kind: 'discard-hand', source: 'wendyRedraw', seat,
            prompt: '选择弃掉的非弱点手牌。',
            options: candidates.map(item => ({ id: String(item.index), label: cardName(item.code) })) })
          const code = inv.hand.splice(Number(index), 1)[0]
          discardPlayerCards(state, inv, code)
          afterHandDiscard(state, inv, code, events, reactionWindow, cardName)
          wendyRedrawUsed = true
          cancelledTokens.push(token)
          info(state, events, `${inv.name} 弃掉「${cardName(code)}」，取消并归还混乱标记 ${tokenLabel(token)}，重新抽取。`)
          returnChaosToken(state, token)
          token = drawChaosToken(state)
        }
      }
    }
    // Phase 5（5a-21）：幸运骰由条目级 rerollTokenCost 声明（花 N 资源重抽）。
    let luckyDice = inv.assets.find(asset => registeredEntry(asset.code)?.rerollTokenCost)
    let luckyGuard = 0
    // 卡面：只能对「非 auto_fail」的标记使用。
    while (luckyDice && token !== 'autofail' && availableResources(inv) >= 2 && luckyGuard++ < 20) {
      const answer = requestChoice(state, { kind: 'reaction', source: luckyDice.id, seat, canSkip: true,
        prompt: `幸运骰：是否支付 2 资源，取消并归还 ${tokenLabel(token)}，然后重新揭示？`,
        options: [{ id: 'skip', label: '保留该标记' }, { id: 'trigger', label: '支付 2 资源并重抽' }] })
      if (answer !== 'trigger') break
      resourceBank.spendFromPool(inv, 2, state)
      cancelledTokens.push(token)
      returnChaosToken(state, token)
      token = drawChaosToken(state)
      info(state, events, `${inv.name} 使用「幸运骰」归还混乱标记并重新揭示 ${tokenLabel(token)}。`)
      if (token === 'autofail') {
        // 新标记为 auto_fail：把幸运骰子移出游戏（不是弃置）。
        luckyDice.removedFromGame = true
        state.removedFromGame ||= []
        if (!state.removedFromGame.includes(luckyDice.code)) state.removedFromGame.push(luckyDice.code)
        leaveAsset(state, inv, luckyDice, events)
        info(state, events, `「幸运骰」重新揭示自动失败，从游戏中移除。`)
        luckyDice = null
      }
    }
    state.skillTest.stage = 'ST.4'
    const frameStart = state.chaos.frames.at(-1) ?? 0
    const tokenIndex = state.chaos.revealed.findIndex((face, index) => index >= frameStart && face === token && !processedPhysicalTokens.has(index))
    // 「逆反」：忽略本次检定所有符号标记的效果（含修正值）。
    const ignoreSymbolEffects = commitments.some(item => commitProfile(item.code)?.ignoreSymbolEffects)
    token = ignoreSymbolEffects ? token
      : scenarioBehavior(state).chaosTokenRevealed?.(state, inv, token, scenarioRuntime(state, events)) || token
    // 马泰奥神父：任何调查员揭示 autofail 时，改为 elder_sign（每局一次）。
    if (token === 'autofail') {
      const mateo = aliveInvestigators(state).find(owner =>
        investigatorRule(owner.code)?.autofailToElderSign && !owner.mateoSignUsed
        && !investigatorTextBlanked(state, owner))
      if (mateo) {
        const answer = requestChoice(state, { kind: 'reaction', source: mateo.code, seat: mateo.seat, canSkip: true,
          prompt: `揭示了 ${tokenLabel(token)}，是否取消它并改为 ${tokenLabel('eldersign')}（每局一次）？`,
          options: [{ id: 'skip', label: '保留自动失败' }, { id: 'trigger', label: '改为旧印' }] })
        if (answer === 'trigger') {
          mateo.mateoSignUsed = true
          returnChaosToken(state, token)
          token = 'eldersign'
          info(state, events, `✨ ${mateo.name} 取消了自动失败标记，改为结算 ${tokenLabel('eldersign')}（本局一次已用）。`)
        }
      }
    }
    // Cancellation/replacement happens before the revealed token's effects.
    // Resolve a symbol only once: its result is also the preview used by cards
    // whose timing depends on the resulting skill value.
    const effectContext = { when: 'tokenEffectWouldResolve', seat, location: inv.location, token,
      ...(['bless', 'curse'].includes(token) ? { tokenIndex } : {}),
      prompt: `是否替换 ${tokenLabel(token)} 的效果？` }
    reactionWindow(state, 'tokenEffectWouldResolve', effectContext, events)
    collectForcedCommitments()
    if (effectContext.rerollToken) { cancelledTokens.push(token); continue }
    let tokenEffectOverride = effectContext.replacementEffect || null
    let revealedResolution = null
    const tokenInterrupt = aliveInvestigators(state).some(owner => descriptorSources(state, owner).some(row =>
      row.entry?.abilities?.some(descriptor => descriptor.trigger?.includes('tokenReveal'))))
    if (tokenInterrupt) {
      const symbol = ['skull', 'cultist', 'tablet', 'elderthing'].includes(token)
      if (symbol && !ignoreSymbolEffects && !tokenEffectOverride) revealedResolution = resolveSpecialToken(state, seat, inv, token, events)
      let previewDelta = tokenEffectOverride ? tokenEffectOverride.delta : /^[+-]?\d+$/.test(token) ? Number(token)
        : symbol ? (ignoreSymbolEffects ? 0 : investigatorRule(inv.code)?.tokenModifiers?.[token] ?? revealedResolution.delta)
          : token === 'bless' ? 2 : token === 'curse' ? -2 : 0
      if (options.doubleNegative && previewDelta < 0) previewDelta *= 2
      const previewFail = token === 'autofail' || revealedResolution?.autoFail === true
      const context = { when: 'tokenReveal', seat, location: inv.location, token,
        ...(['bless', 'curse'].includes(token) ? { tokenIndex } : {}),
        tokenDelta: previewDelta, autoFail: previewFail,
        testValue: previewFail ? 0 : Math.max(0, value + delta + previewDelta),
        prompt: `揭示混乱标记 ${tokenLabel(token)}` }
      reactionWindow(state, 'tokenReveal', context, events)
      if (context.replacementToken && context.replacementToken !== token) {
        cancelledTokens.push(token)
        returnChaosToken(state, token)
        token = context.replacementToken
        revealedResolution = null
        tokenEffectOverride = null
      }
    }
    if (aliveInvestigators(state).some(owner => descriptorSources(state, owner).some(row =>
      row.entry?.abilities?.some(descriptor => descriptor.trigger?.includes('chaosTokenRevealed'))))) {
      reactionWindow(state, 'chaosTokenRevealed', { when: 'chaosTokenRevealed', seat, location: inv.location, token, tokenIndex }, events, { allowNested: true })
    }
    const physicalIndex = tokenIndex
    if (physicalIndex >= 0) processedPhysicalTokens.add(physicalIndex)
    const physicalTreatment = state.skillTest.tokenTreatments?.[physicalIndex]
    if (physicalTreatment) {
      physicalTreatment.resolved = true
      const treatment = tokenEffect(state, token, physicalIndex)
      if (treatment.cancelled) {
        cancelledTokens.push(token)
        if (physicalTreatment.toPool) { state.chaos.revealed.splice(physicalIndex, 1); delete state.skillTest.tokenTreatments[physicalIndex] }
        continue
      }
      if (treatment.face !== token) {
        token = treatment.face
        revealedResolution = null
      }
    }
    drawn.push(token)
    // 07185 伏兵出水：攻击淹没地点的敌人时，揭示标记后立刻再揭示一个（每次检定最多一次）。
    if (!extraFloodedAttackTokenUsed && floodedAttackExtraTokenRule(state, options)) {
      extraFloodedAttackTokenUsed = true
      const extra = drawChaosToken(state)
      pendingTokens.unshift(extra)
      info(state, events, `🌊 「伏兵出水」：攻击淹没地点的敌人，额外揭示 1 个混乱标记（${tokenLabel(extra)}）。`)
    }
    options.onToken?.(token, { index: tokenIndex, state, seat })
    const rewards = state.skillTest.tokenRewards
    if (rewards) {
      const source = inv.assets.find(card => card.id === rewards.sourceId)
      if (token === 'bless' && !rewards.ready) { rewards.ready = true; if (source) abilityApi(state, events).readyAsset(source) }
      if (token === 'curse' && !rewards.action) {
        rewards.action = true
        if (requestChoice(state, { kind: 'effect', seat, source: rewards.sourceId, prompt: '是否获得本回合的一个额外行动？',
          options: [{ id: 'skip', label: '不获得' }, { id: 'action', label: '获得额外行动' }] }) === 'action') abilityApi(state, events).gainAction(seat, 1)
      }
    }
    state.skillTest.currentToken = token
    state.skillTest.cancelledSymbol = null
    // 「没有剩余神智值的调查员攻击或躲避哈斯塔时，把 +1/0/-1/旧印视为自动失败」（03334）。
    const sourceEnemy = options.source?.enemyId != null
      ? state.enemies.find(enemy => enemy.id === options.source.enemyId) : null
    if (sourceEnemy && !enemyTextBlanked(state, sourceEnemy)
      && enemyRuleFlags(sourceEnemy.code).noSanityAutoFailTokens === true
      && ['攻击', '躲避'].includes(options.source?.label)
      && getMaxSanity(inv) - (inv.horror || 0) <= 0
      && ['eldersign', '+1', '0', '-1'].includes(token)) {
      info(state, events, `☠️ ${inv.name} 没有剩余神智：${tokenLabel(token)} 被视作${tokenLabel('autofail')}。`)
      autoFail = true
      break
    }
    // 「追忆未来」：揭示了指定的混乱标记时横置支援并 +2。
    const named = state.skillTest.namedToken
    if (named && named.token === token) {
      const recall = inv.assets.find(asset => asset.id === named.assetId)
      if (recall) {
        recall.exhausted = true
        value += 2
        info(state, events, `「${cardName(recall.code)}」命中了指定的 ${tokenLabel(token)}，本次检定 +2。`)
      }
      delete state.skillTest.namedToken
    }
    // 「反击法术」：在符号标记结算前取消它（不揭示替代标记）。
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token) && !ignoreSymbolEffects) {
      reactionWindow(state, 'symbolRevealed', { when: 'symbolRevealed', seat, location: inv.location, token,
        sourceCard: state.skillTest?.source?.code ?? null,
        prompt: `${inv.name} 的检定揭示了 ${tokenLabel(token)}` }, events)
      // 2026-10-25 第七轮修复 05158：符号窗口里重定向调查目标后，难度以 skillTest.difficulty 为准。
      if (Number.isFinite(state.skillTest.difficulty)) difficulty = state.skillTest.difficulty
    }
    if (state.skillTest.cancelledSymbol === token) {
      info(state, events, `「${cardName(state.skillTest.cancelledSymbolSource)}」取消了 ${tokenLabel(token)}。`)
      lastTokenDelta = 0
      break
    }
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token) && !ignoreSymbolEffects) {
      const symbolContext = { seat, token, location: inv.location, testBonus: 0 }
      // 2026-11-13 修复「第六感等符号反应被连问多次」：上面第 1024 行的 reactionWindow 已经打开过
      // symbolRevealed 的能力窗口（声明式反应/强制都走它）；这里只补旧式 reactions（02029/02269 等）
      // 与 testBonus。不传 skipAbilityWindow 时，triggerReaction 的尾部会再调 openAbilityWindow，
      // 且本循环按「同地点每位调查员」各调一次 → 同一张 05158/05157 会被连问 N+1 次
      //（N = 与检定者同地点的调查员数；跳过第一次询问时 limit 不记账，所以每次都会重新问）。
      // 与 enemies.js enemySpawn / defeatEnemy、combat.js evadeSuccess 的既有口径一致。
      for (const owner of aliveInvestigators(state).filter(owner => owner.location === inv.location))
        triggerReaction(state, owner.seat, 'symbolRevealed', events, symbolContext, { skipAbilityWindow: true })
      value += symbolContext.testBonus || 0
    }
    if (token === defiedToken) {
      info(state, events, `「${cardName(defied.code)}」忽略了 ${tokenLabel(token)} 的修正值与效果。`)
      lastTokenDelta = 0
      break
    }
    if (tokenEffectOverride) {
      const fx = tokenEffectOverride
      const source = state.investigators.flatMap(owner => owner.assets).find(asset => asset.id === fx.assetId)
      if (source) {
        const api = abilityApi(state, events)
        if (fx.damage || fx.horror) api.placeAssetHarm(source, { damage: fx.damage || 0, horror: fx.horror || 0 })
        if (fx.healAll) api.healAsset(source, { damage: source.damage || 0, horror: source.horror || 0 })
      }
      replacedEffectTokens.push(drawn.length - 1)
      lastTokenDelta = options.doubleNegative && fx.delta < 0 ? fx.delta * 2 : fx.delta
      delta += lastTokenDelta
      if (pendingTokens.length) continue
      break
    }
    if (token === 'skull') for (const owner of aliveInvestigators(state)) triggerReaction(state, owner.seat, 'skullRevealed', events, { seat, token })
    if (token === 'autofail') {
      autoFail = true
      const stone = inv.assets.find(asset => registeredEntry(asset.code)?.returnToHandOnAutoFail)
      if (stone) {
        leaveAsset(state, inv, stone, events)
        putInHand(state, inv, stone.code)
        info(state, events, `「${cardName(stone.code)}」在揭示自动失败后返回手牌。`)
      }
      break
    }
    if (token === 'bless' || token === 'curse') {
      const treatment = tokenEffect(state, token, physicalIndex)
      const skillModifier = state.skillTest.committed.map(item => commitProfile(item.code)?.tokenModifiers?.[token]).find(Number.isFinite)
      const modifier = skillModifier ?? treatment.modifier
      delta += modifier
      state.skillTest.tokenResults ||= []
      state.skillTest.tokenResults.push({ index: physicalIndex, face: token, modifier })
      reactionWindow(state, 'chaosTokenResolved', { when: 'chaosTokenResolved', seat, location: inv.location,
        token, tokenIndex: physicalIndex, modifier: treatment.modifier }, events)
      elderAutoSuccess ||= treatment.autoSuccess
      if (tokenEffect(state, token, physicalIndex).drawAnother) continue
      if (pendingTokens.length) continue
      break
    }
    if (token === 'frost') {
      // EotE：寒霜默认 -1；地点/卡牌可用 setTokenTreatment({ modifier })（含 -3 与「视为 frost」）
      // 覆盖本次修正；同一检定第 2 枚 frost 立即自动失败（不再追加揭示）。
      const frostTreatment = tokenEffect(state, token, physicalIndex)
      delta += frostTreatment.modifier
      if (drawn.filter(t => t === 'frost').length > 1) { autoFail = true; break }
      continue
    }
    if (token === 'eldersign') {
      elderSign = true
      if (necronomiconInPlay) { autoFail = true; info(state, null, `☠️ 死灵之书使 ${inv.name} 的 elder_sign 变为自动失败！`) }
      else {
        const es = elderSignEffect(state, inv, events)
        if (es.autoFail) autoFail = true
        if (es.draw) drawCards(state, inv, es.draw, events)
        if (es.asSkull) {
          const res = resolveSpecialToken(state, seat, inv, 'skull', events)
          for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
          pendingOnFail.push(...res.onFail)
          drawn[drawn.length - 1] = 'skull'
        }
        delta += es.delta
        lastTokenDelta = es.delta
        elderAutoSuccess = !!es.autoSuccess
        elderOnSuccess = es.onSuccess || null
        elderOnSuccessAlways = !!es.onSuccessAlways
        elderReturnCommittedSkill = !!es.returnCommittedSkill
        elderMayMoveAfterTest = !!es.mayMoveAfterTest
        elderMayMoveAfterTestAlways = !!es.mayMoveAfterTestAlways
        elderClueOnSuccessBy = es.clueOnSuccessBy || 0
        elderChosenReward = !!es.chosenReward
        elderShuffleDiscardAfterTest = es.shuffleDiscardAfterTest || null
        // 黛西的「如果你检定成功」要等成败判定后结算，不能在这里提前抽牌。
        elderOptionalDraw = Number(es.optionalDraw) || 0
        if (elderAutoSuccess) info(state, null, `✨ ${inv.name} 的 elder_sign 效果触发自动成功！`)
      }
      break
    }
    if (/^[+-]?\d+$/.test(token)) {
      let numeric = Number(token)
      if (numeric < 0) {
        const context = { when: 'negativeTokenRevealed', seat, location: inv.location, token, testValue: value + numeric, prompt: '揭示了带有负值修正的混乱标记' }
        reactionWindow(state, 'negativeTokenRevealed', context, events)
        if (context.flipTokenSign) numeric = -numeric
      }
      if (options.doubleNegative && numeric < 0) numeric *= 2
      delta += numeric
      lastTokenDelta = numeric
      if (pendingTokens.length) continue
      break
    }
    const res = ignoreSymbolEffects && ['skull', 'cultist', 'tablet', 'elderthing'].includes(token)
      ? { delta: 0, onDraw: [], onFail: [] }
      : revealedResolution || resolveSpecialToken(state, seat, inv, token, events)
    if (res.autoFail) autoFail = true
    if (res.cancelCommitted && !committedCancelled) {
      const cancelled = commitments.filter(item => cardDef(item.code)?.type === 'skill')
      value -= cancelled.reduce((sum, item) => sum + commitIcons(state, state.investigators[item.seat], item.code, skillList), 0)
      for (const item of cancelled) { item.cancelled=true; commitments.splice(commitments.indexOf(item), 1) }
      state.skillTest.cancelledCommitments = cancelled.map(item => ({ ...item }))
      committedCancelled = true
    }
    let tokenDelta = !investigatorTextBlanked(state, inv) && investigatorRule(inv.code)?.tokenModifiers?.[token] != null
      ? investigatorRule(inv.code).tokenModifiers[token] : res.delta
    if (tokenDelta < 0) {
      const context = { when: 'negativeTokenRevealed', seat, location: inv.location, token, testValue: value + delta, prompt: '揭示了带有负值修正的混乱标记' }
      reactionWindow(state, 'negativeTokenRevealed', context, events)
      if (context.flipTokenSign) tokenDelta = -tokenDelta
    }
    lastTokenDelta = options.doubleNegative && tokenDelta < 0 ? tokenDelta * 2 : tokenDelta
    delta += lastTokenDelta
    for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
    for (const fx of res.onFail) pendingOnFail.push(fx)
    if (res.drawAnother) continue
    if (pendingTokens.length) continue
    break
  }

  // P6 原语（08112「额外揭示一枚混乱标记，把其负修正取反并计入本次检定」）：
  // `api.playerTools.revealAdditionalTestToken({ flipSign, autoFailOn })` 在揭示循环期间登记，
  // 这里在结算总修正前追加揭示（仍属于本次检定的物理揭示区，endChaosTest 正常归还）。
  if (state.skillTest?.pendingExtraReveals?.length) {
    const plans = state.skillTest.pendingExtraReveals
    state.skillTest.pendingExtraReveals = []
    for (const plan of plans) {
      const extra = drawChaosToken(state)
      drawn.push(extra)
      let extraDelta = 0
      let extraAutoFail = false
      if (/^[+-]?\d+$/.test(extra)) {
        const numeric = Number(extra)
        extraDelta = plan.flipSign ? (numeric < 0 ? -numeric : numeric) : numeric
      } else if (['skull', 'cultist', 'tablet', 'elderthing'].includes(extra)) {
        if (plan.flipSign) {
          // 取反口径只针对数值修正；符号标记无法取反，按卡面「若为骷髅则自动失败」处理。
          if ((plan.autoFailOn || []).includes(extra)) extraAutoFail = true
        } else if (!ignoreSymbolEffects) {
          const res = resolveSpecialToken(state, seat, inv, extra, events)
          extraDelta = investigatorRule(inv.code)?.tokenModifiers?.[extra] ?? res.delta
          if (res.autoFail) extraAutoFail = true
          for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
          for (const fx of res.onFail) pendingOnFail.push(fx)
        }
      } else if (extra === 'autofail') {
        extraAutoFail = true
      }
      if (((plan.autoFailOn || []).includes(extra)) || extraAutoFail) {
        autoFail = true
        info(state, events, `🎲 额外揭示了 ${tokenLabel(extra)}：本次检定自动失败。`)
        break
      }
      delta += extraDelta
      state.skillTest.tokenResults ||= []
      state.skillTest.tokenResults.push({ index: state.chaos.revealed.length - 1, face: extra, modifier: extraDelta })
      info(state, events, `🎲 额外揭示 ${tokenLabel(extra)}（修正 ${extraDelta >= 0 ? '+' : ''}${extraDelta}）。`)
    }
  }

  if (state.skillTest.tokenResults?.length || (state.chaos.revealed.length > (state.chaos.frames.at(-1) || 0)
    && aliveInvestigators(state).some(owner => descriptorSources(state, owner).some(row =>
      row.entry?.abilities?.some(descriptor => descriptor.trigger?.includes('chaosRevealStepEnded')))))) {
    reactionWindow(state, 'chaosRevealStepEnded', { when: 'chaosRevealStepEnded', seat, location: inv.location,
      tokens: state.chaos.revealed.map((face, index) => ({ index, face })) }, events)
    for (const result of state.skillTest.tokenResults || []) {
      const treatment = tokenEffect(state, result.face, result.index)
      const skillModifier = state.skillTest.committed.map(item => commitProfile(item.code)?.tokenModifiers?.[treatment.face]).find(Number.isFinite)
      delta += (treatment.cancelled ? 0 : skillModifier ?? treatment.modifier) - result.modifier
      elderAutoSuccess ||= treatment.autoSuccess
    }
    delta -= state.skillTest.ignoredTokenModifiers || 0
  }
  // 揭示步骤结束后重读「自动成功」：07120 矛盾圣约在 `chaosRevealStepEnded` 窗口里调用
  // api.setTestAutoSuccess()，而该窗口在揭示循环之后才结算。修复前成功判定只读揭示前取下的
  // 局部变量 elderAutoSuccess，窗口写入的 state.skillTest.autoSuccess 再无人读取（审计 H10）。
  if (state.skillTest?.autoSuccess === true) elderAutoSuccess = true
  state.skillTest.stage = 'ST.5'
  if (state.skillTest.retargetDifficulty) difficulty = state.skillTest.difficulty
  // 「本次攻击期间揭示了 X 则自动失败」（04273 陈旧猎枪的卡膛）：在成算之前把检定改为自动失败。
  // 与 autofail 标记同一条失败路径，因此不会产生伤害、不会被「成功」类反应误读。
  if (Array.isArray(options.autoFailOnTokens)
    && options.autoFailOnTokens.some(token => drawn.includes(token))) {
    autoFail = true
  }
  const ignoredScenarioSymbols = commitments.some(item => commitProfile(item.code)?.ignoreSymbolEffects)
  if (scenarioBehavior(state).testAutoFail?.(state, inv, { drawn: [...drawn],
    resolvedTokens: drawn.filter((token,index)=>!replacedEffectTokens.includes(index)), ignoredSymbols: ignoredScenarioSymbols, test: { actionKind: scenarioTestFrame.actionKind, target: scenarioTestFrame.target, failedBy: Math.max(0, scenarioTestFrame.difficulty - scenarioTestFrame.value) } }) === true) autoFail = true
  // Cards forced into the test by a token or another committed card use the
  // same local value and reward ledger as ordinary commitments.
  collectForcedCommitments()
  if (typeof options.skillBonus === 'function') value += options.skillBonus() - initialBonus
  const rexCurse = inv.threat.find(item => registeredEntry(item.code)?.rerollRevealedTokenOnSuccess)
  if (rexCurse && !autoFail && (elderAutoSuccess || value + delta >= difficulty) && drawn.length) {
    const oldToken = drawn.pop()
    returnChaosToken(state, state.chaos.revealed.includes(oldToken) ? oldToken : state.chaos.revealed.at(-1))
    delta -= lastTokenDelta
    elderAutoSuccess = false
    elderOnSuccess = null
    elderOnSuccessAlways = false
    elderSign = false
    const replacement = drawChaosToken(state)
    drawn.push(replacement)
    if (replacement === 'skull') for (const owner of aliveInvestigators(state)) triggerReaction(state, owner.seat, 'skullRevealed', events, { seat, token: replacement })
    if (replacement === 'autofail') autoFail = true
    else if (replacement === 'eldersign') {
      elderSign = true
      const es = elderSignEffect(state, inv, events)
      delta += es.delta
      elderAutoSuccess = !!es.autoSuccess
      elderReturnCommittedSkill = !!es.returnCommittedSkill
      elderMayMoveAfterTest = !!es.mayMoveAfterTest
      elderMayMoveAfterTestAlways = !!es.mayMoveAfterTestAlways
      elderClueOnSuccessBy = es.clueOnSuccessBy || 0
      elderOnSuccess = es.onSuccess || null
      elderOnSuccessAlways = !!es.onSuccessAlways
      elderChosenReward = !!es.chosenReward
      elderShuffleDiscardAfterTest = es.shuffleDiscardAfterTest || null
      if (es.autoFail) autoFail = true
    } else if (/^[+-]?\d+$/.test(replacement)) delta += Number(replacement)
    else {
      const res = resolveSpecialToken(state, seat, inv, replacement, events)
      delta += investigatorRule(inv.code)?.tokenModifiers?.[replacement] ?? res.delta
      autoFail ||= !!res.autoFail
      for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
      pendingOnFail.push(...res.onFail)
    }
    if (autoFail || (!elderAutoSuccess && value + delta < difficulty)) {
      removeOne(inv.threat, rexCurse)
      // Phase 5（5a-9）：卡号来自正在结算的那张威胁卡本身。
      inv.deck = replacePlayerZoneCards(state, inv, shuffle([...inv.deck, rexCurse.code], () => randomValue(state)), 'shuffle')
      info(state, events, `「雷克斯的诅咒」令检定失败，洗回 ${inv.name} 的牌库。`)
    } else info(state, events, `「雷克斯的诅咒」归还 ${tokenLabel(oldToken)} 并揭示 ${tokenLabel(replacement)}；检定仍然成功。`)
  }
  value += modifierTotal(state, inv, 'testValue') - continuousTestValue
  state.skillTest.value = autoFail ? 0 : Math.max(0, value + delta)
  if (autoFail) {
    state.skillTest.stage = 'ST.6'
    failureEffects(() => { for (const fx of pendingOnFail.filter(fx=>fx.type!=='drawEnemyTrait')) applyTokenFx(state, failureRecipientSeat, effectRecipient(state, inv), fx, events) })
    const failContext = { skill: skillContext, difficulty, failedBy: Math.max(0, difficulty),
      committed: commitments.map(item => ({ ...item })) }
    triggerReaction(state, seat, 'skillTestFail', events, failContext)
    // 04159 反复尝试等「投入了技能牌的其他调查员」也会获得自己的 skillTestFail 窗口。
    for (const otherSeat of [...new Set(commitments.map(item => item.seat))]) {
      if (otherSeat !== seat) triggerReaction(state, otherSeat, 'skillTestFail', events, failContext)
    }
    const result = { success: false, value: 0, difficulty, skill: skillContext, token: 'autofail', committed, autoFail: true, drawn, cancelledTokens, source: options.source || null, damageBonus: 0, clueBonus: 0 }
    state.skillTest.stage = 'ST.7'
    resolveResult(result)
    failureEffects(() => {
      scenarioBehavior(state).afterTest?.(state, effectRecipient(state, inv), result, scenarioRuntime(state, events), { resolvedTokens: drawn.filter((token,index)=>!replacedEffectTokens.includes(index)), ignoredSymbols: ignoredScenarioSymbols, test: { actionKind: scenarioTestFrame.actionKind, target: scenarioTestFrame.target, failedBy: Math.max(0, scenarioTestFrame.difficulty - scenarioTestFrame.value) } })
      runLocationTestFail(state, inv, result, events)
    })
    campaignFailedTestWindow(state, seat, { skill: skillContext, difficulty, baseValue: statReference, source: options.source,
      peril: options.peril, resolve: options.resolve, failedBy: difficulty }, events, summarizeTestResult(null, { ...result, seat, skill: skillContext }))
    return result
  }
  value += delta
  // Phase 5（5a-21）：「天赐良机」这类「投入后可以流放换自动成功」由条目级 exileForAutoSuccess 声明。
  const strokeOfLuck = commitments.find(item => item.seat === seat && registeredEntry(item.code)?.exileForAutoSuccess)
  if (!autoFail && strokeOfLuck) {
    const answer = requestChoice(state, { kind: 'reaction', source: strokeOfLuck.code, seat, canSkip: true,
      prompt: '是否流放「' + cardName(strokeOfLuck.code) + '」，使本次检定自动成功？',
      options: [{ id: 'skip', label: '保留卡牌，正常结算' }, { id: 'exile', label: '流放并自动成功' }] })
    if (answer === 'exile') { strokeOfLuckExiled = true; exilableCode = strokeOfLuck.code; elderAutoSuccess = true }
  }
  if (!elderAutoSuccess && value < difficulty) {
    // Phase 2（B3）：窗口上下文带上标准化的当前结果（ctx.result），
    // 内容层不需要再从 testValue/difficulty 自己算差额。
    const context = { when: 'testWouldFail', seat, location: inv.location, skill: skillContext, difficulty, testValue: value,
      testBonus: 0, prompt: '技能检定将要失败', result: pendingTestResult(state.skillTest) }
    reactionWindow(state, 'testWouldFail', context, events)
    if (context.testBonus) {
      value += context.testBonus
      info(state, events, `⚡ 检定值 +${context.testBonus}（当前 ${value} vs ${difficulty}）。`)
    }
  }
  value = Math.max(0, value)
  if (!elderAutoSuccess && value >= difficulty) {
    const context = { when: 'wouldSucceedTest', seat, location: inv.location, skill: skillContext, difficulty, testValue: value,
      testBonus: 0, prompt: '技能检定将要成功', result: pendingTestResult(state.skillTest) }
    reactionWindow(state, 'wouldSucceedTest', context, events)
    if (context.testBonus) {
      value += context.testBonus
      info(state, events, `⚡ 检定值 +${context.testBonus}（当前 ${value} vs ${difficulty}）。`)
    }
  }
  state.skillTest.value = value
  state.skillTest.stage = 'ST.6'
  // 第 5 步 P6：（故事）调查员可以在检定期内直接降低本次难度（`api.reduceTestDifficulty`）。
  // 与「技能 +N」分开记：判定用扣减后的难度，展示与结果摘要也读同一份。
  if (state.skillTest.difficultyReduction) {
    difficulty = Math.max(0, difficulty - state.skillTest.difficultyReduction)
    state.skillTest.difficulty = difficulty
  }
  // 2026-10-25 第六轮修复 05119：「投入卡后」窗口追加的图标进入最终检定值。
  if (state.skillTest.extraCommittedIcons) {
    value += state.skillTest.extraCommittedIcons
    state.skillTest.value = value
  }
  // 2026-10-25 第四轮修复 failTies（05041 第十三幻象）：检定值恰好等于难度时按失败结算。
  // 除本次检定的 options.failTies 外，同地点威胁区里声明 failTies 的光环条目也生效。
  const failTiesAura = state.investigators.some(owner => owner.location === inv.location
    && (owner.threat || []).some(card => registeredEntry(card.code)?.failTies === true))
  const failTies = (options.failTies === true || failTiesAura) && !elderAutoSuccess
  const success = elderAutoSuccess || (value > difficulty || (value === difficulty && !failTies))
  if (success) for (const spec of state.skillTest.successPoolTokens || []) addPoolTokens(state, spec.token, spec.count)
  // 任意技能检定成功的统一反应窗口（04107 幸运烟盒等）。
  if (success) triggerReaction(state, seat, 'skillTestSuccess', events,
    { skill: skillContext, successBy: value - difficulty, difficulty, value })
  // 「埃兹特里之牙」：结算诡计卡上的能力时检定成功后可以横置抽牌。
  if (success && state._treacheryResolving) {
    triggerReaction(state, seat, 'treacheryTestSuccess', events, { location: inv.location, skill: skillContext, cardCode: state._treacheryResolving })
  }
  if (!success) {
    failureEffects(() => { for (const fx of pendingOnFail.filter(fx=>fx.type!=='drawEnemyTrait')) applyTokenFx(state, failureRecipientSeat, effectRecipient(state, inv), fx, events) })
  }

  const skillFx = { damageBonus: 0, clueBonus: 0, evadeDisengage: false, mayMoveAfterEvade: false, homeFrontDamage: 0 }
  for (let pass = 0; pass < (doubleOrNothing && success ? 2 : 1); pass++) {
    for (const commitment of commitments) {
      const result = applySkillOnSuccess(state, state.investigators[commitment.seat], [commitment.code], success, value - difficulty, events)
      // 04153 参透真谛：任意冒险能力检定成功后由投入者发现 1 个线索。
      if (success && result.discoverClue) {
        discoverClueAt(state, state.investigators[commitment.seat], result.discoverClue, events)
      }
      skillFx.damageBonus += result.damageBonus
      skillFx.clueBonus += result.clueBonus
      skillFx.evadeDisengage ||= result.evadeDisengage
      skillFx.mayMoveAfterEvade ||= result.mayMoveAfterEvade
      skillFx.homeFrontDamage += result.homeFrontDamage
    if (result.homeFrontCode) skillFx.homeFrontCode = result.homeFrontCode
    }
  }
  if (elderOnSuccess && (success || elderOnSuccessAlways)) {
    resolveEffect(state, seat, elderOnSuccess, makeRuntime(state, []))
  }
  // 黛西·沃克：旧印 +0，如果本次检定成功，每控制一个[[书籍]]抽取 1 张（可选）。
  if (success && elderOptionalDraw > 0) {
    const answer = requestChoice(state, { kind: 'reaction', source: 'daisyElderSign', seat, canSkip: true,
      prompt: `旧印：是否为控制的书籍抽取 ${elderOptionalDraw} 张牌？`,
      options: [{ id: 'skip', label: '不抽牌' }, { id: 'trigger', label: `抽取 ${elderOptionalDraw} 张牌` }] })
    if (answer === 'trigger') {
      for (const text of drawCards(state, inv, elderOptionalDraw, events)) info(state, events, text)
    }
  }
  // 「挥金如土」等：检定成功后的额外结算。
  if (success && state.skillTest?.extraOnSuccess?.length) {
    const extras = state.skillTest.extraOnSuccess
    state.skillTest.extraOnSuccess = []
    for (const fx of extras) {
      if (fx.minimumSuccessBy != null && value - difficulty < fx.minimumSuccessBy) continue
      resolveEffect(state, seat, fx, makeRuntime(state, events))
    }
  }
  // P6 原语（08107 破冰锥）：「检定成功后（可选）弃掉来源支援，并让本次攻击 +N 伤害 /
  // 发现额外 N 个线索」。条目在检定中调用 api.playerTools.onTestSuccess 登记；
  // 这里先弃置来源（若声明），再并入本次结算：攻击加值走 result.damageBonus（combat.js
  // 的伤害公式读它），线索立即发现。失败/代价不符时不登记，登记项只在这里结算一次。
  if (success && state.skillTest?.customOnSuccess?.length) {
    const entries = state.skillTest.customOnSuccess
    state.skillTest.customOnSuccess = []
    for (const entry of entries) {
      if (!entry || (entry.seat != null && entry.seat !== seat)) continue
      const owner = state.investigators[entry.seat ?? seat]
      const source = owner?.assets.find(asset => asset.id === entry.sourceId)
      const sourcePresent = Boolean(source)
      if (entry.attackDamageBonus) skillFx.damageBonus += entry.attackDamageBonus
      if (entry.extraClue) discoverClueAt(state, owner || inv, entry.extraClue, events)
      if (entry.discardSelf && sourcePresent) {
        leaveAsset(state, owner, source)
        discardPlayerCards(state, owner, source.code)
        info(state, events, `🗑️ 检定成功：弃掉「${cardName(source.code)}」以获得本次结算的额外收益。`)
      }
    }
  }
  // 失落的时代旧印的后续结算（芬恩线索 / 厄休拉移动 / 马泰奥二选一）。
  if (success && elderClueOnSuccessBy && value - difficulty >= elderClueOnSuccessBy) {
    const answer = requestChoice(state, { kind: 'reaction', source: 'finnElderSign', seat, canSkip: true,
      prompt: '旧印：是否发现你所在地点的 1 个线索？',
      options: [{ id: 'skip', label: '不发现' }, { id: 'trigger', label: '发现 1 个线索' }] })
    if (answer === 'trigger') discoverClueAt(state, inv, 1, events)
  }
  if ((success || elderMayMoveAfterTestAlways) && elderMayMoveAfterTest) {
    const destinations = investigatorMoveDestinations(state, seat, {})
    if (destinations.length) {
      const answer = requestChoice(state, { kind: 'move', source: 'ursulaElderSign', seat, canSkip: true,
        prompt: '旧印：是否移动到连接地点？',
        options: [{ id: 'skip', label: '留在原地' },
          ...destinations.map(id => ({ id, label: locName(state, id) }))] })
      if (answer !== 'skip') relocateInvestigator(state, seat, answer, events)
    }
  }
  // P6（食梦者 · 派翠丝·海瑟薇旧印）：「本次检定结束后，你可以把弃牌堆中的 1 张卡牌留下，
  // 其余卡牌洗回你的牌库」。检定已经结算完，这里只是把「结束后」这件事接到既有旧印读点上。
  if (elderShuffleDiscardAfterTest) {
    const keep = Math.max(0, Number(elderShuffleDiscardAfterTest.keep ?? 1))
    const candidates = (inv.discard || []).slice()
    if (candidates.length > keep) {
      const answer = requestChoice(state, { kind: 'reaction', source: 'patriceElderSign', seat, canSkip: true,
        prompt: `旧印：是否把弃牌堆中 ${candidates.length - keep} 张卡牌洗回牌库（保留 ${keep} 张）？`,
        options: [{ id: 'skip', label: '不洗回' }, { id: 'trigger', label: '洗回牌库' }] })
      if (answer === 'trigger') {
        const shuffled = candidates.splice(0, candidates.length - keep)
        for (const code of shuffled) removeOne(inv.discard, code)
        inv.deck = replacePlayerZoneCards(state, inv, shuffle([...inv.deck, ...shuffled], () => randomValue(state)), 'shuffle')
        info(state, events, `🎻 ${inv.name} 把弃牌堆的 ${shuffled.length} 张卡牌洗回牌库（保留 ${keep} 张）。`)
      }
    }
  }
  if (elderChosenReward && success) {
    const options = [{ id: 'draw', label: '抽取 1 张牌并获得 1 资源' }]
    // 04004 马泰奥神父：「如果此时是你的回合」——只有调查阶段且轮到自己且回合未结束时
    // 才提供「额外 1 次行动」；神话/遭遇阶段即使 currentSeat 仍指向该座位也不提供。
    if (state.phase === 'investigation' && state.currentSeat === seat && !inv.turnEnded) {
      options.push({ id: 'action', label: '本回合额外 1 次行动' })
    }
    const answer = requestChoice(state, { kind: 'effect', source: 'mateoElderSign', seat,
      prompt: '旧印：选择一项结算。', options })
    if (answer === 'action') { inv.actionsLeft += 1; info(state, events, `${inv.name} 获得 1 次额外行动。`) }
    else {
      for (const line of drawCards(state, inv, 1, events)) info(state, events, line)
      resourceBank.gainResource(state, inv, 1, events)
      info(state, events, `${inv.name} 抽取 1 张牌并获得 1 资源。`)
    }
  }
  if (success && elderReturnCommittedSkill) {
    const candidates = state.skillTest.committed.filter(item => cardDef(item.code)?.type === 'skill')
    if (candidates.length) {
      const choice = requestChoice(state, { kind: 'reaction', source: 'minhElderSign', seat, canSkip: true,
        prompt: '旧印：可以将本次投入的一张技能牌返回其所有者手牌。',
        options: [{ id: 'skip', label: '不返回' },
          ...candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
            label: `${cardName(item.code)}（${state.investigators[item.seat].name}）` }))] })
      if (choice !== 'skip') {
        const chosen = candidates[Number(choice)]
        removeOne(state.skillTest.committed, chosen)
        putInHand(state, state.investigators[chosen.seat], chosen.code)
      }
    }
  }
  if (success) for (const minh of state.investigators.filter(owner => investigatorRule(owner.code)?.wildCommitCompanionBonus)) {
    const king = minh.threat.find(card => registeredEntry(card.code)?.kingInYellowThreat)
    const matchingIcons = commitments.filter(item => item.seat === minh.seat).reduce((sum, item) => sum + item.icons, 0)
    if (king && matchingIcons >= 6) {
      removeOne(minh.threat, king)
      minh.discard.push(king.code)
      info(state, events, `${minh.name} 投入了至少6个匹配图标，弃置「${cardName(king.code)}」。`)
    }
  }
  if (!success) {
    const failContext = { skill: skillContext, difficulty, failedBy: Math.max(0, difficulty - value),
      committed: commitments.map(item => ({ ...item })) }
    triggerReaction(state, seat, 'skillTestFail', events, failContext)
    // 04159 反复尝试：投入技能牌的其他调查员也获得自己的 skillTestFail 窗口。
    for (const otherSeat of [...new Set(commitments.map(item => item.seat))]) {
      if (otherSeat !== seat) triggerReaction(state, otherSeat, 'skillTestFail', events, failContext)
    }
  }
  // 技能牌失败奖励（如「重拾信念」）：奖励给执行检定的调查员，而不是投入者。
  const failRewardSeat = state.skillTest?.seat ?? seat
  if (!success) {
    for (const item of commitments) {
      const fail = commitProfile(item.code)?.onFail
      if (!fail) continue
      const owner = state.investigators[failRewardSeat]
      if (fail.draw) for (const line of drawCards(state, owner, fail.draw, events)) info(state, events, line)
      if (fail.resources) resourceBank.gainResource(state, owner, fail.resources, events)
      info(state, events, `${owner.name} 的「${cardName(item.code)}」检定失败奖励已结算。`)
    }
  }
  const result = { success, value, difficulty, skill: skillContext, token: drawn.at(-1), committed, autoFail, drawn, elderSign, cancelledTokens,
    rewardMultiplier: doubleOrNothing && success ? 2 : 1, source: options.source || null, ...skillFx,
    grantedEnemyKeywords: [...new Set(commitments.flatMap(item => commitProfile(item.code)?.grantEnemyKeywords || []))] }
  if (success && elderSign && !investigatorTextBlanked(state, inv)) result.damageBonus += investigatorRule(inv.code)?.elderSign?.attackDamageBonus || 0
  state.skillTest.stage = 'ST.7'
  resolveResult(result)
  const scenarioResult = replacedEffectTokens.length ? { ...result,
    drawn: result.drawn.filter((token, index) => !replacedEffectTokens.includes(index)) } : result
  const afterTest = () => {
    scenarioBehavior(state).afterTest?.(state, effectRecipient(state, inv), scenarioResult, scenarioRuntime(state, events), { resolvedTokens: drawn.filter((token,index)=>!replacedEffectTokens.includes(index)), ignoredSymbols: ignoredScenarioSymbols, test: { actionKind: scenarioTestFrame.actionKind, target: scenarioTestFrame.target, failedBy: Math.max(0, scenarioTestFrame.difficulty - scenarioTestFrame.value) } })
    runLocationTestFail(state, inv, result, events)
  }
  if (success) afterTest()
  else failureEffects(afterTest)
  if (success) {
    const successBy = value - difficulty
    for (const commitment of commitments) {
      const threshold = commitProfile(commitment.code)?.returnOnSuccessBy
      if (threshold != null && successBy >= threshold) {
        const owner = state.investigators[commitment.seat]
        const idx = owner.discard.lastIndexOf(commitment.code)
        if (idx >= 0) {
          owner.discard.splice(idx, 1)
          putInHand(state, owner, commitment.code)
          info(state, events, `${owner.name} 的「${cardName(commitment.code)}」因超过难度 ${threshold} 点返回手牌。`)
        }
      }
    }
  }
  // 「学无止境」：检定失败并结算完后重新尝试该检定。
  if (!success) {
    campaignFailedTestWindow(state, seat, { skill: skillContext, difficulty, baseValue: statReference, source: options.source,
      peril: options.peril, resolve: options.resolve, failedBy: Math.max(0, difficulty - value) }, events, summarizeTestResult(null, { ...result, seat, skill: skillContext }))
  }
  // 检定结束：本次检定内的效果到期（A1）。
  // 「下一次技能检定 +N」类效果（08013a「演武·战斗」、08053/08058「红色闹钟」等）只在
  // **其控制者自己**的检定结束时过期；别人检定结束时把它们留到对方的检定/回合结束。
  // 回合结束时仍由 turn-flow.js 的 expireEffects(state,'endOfTurn') 统一清理。
  const carriedOverEffects = []
  for (const effect of state.effects || []) {
    if (effect.duration !== 'endOfTest') continue
    if (!carriedEndOfTestEffects.has(effect.id)) continue
    if (effect.controllerSeat === seat) continue
    carriedOverEffects.push(effect)
  }
  if (carriedOverEffects.length) state.effects = state.effects.filter(effect => !carriedOverEffects.includes(effect))
  for (const effect of expireEffects(state, 'endOfTest')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（本次检定结束）。`)
  }
  // 留给他人的「下一次技能检定」效果放回效果表；顺序变化只影响这批跨检定效果，
  // 修正量求和与触发结算都不依赖效果表顺序。
  for (const effect of carriedOverEffects) state.effects.push(effect)
  return {
    success, value, difficulty,
    token: drawn[drawn.length - 1],
    committed, autoFail, drawn, elderSign, cancelledTokens,
    damageBonus: skillFx.damageBonus,
    clueBonus: skillFx.clueBonus,
    evadeDisengage: skillFx.evadeDisengage,
    mayMoveAfterEvade: skillFx.mayMoveAfterEvade,
    // 2026-10-25 本循环修复 attack-resolution-context：攻击/躲避等 resolve 回调可把结构化结果
    // （如 r.attackResult={defeated,...}）写在 result 上，供 api.fight 的返回值读取。
    ...(result.attackResult ? { attackResult: result.attackResult } : {}),
    // Phase 2（B3）：标准化结果（同步结算时直接可用；异步/多次选择的检定读 state.lastTestResult）。
    summary,
  }
}

  return performTest
}
