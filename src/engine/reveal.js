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
        loc.fogCode = loc.fogCode || 'obscuringFog'
        info(state, events, `🌫️ 「朦胧之雾」附着于「${loc.name}」，帷幕 +${fx.amount}。`)
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
        chosen.lockedDoorCode = 'lockedDoor'
        info(state, events, `🔒 「上锁的门」封锁了「${chosen.name}」。`)
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
  switch (r.type) {
    case 'campaignRule':
      if (!scenarioBehavior(state).actReveal) throw new Error(`场景规则尚未迁移：${act.originalCode}`)
      scenarioBehavior(state).actReveal(state, act, scenarioRuntime(state, events))
      break
    case 'openHallway': {
      // 原卡：将放在一边的走廊、地窖、阁楼和客厅放置入场；揭示走廊。
      for (const id of ['hallway', 'cellar', 'attic', 'parlor']) placeLocation(state, id, events)
      const studyEnemies = state.enemies.filter((e) => e.location === 'study')
      for (const e of studyEnemies.slice()) {
        disengageEnemy(state, e)
        removeOne(state.enemies, e)
        const owner = state.investigators[e.bearerSeat]
        if (isWeaknessCode(e.code) && owner) owner.discard.push(e.code)
        else state.encounterDiscard.push(e.code)
      }
      for (const inv of aliveInvestigators(state)) inv.location = 'hallway'
      revealLocation(state, 'hallway', events)
      removeLocation(state, 'study', events)
      info(state, events, '🚪 书房的地板上出现一道暗门！所有人进入「走廊」，书房被移出游戏。')
      break
    }
    case 'revealParlor': {
      placeLocation(state, 'parlor', events)
      revealLocation(state, 'parlor', events)
      spawnStoryAsset(state, LITA_CHANDLER_CODE, 'parlor', events)
      const boss = spawnEnemy(state, 'ghoulPriest', 'hallway', null)
      if (boss) info(state, events, `👹 首领「${boss.name}」出现在「走廊」！`)
      break
    }
    case 'revealRitualSite': {
      // 地底噬魔场景 1 推进：放置仪式地（若未放），逃跑的异教徒生成于主道路。
      placeLocation(state, 'ritualSite', events)
      const escaped = state.campaign.records.cultistsEscaped || []
      for (const originalCode of escaped) {
        const code = ruleCodeForOriginal(originalCode)
        const enemy = spawnEnemy(state, code, 'mainPath', null, true)
        if (enemy) info(state, events, `👹 逃跑的异教徒「${enemy.name}」出现在「主道路」！`)
      }
      break
    }
    case 'drawEnemyAtRitualSite': {
      // 地底噬魔场景 2 推进：洗回弃牌，弃牌直到翻出敌人（>3 人两次），生成于仪式地。
      if (state.encounterDiscard.length) {
        state.encounterDeck = shuffle([...state.encounterDeck, ...state.encounterDiscard], () => randomValue(state))
        state.encounterDiscard = []
      }
      const times = state.numInvestigators >= 3 ? 2 : 1
      for (let k = 0; k < times; k++) {
        const enemy = discardUntilEnemy(state, events)
        if (enemy) {
          const e = spawnEnemy(state, enemy, 'ritualSite', null, true)
          if (e) info(state, events, `👹 「${e.name}」在「仪式地」生成！`)
        }
      }
      break
    }
    case 'resolutionChoice': {
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
  if (f.type === 'ghoulsMoveToParlor') {
    for (const enemy of state.enemies) {
      if (enemy.engagedSeat != null) continue
      const isGhoul = (enemy.traits || []).some((t) => t.toLowerCase() === 'ghoul')
      if (!isGhoul) continue
      const dest = stepToward(state, enemy.location, 'parlor')
      if (dest && dest !== enemy.location) {
        const prev = enemy.location
        relocateEnemy(state, enemy, dest, events)
        info(state, events, `「${enemy.name}」向客厅移动（${locName(state, prev)} → ${locName(state, dest)}）。`)
      }
    }
    autoEngageAll(state, events)
  } else if (f.type === 'doomPerGhoulAtParlorHallway') {
    const n = state.enemies.filter((e) => ['parlor', 'hallway'].includes(e.location) && (e.traits || []).some((t) => t.toLowerCase() === 'ghoul')).length
    if (n > 0) {
      info(state, events, `🌑 密谋 3 强制：走廊/客厅有 ${n} 个食尸鬼，放置 ${n} 点毁灭。`)
      addDoom(state, n, events)
    }
  }
}

function executeDescriptor(state, { inv, source, descriptor, context = {}, events, windowId = null, fromHandIndex = null, effect = null, legacyAbilityLog = false, alreadyPaid = false, silent = false }) {
  const cost = descriptorCost(descriptor)
  // 手牌事件：先按打出规则付费并离开手牌，再结算效果。
  // noPlayCost 的描述子（如 05023 宝剑王牌「放置入场」）自己负责移动这张牌。
  // Phase 5（5c-8）：反应窗口打出的快速事件由 playReactionCard 先付费/离手，
  // 此时用 alreadyPaid 跳过这一段（费用与日志都在那边，保持逐字一致）。
  let handCode = null
  if (!alreadyPaid && descriptor.fromHand && !descriptor.noPlayCost) {
    const index = Number.isInteger(fromHandIndex) && inv.hand[fromHandIndex] === descriptor.code
      ? fromHandIndex
      : (inv.hand || []).indexOf(descriptor.code)
    if (index < 0) return false
    handCode = inv.hand[index]
    const def = cardDef(handCode)
    if (!def) return false
    const price = playCost(state, inv, def)
    if (inv.resources < price) return false
    inv.hand.splice(index, 1)
    inv.resources -= price
    consumePlayThreatResources(state, inv, events)
    info(state, events, `⚡ ${inv.name} 快速打出「${cardName(handCode)}」。`)
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
    api: abilityApi(state, events),
  }
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
  if (handCode) disposePlayedEvent(inv, handCode)
  // Phase 5（D2）：discardWhenEmpty 也可以写在注册表条目上（与 uses/usesType 同层）。
  const entry = registeredEntry(descriptor.code)
  const discardWhenEmpty = entry?.discardWhenEmpty || EFFECTS[descriptor.code]?.discardWhenEmpty
  if (discardWhenEmpty && source && source.uses != null && source.uses <= 0) {
    leaveAsset(state, inv, source)
    if (!source.removedFromGame) inv.discard.push(source.code)
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
