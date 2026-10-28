// 揭示与描述子执行（runActReveal / runAgendaForced / resolveTreacheryEffect /
// executeDescriptor）从 engine.js 拆出的模块（Phase 6 · 6d-26）。
//
// 「翻开的牌如何结算」的三条路：
//   runActReveal / runAgendaForced —— 幕与密谋翻开时的印刷效果（走剧本声明）
//   resolveTreacheryEffect        —— 遭遇诡计的印刷效果（含目标与检定）
//   executeDescriptor             —— 声明式能力的统一执行入口（描述子 → 效果/回调）
// 最后一个是能力层的核心读点之一：§4 里大量「读点在 executeDescriptor」的条目指的就是它。

export function createReveal(deps) {
  const {
    EFFECTS,
    LITA_CHANDLER_CODE,
    abilityApi,
    addDoom,
    aliveInvestigators,
    applyAbilityTarget,
    applyDamage,
    applyHorror,
    autoEngageAll,
    canSpendClues,
    cardDef,
    cardName,
    consumePlayThreatResources,
    descriptorCost,
    discardUntilEnemy,
    disengageEnemy,
    disposePlayedEvent,
    drawCards,
    drawEnemyByTrait,
    finishScenario,
    info,
    isWeaknessCode,
    leadDecisionSeat,
    leaveAsset,
    locName,
    makeRuntime,
    markLimitUsed,
    nearestEnemyByTrait,
    payAbilityCost,
    placeDoomOnCard,
    placeLocation,
    playCost,
    randomValue,
    registeredEntry,
    relocateEnemy,
    removeLocation,
    removeOne,
    requestChoice,
    resourceBank,
    resolveEffect,
    resolveTarget,
    revealLocation,
    ruleCodeForOriginal,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    spawnEnemy,
    spawnStoryAsset,
    spendAction,
    spendClues,
    stepToward,
    // 2026-10-25 第五轮修复 05004：直接写 context.cancelled 的取消也统一记账。
    noteCardCancelled,
    reactionWindow,
    // 取消记账的进程内帧（不写 state，避免改变存档/重放指纹）。
    beginCancelNoteFrame,
    cancelNoteFrameNoted,
  } = deps

function resolveTreacheryEffect(state, inv, fx, events) {
  switch (fx.kind) {
    case 'addDoom': {
      // 走统一入口：密谋毁灭的每次放置都要让剧本看到（04282/04283 的强制）。
      addDoom(state, fx.amount, events)
      break
    }
    case 'addFog': {
      state.fogMod = Math.max(state.fogMod, fx.amount || 2)
      info(state, events, `🌫️ 本回合调查难度 +${fx.amount || 2}。`)
      break
    }
    case 'attachShroud': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (loc && !loc.fog) {
        loc.shroudMod = (loc.shroudMod || 0) + fx.amount
        loc.fog = (loc.fog || 0) + 1
        loc.fogCode = loc.fogCode || fx.code
        info(state, events, `🌫️ 「${cardName(fx.code)}」附着于「${loc.name}」，帷幕 +${fx.amount}。`)
        return true
      }
      break
    }
    case 'chooseCluesOrDamage': {
      const options = [{ id: 'damage', label: `受到 ${fx.damage} 伤害` }]
      if (canSpendClues(state, inv) && inv.clues >= fx.clues) options.push({ id: 'clues', label: `支付 ${fx.clues} 个人线索` })
      const answer = requestChoice(state, { kind: 'treachery', source: fx.kind, seat: inv.seat, prompt: '选择诡计效果。', options })
      if (answer === 'clues') spendClues(state, inv, fx.clues)
      else applyDamage(state, inv, fx.damage, events)
      break
    }
    case 'choosePowerOrHorror': {
      const answer = requestChoice(state, { kind: 'treachery', source: fx.kind, seat: inv.seat, prompt: '选择力量或恐惧。',
        options: [{ id: 'horror', label: `受到 ${fx.horror || 2} 恐惧` }, { id: 'power', label: `抽 ${fx.draw || 2} 张牌并放置毁灭` }] })
      if (answer === 'horror') applyHorror(state, inv, fx.horror || 2, events)
      else {
        for (const text of drawCards(state, inv, fx.draw || 2, events)) info(state, events, text)
        addDoom(state, fx.doom || 2, events)
      }
      break
    }
    case 'doomOnNearestCultist': {
      const target = nearestEnemyByTrait(state, inv.location, 'Cultist')
      if (target) {
        placeDoomOnCard(state, target, fx.amount, events, { silent: true })
        info(state, events, `🌑 「${target.name}」上放置 ${fx.amount} 点毁灭（当前 ${target.doom}）。`)
      } else {
        // "Search the encounter deck and discard pile for a Cultist enemy."
        drawEnemyByTrait(state, inv, 'Cultist', events, true)
      }
      break
    }
    case 'attachLockedDoor': {
      const candidates = state.locations.filter(loc => !loc.locked)
      if (!candidates.length) { info(state, events, '没有可附属上锁的门的地点。'); break }
      const maxClues = Math.max(...candidates.map(loc => loc.clues || 0))
      const pool = candidates.filter(loc => (loc.clues || 0) === maxClues)
      const chosenId = pool.length === 1 ? pool[0].id : requestChoice(state, {
        kind: 'target', source: fx.kind, seat: inv.seat, prompt: '选择线索最多且没有上锁的门的地点。',
        options: pool.map(loc => ({ id: loc.id, label: `${loc.name}（线索 ${loc.clues || 0}）` })),
      })
      const chosen = pool.find(loc => loc.id === chosenId)
      if (chosen) {
        chosen.locked = true
        chosen.lockedDoorCode = fx.code
        info(state, events, `🔒 「${cardName(fx.code)}」封锁了「${chosen.name}」。`)
        return true
      }
      break
    }
    default:
      throw new Error(`未实现的诡计效果：${fx.kind}`)
  }
}

