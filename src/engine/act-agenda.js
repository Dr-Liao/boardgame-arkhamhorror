// act-agenda.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 幕与议程的推进：目标判定、花费线索推进、密谋揭示与毁灭累积。
// 读点：checkAct / checkAgenda 由阶段机与效果共同调用；addDoom 是毁灭的唯一入口。
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

  function advanceAct(state, events) {
    if (state.status !== 'playing') return
    const scBefore = state.scenario
    const cur = state.acts[state.actIndex]
    if (!cur) return
    info(state, events, `翻开场景「${cur.name}」的背面。`, { kind: 'story', title: '场景推进',
      code: cur.originalCode || cur.code, face: 'back', name: cur.name, text: cur.backText || '翻开场景卡，结算背面的剧情与效果。', flip: true })
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

  function advanceAgenda(state, events, reason = 'objective') {
    if (state.status !== 'playing') return
    if (reason === 'doom' && scenarioBehavior(state).agendaWouldAdvance?.(state, scenarioRuntime(state, events))) return
    const scBefore = state.scenario
    for (;;) {
      const cur = state.agendas[state.agendaIndex]
      if (!cur) return
      scenarioBehavior(state).agendaAdvancing?.(state, cur, scenarioRuntime(state, events))
      info(state, events, `翻开密谋「${cur.name}」的背面。`, { kind: 'story', title: '密谋推进',
        code: cur.originalCode || cur.code, face: 'back', name: cur.name, text: cur.backText || '翻开密谋，结算背面的剧情与效果。', flip: true })
      // Only the agenda's own doom is discarded; doom on enemies/locations/assets
      // stays in play (Rules Reference, "Doom").
      state.doom = 0
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
    // Only doom on the current agenda advances it. Doom on enemies/locations/assets
    // stays in play when the agenda advances (see rules-state.js).
    if (agendaDoom(state) >= ag.doomThreshold) advanceAgenda(state, events, 'doom')
  }

  function checkAgendaForcedEnemyDefeated(state, enemy, events) {
    const ag = state.agendas[state.agendaIndex]
    if (!ag || !ag.forced || !ag.forced.enemyDefeated) return
    // 第 5 批：击败触发的密谋推进由关卡行为结算（乌默尔多斯 → 结局 2）。
    scenarioBehavior(state).agendaForcedEnemyDefeated?.(state, enemy, scenarioRuntime(state, events))
  }

  function placeDoomOnCard(state, card, amount, events, options = {}) {
    if (!card || !(amount > 0)) return 0
    // Phase 5（5a-28）：「手铐」这类禁止放毁灭的附属由条目级 restrainsDoom 声明。
    const cuffed = (card.attachments || []).some(attachment => registeredEntry(attachment.originalCode || attachment.code)?.restrainsDoom)
    if (cuffed && !card.elite) {
      if (options.silent !== true) {
        info(state, events, `🔒 「${card.name || cardName(card.code)}」被手铐铐住，不能在其上放置毁灭。`)
      }
      return 0
    }
    card.doom = (card.doom || 0) + amount
    scenarioBehavior(state).doomPlaced?.(state,
      { target: card, amount, agenda: false }, scenarioRuntime(state, events))
    return amount
  }

  function addDoom(state, amount, events) {
    state.doom += amount
    info(state, events, `🌑 密谋上增加 ${amount} 点毁灭（当前 ${state.doom}）。`)
    if (amount > 0) {
      scenarioBehavior(state).doomPlaced?.(state,
        { target: null, amount, agenda: true }, scenarioRuntime(state, events))
    }
    checkAgenda(state, events)
  }

  return { advanceAct, discardUntilEnemy, canAdvanceWithClues, actObjectiveContext, payAndAdvanceAct, checkAct, locationRevealCue, spawnStoryAsset, advanceAgenda, discardUntilEnemyFromEncounter, investigateTest, discardUntilEnemyTrait, checkAgenda, checkAgendaForcedEnemyDefeated, placeDoomOnCard, addDoom }
}
