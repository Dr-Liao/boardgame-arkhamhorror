// act-agenda.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 幕与议程的推进：目标判定、花费线索推进、密谋揭示与毁灭累积。
// 读点：checkAct / checkAgenda 由阶段机与效果共同调用；addDoom 是毁灭的唯一入口。
// 第 5 步 P6：放置毁灭可能新增「法术专用额外行动」（玛丽·朗博），授权逻辑在 spell-actions.js。
import { grantSpellCredit } from './spell-actions.js'

export function createActAgenda(deps) {
  const {
    ALL_STORY_ASSETS,
    agendaDoom,
    aliveInvestigators,
    autoEngageAll,
    cardDef,
    cardName,
    checkOutcome,
    defeatEnemy,
    enemyDef,
    finishScenario,
    groupClues,
    groupPayment,
    info,
    investigateBonus,
    investigatorTextBlanked,
    leadDecisionSeat,
    locLabel,
    locName,
    locationExists,
    newCardInstance,
    performTest,
    preyTarget,
    reactionWindow,
    registeredEntry,
    requestChoice,
    runActReveal,
    runAgendaReveal,
    scenarioBehavior,
    scenarioRuntime,
    startScenario,
    triggerReaction,
  } = deps

  // 幕/议程的背面剧情在内容层统一叫 advanceText（敦威治起由卡面 backText 生成）；
  // 旧数据或显式留空的最终议程再退回卡面 backText，最后才用通用说明。
  function advanceStoryText(card, fallback) {
    const printed = cardDef(card.originalCode || card.code)
    return card.advanceText || card.backText || printed?.backTextZh || printed?.backText || fallback
  }

  function advanceAct(state, events) {
    if (state.status !== 'playing') return
    const scBefore = state.scenario
    const cur = state.acts[state.actIndex]
    if (!cur) return
    const advanceText = advanceStoryText(cur, '翻开场景卡，结算背面的剧情与效果。')
    info(state, events, `翻开场景「${cur.name}」的背面。`, { kind: 'story', title: '场景推进',
      code: cur.originalCode || cur.code, face: 'back', name: cur.name, text: advanceText, flip: true })
    if (cur.reveal) runActReveal(state, cur, events)
    // 若 reveal 触发了剧本切换（finishScenario → startScenario），立即返回，避免污染新剧本。
    if (state.scenario !== scBefore || state.status !== 'playing') return
    scenarioBehavior(state).actLeftPlay?.(state, cur, scenarioRuntime(state, events))
    // 命运之线这类「多格幕牌库」剧本会在 actReveal 里自己重算当前幕；
    // 有 actIndexAfterAdvance 钩子时以它为准，避免再 ++ 一次而漂移。
    const advanceIndex = scenarioBehavior(state).actIndexAfterAdvance?.(
      state, cur, scenarioRuntime(state, events))
    if (Number.isInteger(advanceIndex)) state.actIndex = advanceIndex
    else state.actIndex++
    const next = state.acts[state.actIndex]
    if (!next) {
      checkOutcome(state, events)
      return
    }
    // 2026-10-25 第七轮修复 05286a/05288a：幕推进时旧幕的「裂口」搬到新幕（不累加两份）。
    if (Number.isInteger(cur.breaches) && cur.breaches > 0) {
      next.breaches = cur.breaches
      cur.breaches = 0
    }
    info(state, events, `📜 场景推进：${next.stage}「${next.name}」—— ${next.text}`,
      { kind: 'story', title: '新的场景', code: next.originalCode || next.code, name: next.name, text: next.text })
    if (state.status === 'playing') autoEngageAll(state, events)
  }

  function discardUntilEnemy(state, events) {
    const discarded = []
    while (state.encounterDeck.length) {
      const code = state.encounterDeck.pop()
      const def = enemyDef(code)
      if (def) { for (const c of discarded) state.encounterDiscard.push(c); return code }
      discarded.push(code)
    }
    for (const c of discarded) state.encounterDiscard.push(c)
    return null
  }

  function canAdvanceWithClues(state, roundEnd = false) {
    const obj = state.acts[state.actIndex]?.objective
    if (obj?.type !== 'clues') return false
    const requiresRoundEnd = scenarioBehavior(state).roundEndActIndex === state.actIndex
    if (requiresRoundEnd !== roundEnd) return false
    return aliveInvestigators(state).filter(inv => !obj.atLocation || inv.location === obj.atLocation)
      .reduce((sum, inv) => sum + inv.clues, 0) >= obj.perInvestigator * state.numInvestigators
  }

  function actObjectiveContext(state) {
    const obj = state.acts[state.actIndex]?.objective
    if (!obj) return null
    if (obj.type === 'clues') {
      const required = obj.perInvestigator * state.numInvestigators
      const available = groupClues(state)
      const atLocation = groupClues(state, obj.atLocation)
      const roundEnd = scenarioBehavior(state).roundEndActIndex === state.actIndex
      return { type: obj.type, perInvestigator: obj.perInvestigator, investigatorCount: state.numInvestigators,
        requiredClues: required, availableTeamClues: available, eligibleCluesAtLocation: atLocation,
        cluesStillToCollect: Math.max(0, required - available),
        cluesMissingAtLocation: Math.max(0, required - atLocation),
        locationId: obj.atLocation || null, locationName: obj.atLocation ? locName(state, obj.atLocation) : null,
        timing: roundEnd ? 'roundEnd' : 'actionWindow',
        readyForPayment: atLocation >= required,
        instruction: `需要 ${required} 个线索（每位 ${obj.perInvestigator} × 本局 ${state.numInvestigators} 位调查员，败退不降低需求）；`
          + (obj.atLocation ? `由位于「${locName(state, obj.atLocation)}」的在场调查员共同支付；` : '由在场调查员共同支付；')
          + `全队可支付 ${available}，还需收集 ${Math.max(0, required - available)}，符合地点条件的可支付 ${atLocation}。`
          + (roundEnd ? '仅在回合结束时触发支付选择；凑齐后留在指定地点等待该窗口，来回移动不会触发推进。' : '满足条件后使用合法列表中的 advanceAct 推进。') }
    }
    if (obj.type === 'actClues') return { type: obj.type, required: obj.perInvestigator * state.numInvestigators,
      current: state.actClues, instruction: '通过当前合法的破坏仪式行动增加场景上线索；手持线索不等于场景上线索。' }
    if (obj.type === 'enterLocation') {
      const locationId = obj.location
      const onMap = state.locations.some(loc => loc.id === locationId)
      const locationName = locLabel(state, locationId, { includeHidden: true })
      return { type: obj.type, locationId, locationName, onMap,
        instruction: `进入「${locationName}」推进场景；该地点${onMap ? '已在地图上' : '尚未入场，需先探索或翻开'}。` }
    }
    if (obj.type === 'defeatEnemy') return { type: obj.type, enemyCode: obj.enemy,
      instruction: `击败目标敌人：${enemyDef(obj.enemy)?.name || obj.enemy}。` }
    if (obj.type === 'uniqueCultists') return { type: obj.type, required: obj.amount,
      current: state.cultistsInVictory.length, instruction: `将 ${obj.amount} 名独特异教徒加入胜利区。` }
    return { type: obj.type }
  }

  function payAndAdvanceAct(state, events) {
    const objective = state.acts[state.actIndex].objective
    groupPayment(state, objective.perInvestigator * state.numInvestigators, objective.atLocation, events)
    advanceAct(state, events)
  }

  function checkAct(state, events) {
    if (state.status === 'playing') scenarioBehavior(state).checkObjectives?.(state, scenarioRuntime(state, events))
    const act = state.acts[state.actIndex]
    if (!act || state.status !== 'playing') return
    const obj = act.objective
    if (!obj) return
    if (obj.type === 'defeatEnemy') {
      const alive = state.enemies.some((e) => e.code === obj.enemy)
      if (!alive) advanceAct(state, events)
      return
    }
    if (obj.type === 'uniqueCultists') {
      if (state.cultistsInVictory.length >= obj.amount) advanceAct(state, events)
      return
    }
    if (obj.type === 'actClues') {
      const needed = obj.perInvestigator * state.numInvestigators
      if (state.actClues >= needed) advanceAct(state, events)
      return
    }
    if (obj.type === 'clues' && state._roundEndWindow && canAdvanceWithClues(state, true)) {
      const answer = requestChoice(state, { kind: 'act', source: act.id, seat: leadDecisionSeat(state),
        prompt: '回合结束：是否共同支付线索推进场景？', canSkip: true,
        options: [{ id: 'skip', label: '暂不推进' }, { id: 'advance', label: '共同支付并推进' }] })
      if (answer === 'advance') payAndAdvanceAct(state, events)
    }
  }

  function locationRevealCue(loc, entered = false, seat = null) {
    const code = loc.originalCode || loc.code, card = cardDef(code)
    return { kind: 'location', seat, location: loc.id, code, name: loc.name, title: entered ? '进入地点' : '地点揭示',
      flip: !entered, shroud: loc.shroud, clues: loc.clues, onEnter: loc.onEnter,
      text: card?.textZh || card?.text || loc.text || '此地点没有额外的卡面效果。' }
  }

  function spawnStoryAsset(state, code, locationId, events) {
    const def = ALL_STORY_ASSETS[code]
    if (!def || !locationExists(state, locationId)) return
    state.storyAssets ||= []
    if (state.storyAssets.some(asset => asset.code === code)
        || state.investigators.some(inv => inv.assets.some(asset => asset.code === code))) return
    const asset = newCardInstance(state, code, { exhausted: false, location: locationId, controllerSeat: null })
    state.storyAssets.push(asset)
    info(state, events, `剧情资产「${def.name}」出现在「${locName(state, locationId)}」，尚无人控制。`)
  }

  // 2026-10-27 修复：议程推进时按规则清空「场上每张卡」的毁灭标记。
  // Rules Reference, "Act Deck and Agenda Deck"（推进步骤 1）：
  //   "If the agenda deck is advancing, remove all doom from each card in play."
  // 旧实现只清零 state.doom（密谋计数器），敌人/地点/支援/剧情资产上的毁灭会残留，
  // 继续计入新密谋的阈值；往事回声里「邪教的搜查」(03146) 随后又把残留毁灭搬到新密谋，
  // 于是密谋刚结算完毁灭就显示很高（例如 2a 阈值 6 时直接显示 9/6）。
  //
  // 卡面可以覆盖这一步（金科玉律）。条目用 `doomKeptOnAgendaAdvance` 声明：
  //   'locations'：04055/04211「在本密谋推进时：不要从场上任何地点移除毁灭标记」
  //   'enemies'：05326/05327/05328「在本密谋推进时，不要移除敌人的毁灭标记」
  //   'self'：05044「推进时不要移除其上任何毁灭标记」、05149 那赫卜「推进时不移除其毁灭」
  const doomKeepOf = card => registeredEntry(card?.originalCode || card?.code)?.doomKeptOnAgendaAdvance || null

  function clearDoomInPlay(state, agenda = state.agendas?.[state.agendaIndex]) {
    const agendaKeep = doomKeepOf(agenda)
    const keepSelf = card => doomKeepOf(card) === 'self'
    const keepKind = (card, kind) => keepSelf(card) || agendaKeep === kind
    if (agendaKeep !== 'self') {
      state.doom = 0
      if (agenda) agenda.doom = 0
    }
    for (const enemy of state.enemies || []) if (!keepKind(enemy, 'enemies')) enemy.doom = 0
    for (const location of state.locations || []) {
      if (!keepKind(location, 'locations')) location.doom = 0
      for (const attachment of location.attachments || []) {
        if (!keepSelf(attachment)) attachment.doom = 0
      }
    }
    for (const inv of state.investigators || []) {
      for (const card of [...(inv.assets || []), ...(inv.threat || [])]) {
        if (!keepSelf(card)) card.doom = 0
      }
    }
    for (const asset of state.storyAssets || []) if (!keepSelf(asset)) asset.doom = 0
    for (const attachment of state.playerLocationAttachments || []) {
      if (!keepSelf(attachment)) attachment.doom = 0
    }
  }

  function advanceAgenda(state, events, reason = 'objective') {
    if (state.status !== 'playing') return
    if (reason === 'doom' && scenarioBehavior(state).agendaWouldAdvance?.(state, scenarioRuntime(state, events))) return
    const scBefore = state.scenario
    for (;;) {
      const cur = state.agendas[state.agendaIndex]
      if (!cur) return
      scenarioBehavior(state).agendaAdvancing?.(state, cur, scenarioRuntime(state, events))
      const advanceText = advanceStoryText(cur, '翻开密谋，结算背面的剧情与效果。')
      info(state, events, `翻开密谋「${cur.name}」的背面。`, { kind: 'story', title: '密谋推进',
        code: cur.originalCode || cur.code, face: 'back', name: cur.name, text: advanceText, flip: true })
      // 议程推进：移除场上每张卡上的所有毁灭（Rules Reference，见 clearDoomInPlay）。
      clearDoomInPlay(state, cur)
      scenarioBehavior(state).doomCleared?.(state, scenarioRuntime(state, events))
      if (cur.reveal) runAgendaReveal(state, cur, events)
      // 若 reveal 触发了剧本切换，立即返回。
      if (state.scenario !== scBefore || state.status !== 'playing') return
      if (state.agendas[state.agendaIndex] !== cur) return
      scenarioBehavior(state).agendaLeftPlay?.(state, cur, scenarioRuntime(state, events))
      state.agendaIndex++
      const next = state.agendas[state.agendaIndex]
      if (!next) {
        checkOutcome(state, events)
        return
      }
      info(state, events, `🌑 密谋推进：${next.stage}「${next.name}」—— ${next.text}`,
        { kind: 'story', title: '新的密谋', code: next.originalCode || next.code, name: next.name, text: next.text })
      if (state.status === 'playing') autoEngageAll(state, events)
      // "Advance directly to 2b": flip the newly revealed agenda immediately.
      if (!scenarioBehavior(state).agendaChain?.(state, next, scenarioRuntime(state, events))) return
    }
  }

  function discardUntilEnemyFromEncounter(state, seat, predicate, events) {
    const discarded = []
    let found = null
    while (state.encounterDeck.length) {
      const code = state.encounterDeck.pop()
      const def = enemyDef(code)
      if (def && predicate(def, code)) { found = code; break }
      discarded.push(code)
    }
    for (const c of discarded) state.encounterDiscard.push(c)
    return found
  }

  function investigateTest(state, seat, options = {}, events) {
    const inv = state.investigators[seat]
    const loc = state.locations.find(item => item.id === (options.locationId || inv.location))
    if (!loc) return null
    const skill = loc.investigateSkill || 'intellect'
    const difficulty = loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0)
    return performTest(state, seat, skill, difficulty, {
      source: { label: '调查', name: loc.name, code: loc.originalCode || loc.code },
      skillBonus: skill === 'intellect' ? investigateBonus(inv) : 0,
      resolve: r => {
        if (r.success) {
          triggerReaction(state, seat, 'investigateSuccess', events, { location: loc.id, successBy: r.value - difficulty })
          options.onSuccess?.(r, loc)
        } else {
          reactionWindow(state, 'investigateFail', { when: 'investigateFail', seat, location: loc.id,
            failedBy: Math.max(0, difficulty - r.value), prompt: '调查检定失败后' }, events)
          options.onFail?.(r, loc)
        }
      },
    })
  }

  function discardUntilEnemyTrait(state, trait, events) {
    const t = (trait || '').toLowerCase()
    const discarded = []
    while (state.encounterDeck.length) {
      const code = state.encounterDeck.pop()
      const def = enemyDef(code)
      if (def && (def.traits || []).some((x) => x.toLowerCase() === t)) {
        for (const c of discarded) state.encounterDiscard.push(c)
        return code
      }
      discarded.push(code)
    }
    for (const c of discarded) state.encounterDiscard.push(c)
    return null
  }

  function checkAgenda(state, events) {
    const ag = state.agendas[state.agendaIndex]
    if (!ag || state.status !== 'playing') return
    // 卡面目标型密谋（如 04284「每位调查员被击败」）：不靠毁灭阈值推进。
    if (ag.objective?.type === 'allDefeated'
      && !state.investigators.some(inv => !inv.defeated && !inv.resigned)) {
      advanceAgenda(state, events, 'objective')
      return
    }
    if (ag.doomThreshold == null) return
    // 阈值比较的是「场上毁灭总数」：密谋自身（state.doom / 议程实例）加上
    // 敌人、地点、支援、威胁区等所有卡牌上的毁灭（Rules Reference, "Act Deck and Agenda Deck"）。
    // 注意：推进时这些毁灭会被一起清除（clearDoomInPlay），不会残留到下一张密谋。
    if (agendaDoom(state) < ag.doomThreshold) return
    // 第 5 步 P6：「当密谋将要因达到毁灭阈值而推进时」的窗口（05018 神秘乐曲）。
    // 只在没有其它窗口正在结算时开，避免推进 → 放毁灭 → 再推进的递归。
    if (!state._agendaAdvanceWindow) {
      state._agendaAdvanceWindow = true
      try {
        reactionWindow(state, 'agendaWouldAdvance', {
          when: 'agendaWouldAdvance', agenda: ag, doom: agendaDoom(state), threshold: ag.doomThreshold,
          prompt: `「${ag.name || ag.code}」将要因毁灭阈值推进`,
        }, events)
      } finally {
        delete state._agendaAdvanceWindow
      }
    }
    if (state.agendaDoomLock?.round === state.round && state.agendaDoomLock?.phase === state.phase) {
      info(state, events, `🎵 本阶段的密谋推进已被阻止（毁灭阈值不推进）。`)
      return
    }
    advanceAgenda(state, events, 'doom')
  }

  function checkAgendaForcedEnemyDefeated(state, enemy, events) {
    const ag = state.agendas[state.agendaIndex]
    if (!ag || !ag.forced || !ag.forced.enemyDefeated) return
    // 第 5 批：击败触发的密谋推进由关卡行为结算（乌默尔多斯 → 结局 2）。
    scenarioBehavior(state).agendaForcedEnemyDefeated?.(state, enemy, scenarioRuntime(state, events))
  }

  function placeDoomOnCard(state, card, amount, events, options = {}) {
    if (!card || !(amount > 0)) return 0
    // 2026-10-25 本循环修复 doom-placement-prevention（05085/05095/05096/05097）：
    // 写入前询问剧本「这张卡能否被放置毁灭」；返回 false 时既不写也不触发 doomPlaced。
    if (scenarioBehavior(state).canPlaceDoomOn?.(state, card) === false) {
      if (options.silent !== true) {
        info(state, events, `🔒 「${card.name || cardName(card.code)}」当前不能放置毁灭标记。`)
      }
      return 0
    }
    // Phase 5（5a-28）：「手铐」这类禁止放毁灭的附属由条目级 restrainsDoom 声明。
    const cuffed = (card.attachments || []).some(attachment => registeredEntry(attachment.originalCode || attachment.code)?.restrainsDoom)
    if (cuffed && !card.elite) {
      if (options.silent !== true) {
        info(state, events, `🔒 「${card.name || cardName(card.code)}」被手铐铐住，不能在其上放置毁灭。`)
      }
      return 0
    }
    card.doom = (card.doom || 0) + amount
    // 第 5 步 P6：卡牌上出现毁灭标记可能新增「法术专用额外行动」（玛丽·朗博）。
    // 只在轮到该调查员时结算；没有该规则的调查员在这里是纯读点（investigatorRule 返回空）。
    const current = state.investigators[state.currentSeat]
    if (current) {
      grantSpellCredit(state, current, {
        blanked: investigatorTextBlanked(state, current),
        info: text => info(state, events, text),
      })
    }
    scenarioBehavior(state).doomPlaced?.(state,
      { target: card, amount, agenda: false }, scenarioRuntime(state, events))
    // 2026-10-25 第六轮修复 05237：刚放置的毁灭可被反应取消（内容调用 api.cancelDoomPlacement）。
    reactionWindow(state, 'doomPlaced', {
      when: 'doomPlaced', seat: state.currentSeat, card, amount,
      prompt: `「${card.name || cardName(card.code)}」放置了 ${amount} 点毁灭`,
    }, events)
    return amount
  }

  function addDoom(state, amount, events) {
    // 2026-10-25 第四轮修复 05285：放置前的替换钩子（如「改为在多个地点放裂口」）。
    // 返回 true 表示内容已替换本次放置：不写 state.doom、不触发 doomPlaced、不检查议程。
    if (amount > 0 && scenarioBehavior(state).doomPlacementReplacement?.(
      state, amount, scenarioRuntime(state, events)) === true) {
      return
    }
    state.doom += amount
    info(state, events, `🌑 密谋上增加 ${amount} 点毁灭（当前 ${state.doom}）。`)
    if (amount > 0) {
      scenarioBehavior(state).doomPlaced?.(state,
        { target: null, amount, agenda: true }, scenarioRuntime(state, events))
      // 2026-10-25 第七轮修复 05237：密谋毁灭的取消窗口（仅当有 doomPlaced 候选时开）。
      const hasDoomPlaced = (state.investigators || []).some(inv => [...(inv.assets || []), ...(inv.threat || []), ...(inv.hand || [])]
        .some(card => (registeredEntry(typeof card === 'string' ? card : card.code)?.abilities || [])
          .some(ability => ability.trigger === 'doomPlaced'
            || (Array.isArray(ability.trigger) && ability.trigger.includes('doomPlaced')))))
      if (hasDoomPlaced) {
        reactionWindow(state, 'doomPlaced', {
          when: 'doomPlaced', seat: state.currentSeat, card: null, agenda: true, amount,
          prompt: `密谋上放置了 ${amount} 点毁灭`,
        }, events)
      }
    }
    checkAgenda(state, events)
  }

  return { advanceAct, discardUntilEnemy, canAdvanceWithClues, actObjectiveContext, payAndAdvanceAct, checkAct, locationRevealCue, spawnStoryAsset, advanceAgenda, discardUntilEnemyFromEncounter, investigateTest, discardUntilEnemyTrait, checkAgenda, checkAgendaForcedEnemyDefeated, placeDoomOnCard, addDoom }
}