function runActReveal(state, act, events) {
  const r = act.reveal
  if (!r) return
  const scId = state.scenario.id
  // 第 5 批：关卡行为能按 reveal.type 接管的，先交给行为（集结全部幕、地底噬魔幕 1/2/终幕）。
  if (r.type !== 'campaignRule'
    && scenarioBehavior(state).actReveal?.(state, act, scenarioRuntime(state, events), r.type)) return
  switch (r.type) {
    case 'campaignRule':
      if (!scenarioBehavior(state).actReveal) throw new Error(`场景规则尚未迁移：${act.originalCode}`)
      scenarioBehavior(state).actReveal(state, act, scenarioRuntime(state, events))
      break
    case 'resolutionChoice': {
      // 集结的幕 3 结局选择已搬到关卡行为；午夜假面等没有 actReveal 的关卡继续走下面的旧逻辑。
      const handled = scenarioBehavior(state).actReveal?.(state, act, scenarioRuntime(state, events), r.type)
      if (handled) break
      const resolution = scenarioBehavior(state).houseFateChoice ? requestChoice(state, { kind: 'story', source: act.id, seat: leadDecisionSeat(state),
        prompt: '决定房屋的命运。', options: [{ id: 'r1', label: '烧毁房屋' }, { id: 'r2', label: '保留房屋' }] }) : 'r1'
      finishScenario(state, resolution, events)
      break
    }
    case 'resolution2': finishScenario(state, 'r2', events); break
    default:
      throw new Error(`未实现的场景效果：${r.type}`)
  }
}

function runAgendaForced(state, when, events) {
  const ag = state.agendas[state.agendaIndex]
  if (!ag || !ag.forced || !ag.forced[when]) return
  const f = ag.forced[when]
  // 第 5 批：强制效果由关卡行为按 type 结算（集结的「食尸鬼涌向客厅」等）。
  scenarioBehavior(state).agendaForced?.(state, when, scenarioRuntime(state, events), f.type)
}

// 2026-10-25 第七轮修复 05004（交叉复核）：嵌套描述子结算深度。
// deferredBeneath（黛安娜把取消的卡压到自身底下）必须等**最外层** executeDescriptor 把手牌处置完
// （进弃牌堆）之后再冲刷，否则嵌套反应提前冲刷会造成同一张卡同时出现在 beneath 与 discard。
let descriptorDepth = 0

function flushDeferredBeneath(state, events = []) {
  if (!Array.isArray(state.deferredBeneath) || !state.deferredBeneath.length) return
  const pending = state.deferredBeneath
  delete state.deferredBeneath
  for (const item of pending) {
    const owner = state.investigators[item.seat]
    if (!owner) continue
    const discardIndex = (owner.discard || []).indexOf(item.code)
    if (discardIndex >= 0) owner.discard.splice(discardIndex, 1)
    owner.beneath ||= []
    owner.beneath.push(item.code)
    if (item.log !== false) info(state, events, `「${cardName(item.code)}」被放在 ${owner.name} 底下。`)
  }
}

function executeDescriptor(state, params) {
  descriptorDepth += 1
  try {
    return runExecuteDescriptor(state, params)
  } finally {
    descriptorDepth -= 1
    if (descriptorDepth === 0) flushDeferredBeneath(state, params?.events)
  }
}

function runExecuteDescriptor(state, { inv, source, descriptor, context = {}, events, windowId = null, fromHandIndex = null, effect = null, legacyAbilityLog = false, alreadyPaid = false, silent = false, channelDiscount = 0, fromChannel = null }) {
  const cost = descriptorCost(descriptor)
  // 手牌事件：先按打出规则付费并离开手牌，再结算效果。
  // noPlayCost 的描述子（如 05023 宝剑王牌「放置入场」）自己负责移动这张牌。
  // Phase 5（5c-8）：反应窗口打出的快速事件由 playReactionCard 先付费/离手，
  // 此时用 alreadyPaid 跳过这一段（费用与日志都在那边，保持逐字一致）。
  // 2026-10-27「如同手牌」通道统一原语：窗口用 takeToHand 把来源取进手牌后再调用这里，
  // 折扣（直觉牌库 -2 等）由 channelDiscount 显式给出，不再写 inv.playDiscount。
  let handCode = null
  if (!alreadyPaid && descriptor.fromHand && !descriptor.noPlayCost) {
    const index = Number.isInteger(fromHandIndex) && inv.hand[fromHandIndex] === descriptor.code
      ? fromHandIndex
      : (inv.hand || []).indexOf(descriptor.code)
    if (index < 0) return false
    handCode = inv.hand[index]
    const def = cardDef(handCode)
    if (!def) return false
    const price = Math.max(0, playCost(state, inv, def) - (channelDiscount || 0))
    if (inv.resources < price) return false
    inv.hand.splice(index, 1)
    resourceBank.spendFromPool(inv, price)
    consumePlayThreatResources(state, inv, events)
    info(state, events, fromChannel?.channel === 'hunch'
      ? `🔮 ${inv.name} 从直觉牌库快速打出「${cardName(handCode)}」。`
      : `⚡ ${inv.name} 快速打出「${cardName(handCode)}」。`)
  }
  if (!alreadyPaid && !payAbilityCost(state, inv, source, cost, events, descriptor)) return false
  // 只有 kind 'action' 的描述子消耗行动点：free / reaction / forced 都是 0 费，
  // 不能因为 cost 里没写 action:false 就在窗口结算里扣行动（Phase 1 修正）。
  if (!alreadyPaid && descriptor.kind === 'action' && cost.action !== false) spendAction(state, inv)
  markLimitUsed(state, inv, descriptor, context, windowId, source)
  // 日志文案：从牌桌「能力」入口（doAbility）进来的描述子必须复刻旧式能力文案
  // （`使用「X」的能力：…`），否则迁移一张卡就改一行玩家可见日志，重放指纹会对不上。
  // 事件卡（fromHand）与窗口触发的描述子沿用 Phase 2 起的短文案；
  // Phase 5（5c-8）：反应窗口打出的快速事件已有「快速打出」日志，这里静默。
  if (!silent) info(state, events, `✨ ${inv.name} 使用「${cardName(descriptor.code)}」${legacyAbilityLog ? '的能力' : ''}：${descriptor.label}。`)
  const baseApi = abilityApi(state, events)
  const sourceAsset = source && (inv.assets || []).find(item => item.id === source.id)
  // 「值得信赖」等：描述子 resolve 里直接发起的检定也要算上宿主附属的技能加成。
  const attachedSkillBonus = sourceAsset
    ? (sourceAsset.attachments || []).reduce((sum, attachment) =>
      sum + (registeredEntry(attachment.code)?.attachedSkillBonus || 0), 0)
    : 0
  const api = sourceAsset ? {
    ...baseApi,
    // 检定类 API：宿主附属的 +1 直接加到本次检定上。
    ...(attachedSkillBonus ? {
      test: (seat, skill, difficulty, options = {}) => baseApi.test(seat, skill, difficulty, {
        ...options,
        skillBonus: (options.skillBonus || 0) + (seat === inv.seat ? attachedSkillBonus : 0),
      }),
      startTest: spec => {
        const seat = spec.seat ?? state.currentSeat
        return baseApi.startTest({
          ...spec,
          skillBonus: (spec.skillBonus || 0) + (seat === inv.seat ? attachedSkillBonus : 0),
        })
      },
    } : {}),
    // 动作类 API：把来源支援实例交给主流程，武器特性、附属加成与攻击展示都读同一份 assetId。
    fight: (seat, enemyId, options = {}) => baseApi.fight(seat, enemyId, options.assetId != null
      ? options
      : { ...options, assetId: sourceAsset.id }),
    investigate: (seat, options = {}) => baseApi.investigate(seat, options.assetId != null
      ? options
      : { ...options, assetId: sourceAsset.id }),
    evade: (seat, options = {}) => baseApi.evade(seat, options.assetId != null
      ? options
      : { ...options, assetId: sourceAsset.id }),
  } : baseApi
  // 第 5 步 P6：「治疗恐惧后」窗口要知道是哪张卡的效果在治疗（卡洛琳·弗恩）。
  const healingApi = {
    ...api,
    healHorror: (seat, amount, options = {}) => api.healHorror(seat, amount, {
      healerSeat: inv.seat, cardCode: descriptor.code, ...options,
    }),
    healAsset: (card, spec = {}) => api.healAsset(card, { owner: inv, cardCode: descriptor.code, ...spec }),
  }
  const ctx = {
    state, seat: inv.seat, inv,
    source: source || { code: descriptor.code },
    descriptor,
    window: windowId,
    context,
    events,
    fromHandIndex,
    effect,
    // 目标枚举（B1）：描述子声明 target 时，legalMoves 已经让玩家/AI 选好 targetId，
    // 这里还原成实体（enemy / investigator / location / asset / cardInHand）。
    targetId: context?.targetId ?? null,
    target: resolveTarget(state, inv, descriptor.target, context?.targetId, { source, windowId, context }),
    api: healingApi,
  }
  // 第 5 步 P6：结算期间记录「正在结算的是哪张卡」——取消/忽略效果的记账（cardCancelled）
  // 与「放在黛安娜底下」都靠它，不要求每个取消路径各传一次卡号。
  // 2026-10-25 第五轮修复 05004：取消自动记账的快照（见本函数末尾）。用进程内帧，不写 state
  // （state 上放临时字段会改变存档/重放指纹）。
  const cancelledBefore = context?.cancelled === true
  beginCancelNoteFrame()
  let cancelledByDescriptor = false
  const previousResolving = state._resolvingCardCode
  const previousResolvingSeat = state._resolvingSeat
  state._resolvingCardCode = descriptor.code
  state._resolvingSeat = inv.seat
  try {
    descriptor.resolve?.(ctx)
    // 描述子也可以只声明旧式 effect（例如「花 1 子弹攻击」），由效果解释器结算。
    // Phase 5：legalMoves 已经让玩家/AI 选好 targetId，effect 数据体必须像旧式能力那样
    // 收到同一份目标（doAbility 的 applyAbilityTarget），否则解释器会再问一次目标。
    if (!descriptor.resolve && descriptor.effect) {
      let effectData = { ...descriptor.effect, assetId: source?.id ?? descriptor.code }
      if (ctx.targetId != null) effectData = applyAbilityTarget(effectData, ctx.targetId)
      if (context?.optionIndex != null) effectData = { ...effectData, optionIndex: context.optionIndex }
      resolveEffect(state, inv.seat, effectData, makeRuntime(state, events))
    }
    cancelledByDescriptor = !cancelledBefore && context?.cancelled === true && !cancelNoteFrameNoted()
  } finally {
    // 2026-10-25 第五轮修复 05004：旧路径直接写 context.cancelled 时补记「卡牌取消效果」事实。
    // 必须在恢复 _resolvingCardCode 之前记账（记账要从它取取消方卡号）。
    if (cancelledByDescriptor) noteCardCancelled(reactionWindow, state, events, { seat: inv.seat })
    if (previousResolving === undefined) delete state._resolvingCardCode
    else state._resolvingCardCode = previousResolving
    if (previousResolvingSeat === undefined) delete state._resolvingSeat
    else state._resolvingSeat = previousResolvingSeat
  }
  if (handCode) disposePlayedEvent(inv, handCode)
  // deferredBeneath 的冲刷统一在最外层 executeDescriptor 的 finally 中执行（见上方 flushDeferredBeneath）。
  // Phase 5（D2）：discardWhenEmpty 也可以写在注册表条目上（与 uses/usesType 同层）。
  const entry = registeredEntry(descriptor.code)
  const discardWhenEmpty = entry?.discardWhenEmpty
  if (discardWhenEmpty && source && source.uses != null && source.uses <= 0) {
    leaveAsset(state, inv, source)
    if (!source.removedFromGame && !source.returnedToHand) inv.discard.push(source.code)
    info(state, events, `「${cardName(source.code)}」充能耗尽，弃掉。`)
  }
  return true
}

// 描述子的使用前提：窗口匹配、条件（matcher）、上限、负担能力。
// mode: 'action'（主动使用，走 legalMoves/doAbility）
//       'free'  （玩家窗口里的免费触发）
//       'window'（反应/强制能力，由 openAbilityWindow 触发）

  return { resolveTreacheryEffect, runActReveal, runAgendaForced, executeDescriptor }
}
