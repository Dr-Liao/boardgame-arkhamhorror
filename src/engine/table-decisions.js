// table-decisions.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 台面决策层：谁在操作、能不能行动、行动代价与开局调度（mulligan / 起始调整）。
// 读点：legalMoves（actingSeats / actionPreview）、validateHubMove、runMulligans。
export function createTableDecisions(deps) {
  const {
    ALL_INVESTIGATORS,
    CLASS_NAMES,
    EFFECTS,
    HUB_SEAT_ACTIONS,
    INVESTIGATOR_ABILITIES,
    PLAYABLE_INVESTIGATORS,
    actionCost,
    advanceAct,
    aliveInvestigators,
    applyHorror,
    assetEffect,
    assetPassiveData,
    basicWeaknessPool,
    buildDeckFromList,
    campaignGraph,
    campaignManifestFor,
    capabilityBlocked,
    cardDef,
    cardName,
    cardPlayFlag,
    choiceSeats,
    chooseLolaRole,
    chooseTurn,
    controlledAbilityCard,
    corePlayerPool,
    discardRandomFromHand,
    drawOpeningHand,
    enemiesEngagedWith,
    enemyCanOpportunityAttack,
    enemyDef,
    getThreatEffect,
    groupClues,
    hubConcurrentPhase,
    hubLegalMoves,
    hubPendingSeats,
    inHub,
    info,
    investigatorTextBlanked,
    leaveAsset,
    legalMoves,
    phaseBeginningWindow,
    playCost,
    playedEffect,
    randomValue,
    registeredEntry,
    removeOne,
    requestChoice,
    scenarioBehavior,
    shuffle,
    turnBeginningWindow,
  } = deps

  function decisionSeat(state) {
    if (state.status !== 'playing') return null
    if (state.pendingChoice) return state.pendingChoice.seat
    const seats = actingSeats(state)
    return seats.includes(state.currentSeat) ? state.currentSeat : seats[0]
  }

  function actingSeats(state) {
    if (state.status !== 'playing') return []
    if (state.pendingChoice) return choiceSeats(state.pendingChoice)
    const pending = inHub(state) && hubConcurrentPhase(state) ? hubActingSeats(state) : []
    return pending.length ? pending : [state.currentSeat]
  }

  function seatLocalMove(state, seat, move) {
    return inHub(state) && !state.pendingChoice && hubConcurrentPhase(state)
      && HUB_SEAT_ACTIONS.has(move?.action) && hubActingSeats(state).includes(seat)
  }

  function hubActingSeats(state) {
    const pending = hubPendingSeats(state), humans = state.humanSeats || [0]
    const humanPending = pending.filter(seat => humans.includes(seat))
    return humanPending.length ? humanPending : pending
  }

  function initialHubScenarioMoves(state) {
    if (state.campaign.scenarioResults.length) return []
    const manifest = campaignManifestFor(state)
    const graph = campaignGraph(manifest)
    const start = graph.nodes[graph.start]
    if (start?.type !== 'choice') return []
    return start.options.flatMap(option => {
      const destination = graph.nodes[option.next]
      return destination?.type === 'scenario'
        ? [{ action: 'hubSelectScenario', scenarioId: destination.scenarioId, optionId: option.id,
            label: option.label || `选择 ${destination.scenarioId}` }]
        : []
    })
  }

  function hubInvestigatorChoices(state, seat) {
    const unavailable = new Set([...Object.values(state.campaign.investigators), ...state.campaign.retired]
      .filter(record => record.seat !== seat || record.status !== 'active').map(record => record.code))
    // Teammates preparing at the same time reserve a pick before saving a deck.
    for (const inv of state.investigators) {
      if (inv.seat !== seat && state.hubSeatSelected?.[inv.seat]) unavailable.add(inv.code)
    }
    return PLAYABLE_INVESTIGATORS.filter(code => !unavailable.has(code))
  }

  function initialHubPreparation(state) {
    return state.uiState === 'scenarioSetup' && !state.campaign.scenarioResults.length
  }

  function hubStartingDeckReady(record) {
    return !!record?.deck?.length && record.startingDeckReady !== false
  }

  function validateHubMove(state, seat, move) {
    if (!actingSeats(state).includes(seat)) return '现在不是你的局外操作时机'
    if (!move || typeof move.action !== 'string') return '无效局外操作'
    if (move.action === 'hubSelectInvestigator' && state.campaign.investigators[seat]?.status === 'active' && !initialHubPreparation(state)) {
      return state.uiState === 'interlude' ? '关间只能为死亡或疯狂的调查员挑选替补，不能更换现役调查员' : '当前调查员仍在战役中，不能更换'
    }
    if (move.action === 'hubSetDeck') {
      if (!hubLegalMoves(state, seat).some(m => m.action === 'hubSetDeck')) return '当前不能保存牌组'
      if (!Array.isArray(move.codes)) return '牌组必须是卡号数组'
      const built = buildDeckFromList(ALL_INVESTIGATORS[state.investigators[seat].code], move.codes,
        { seat, seed: 1, playerPool: corePlayerPool(), basicWeaknessPool: basicWeaknessPool(state) })
      return built.errors?.length ? `自定义卡组无效：${built.errors.join('；')}` : null
    }
    return hubLegalMoves(state, seat).some(legal => Object.entries(legal)
      .filter(([key]) => !['label', 'explanation'].includes(key)).every(([key, value]) => move[key] === value)) ? null : '当前不可执行该局外操作'
  }

  function autoHubMove(state, seat, includeHuman = false) {
    if (!inHub(state) || !actingSeats(state).includes(seat) || (seat === 0 && !includeHuman) || state.pendingChoice) return null
    const moves = hubLegalMoves(state, seat)
    // A failed model step may leave a valid staged purchase to finish.
    const confirm = moves.find(move => move.action === 'hubConfirmUpgrades')
    if (confirm) return confirm
    for (const action of ['hubGoSetup', 'hubContinue', 'hubBeginScenario', 'hubSelectScenario']) {
      const move = moves.find(move => move.action === action)
      if (move) return move
    }
    const priority = state.hubSeatSelected?.[seat] ? ['hubAutoDeck', 'hubAutoUpgrade', 'hubDoneSeat', 'hubSelectInvestigator']
      : ['hubSelectInvestigator', 'hubAutoDeck', 'hubAutoUpgrade', 'hubDoneSeat']
    for (const action of priority) {
      if (action === 'hubAutoUpgrade' && state.hubUpgradedSeats?.[seat]) continue
      const move = moves.find(item => item.action === action)
      if (move) return move
    }
    return null
  }

  function decisionSeed(session, seat, step) {
    const state = session && session.state
    if (!state) return null
    return [state.rngState, state.revision, seat, step, state.round, state.phase].join(':')
  }

  function moveCost(state, seat, move) {
    if (!move || typeof move !== 'object') return 1
    if (state.pendingChoice || inHub(state)) return 0
    if (move.action === 'endTurn' || move.action === 'resign') return 0
    return actionCost(state, state.investigators[seat], move)
  }

  function cardPlayBlockedReason(state, inv, def) {
    // Phase 2（C1）：capability:play —— 声明式「不能打出卡牌」。
    if (capabilityBlocked(state, inv, 'play')) return '当前效果禁止你打出卡牌'
    // Phase 5（5c-20）：条目的同名字段优先（迁移后可删旧 DSL 条目），读点只有一个。
    const entry = def?.code ? registeredEntry(def.code) : null
    const restriction = entry?.playRestriction ?? EFFECTS[def?.code]?.playRestriction
    if (restriction === 'noReadyEnemy'
      && state.enemies.some(enemy => enemy.location === inv.location && !enemy.exhausted && !enemy.defeated)) {
      return '你所在地点有处于重整状态的敌人'
    }
    // 「团队仅限 N 张」的支援（04031 保护咒语）：场上所有调查员的副本合计不能超过 N。
    const teamLimit = entry?.teamLimit ?? EFFECTS[def?.code]?.teamLimit
    if (teamLimit) {
      const inPlay = state.investigators.reduce((sum, owner) =>
        sum + owner.assets.filter(asset => asset.code === def.code).length, 0)
      if (inPlay >= teamLimit) return `团队中已有 ${teamLimit} 张「${def.name || def.code}」在场`
    }
    return null
  }

  function jakeSkipsOpportunityAttack(state, inv, kind) {  if (!inv.assets.some(asset => assetPassiveData(asset.code)?.noOpportunityFirstAction)) return false
    if (!['move', 'investigate'].includes(kind)) return false
    if (inv.jakeFree?.round !== state.round) inv.jakeFree = { round: state.round, used: [] }
    if (inv.jakeFree.used.includes(kind)) return false
    inv.jakeFree.used.push(kind)
    return true
  }

  function canUseExtraEvade(state, inv) {
    if (!INVESTIGATOR_ABILITIES[inv.code]?.extraEvadeAction) return false
    if (investigatorTextBlanked(state, inv)) return false
    if (state.currentSeat !== inv.seat && state.phase === 'investigation') return false
    return inv.extraEvadeUsed !== state.turnSerial
  }

  function abilityOfMove(state, inv, move) {
    if (move.action !== 'ability') return null
    const card = controlledAbilityCard(inv, move.assetId)
    return assetEffect(inv, card)?.abilities?.[move.abilityIndex] || null
  }

  function actionKind(state, inv, move) {
    if (move.action === 'scenarioAction' || move.action === 'encounterAction') {
      const declared = move.actionKind || scenarioBehavior(state).actionKind?.(state, inv, move)
      if (declared) return declared
    }
    if (move.action === 'scenarioAction' && ['castFormula', 'concoctionAttack'].includes(move.rule)) return 'fight'
    if (move.action === 'scenarioAction' && move.rule === 'resignBeyond') return 'resign'
    if (move.action === 'scenarioAction' && ['parleyJazz', 'parleyPassenger'].includes(move.rule)) return 'parley'
    // 剧本自己的「探索」行动（探索牌库）与基础探索一样吃 04148 的探索专用行动。
    if (move.action === 'scenarioAction' && /explore/i.test(String(move.rule))) return 'explore'
    // 芬恩·爱德华兹的额外躲避行动按躲避结算（不引发借机攻击）。
    if (move.action === 'extraEvade') return 'evade'
    const source = move.action === 'play' ? EFFECTS[move.copyCode || move.cardId]
      : move.action === 'ability' ? assetEffect(inv, controlledAbilityCard(inv, move.assetId)) : null
    if (source?.noOpportunityAttack) return 'evade'
    // Phase 2：描述子化的「不引发借机攻击」事件卡（统一读点）。
    if (move.action === 'play' && cardPlayFlag(move.copyCode || move.cardId, 'noOpportunityAttack')) return 'evade'
    const actionEffect = move.action === 'play' ? playedEffect(move.copyCode || move.cardId)
      : move.action === 'ability' ? abilityOfMove(state, inv, move)?.effect : null
    if (actionEffect?.noOpportunityAttack) return 'evade'
    // Phase 5：描述子用 resolve 实现时没有 effect 数据体，「按哪种行动结算」写在 countsAs 上
    // （旧式能力写在 effect.kind 上，见「意志闪避」）。
    const ability = move.action === 'ability' ? abilityOfMove(state, inv, move) : null
    if (ability?.descriptor?.countsAs) return ability.descriptor.countsAs
    // 失落时代的卡牌能力在 effect.kind 里声明自己属于攻击/躲避，避免被当成普通行动引发借机攻击。
    return actionEffect?.kind || actionEffect?.type || move.action
  }

  function actionPreview(state, seat, move) {
    const inv = state.investigators[seat]
    if (!inv || state.pendingChoice || inHub(state)) return { actions: 0 }
    const ability = abilityOfMove(state, inv, move)
    const kind = actionKind(state, inv, move)
    const provoking = actionCost(state, inv, move, false) > 0 && !['fight', 'evade', 'resign', 'parley', 'parleyCultist', 'parleyLita'].includes(kind)
    const attacks = provoking ? enemiesEngagedWith(state, inv).filter(e => !e.exhausted && !(inv.onTheLam && !e.elite)
      && enemyCanOpportunityAttack(state, e)) : []
    const enemy = state.enemies.find(e => e.id === move.enemyId)
    const extraCost = move.action === 'parleyCultist' ? enemyDef(enemy?.code)?.parley?.cost || {}
      : move.action === 'freeAction' ? INVESTIGATOR_ABILITIES[inv.code]?.freeAction?.cost || {}
      : move.action === 'locationAbility' ? state.locations.find(l => l.id === move.locationId)?.ability?.cost || {}
      : move.action === 'parley' ? { resources: enemy?.parleyCost || 0 }
      : move.action === 'payDebt' ? { resources: 1 } : {}
    return { actions: actionCost(state, inv, move), resources: move.action === 'play' ? playCost(state, inv, cardDef(move.copyCode || move.cardId)) : extraCost.resources || ability?.cost?.resources || 0,
      clues: extraCost.clues || 0, discardHand: extraCost.discardHand || 0,
      groupClues: move.action === 'drawCultist' ? 2 * state.numInvestigators : move.action === 'advanceAct' ? (state.acts[state.actIndex]?.objective?.perInvestigator || 0) * state.numInvestigators : 0,
      uses: ability?.cost?.uses || 0, exhaust: !!ability?.cost?.exhaust,
      opportunityAttacks: attacks.map(e => ({ id: e.id, name: e.name, damage: e.damage, horror: e.horror })),
      note: attacks.length ? '借机攻击发生在行动效果之前；伤害数值为当前基础值，反应或强制效果可能改变结果。' : undefined }
  }

  function consumeStartingAdjustments(state, inv, events = null) {
    const adjustment = state.campaign.startingAdjustments?.[inv.seat]
    if (!adjustment) return null
    if (adjustment.resources) {
      inv.resources = Math.max(0, inv.resources + adjustment.resources)
      if (events !== null) info(state, events, `${inv.name} 因幕间结算以 ${inv.resources} 点资源开始本关（${adjustment.resources}）。`)
    }
    if (adjustment.clues) {
      inv.clues = Math.max(0, inv.clues + adjustment.clues)
      if (events !== null) info(state, events, `${inv.name} 因幕间结算额外获得 ${adjustment.clues} 个线索。`)
    }
    delete state.campaign.startingAdjustments[inv.seat]
    return adjustment
  }

  function consumeMulliganBlock(state) {
    const blocked = state.campaign.ruleFlags?.cannotMulliganOnce === true
    if (blocked) delete state.campaign.ruleFlags.cannotMulliganOnce
    return blocked
  }

  function runMulligans(state, events) {
    // 幕间可能禁止下一场冒险换起始手牌（例如没有汽油 / 没有粉笔）。
    const noMulligan = consumeMulliganBlock(state)
    for (const inv of state.investigators) {
      if ((noMulligan || inv.cannotMulligan) && !INVESTIGATOR_ABILITIES[inv.code]?.openingHandSize) {
        info(state, events, `${inv.name} 必须保留起始手牌（幕间效果禁止换牌）。`)
        delete inv.cannotMulligan
        continue
      }
      delete inv.cannotMulligan
      if (INVESTIGATOR_ABILITIES[inv.code]?.openingHandSize) {
        inv.beneath ||= []
        while (inv.beneath.length < 5) {
          const eligible = inv.hand.map((code, index) => ({ code, index })).filter(item =>
            !registeredEntry(item.code)?.copiesBeneathEvents && cardDef(item.code)?.type === 'event')
          if (!eligible.length) break
          const answer = requestChoice(state, { kind: 'openingHand', source: 'sefinaBeneath', seat: inv.seat, canSkip: true,
            prompt: '选择至多5张非「彩绘世界」事件放在赛菲娜下方，或完成选择。',
            options: [{ id: 'done', label: '完成下方事件选择' },
              ...eligible.map(item => ({ id: String(item.index), cardCode: item.code, label: cardName(item.code) }))] })
          if (answer === 'done') break
          inv.beneath.push(inv.hand.splice(Number(answer), 1)[0])
        }
        const returned = []
        while (inv.hand.length > 8) {
          const answer = requestChoice(state, { kind: 'openingHand', source: 'sefinaKeepEight', seat: inv.seat,
            prompt: `选择返回牌库的牌（还需返回 ${inv.hand.length - 8} 张）。`,
            options: inv.hand.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })) })
          returned.push(inv.hand.splice(Number(answer), 1)[0])
        }
        inv.deck = shuffle([...inv.deck, ...returned], () => randomValue(state))
        info(state, events, `${inv.name} 将 ${inv.beneath.length} 张事件放在下方并保留8张起始手牌；不能调度。`)
        continue
      }
      const held = []
      while (true) {
        const options = [{ id: 'done', label: held.length ? '确认换牌' : '保留起始手牌' }, ...inv.hand.map((code, i) => ({ id: String(i), label: '换掉：' + cardName(code) }))]
        const answer = requestChoice(state, { kind: 'mulligan', source: 'opening-hand', seat: inv.seat, prompt: '选择要更换的起始手牌，完成后确认。', options, canSkip: true })
        if (answer === 'done') break
        held.push(inv.hand.splice(Number(answer), 1)[0])
      }
      drawOpeningHand(state, inv)
      inv.deck = shuffle([...inv.deck, ...held], () => randomValue(state))
      info(state, events, `${inv.name} 完成起始换牌（更换 ${held.length} 张）。`)
      if (INVESTIGATOR_ABILITIES[inv.code]?.deckbuildingRoles && !inv.role) {
        chooseLolaRole(state, inv, 'lolaOpeningRole', '选择罗拉·海斯的初始角色。', true)
        info(state, events, `${inv.name} 选择了${CLASS_NAMES[inv.role] || inv.role}角色。`)
      }
    }
    scenarioBehavior(state).afterMulligan?.(state, events, { discardRandomFromHand, info })
    state.currentSeat = chooseTurn(state)
    state.turnSeat = state.currentSeat
    phaseBeginningWindow(state, events)
    turnBeginningWindow(state, events)
  }

  function useGoldPocketWatch(state, timing, phase, events) {
    // Phase 5（5a-32）：「黄金怀表」这类「移除自身来跳过/重复阶段」的支援由条目级 skipOrRepeatPhase 声明。
    const holder = aliveInvestigators(state).find(inv => inv.assets.some(asset => registeredEntry(asset.code)?.skipOrRepeatPhase))
    if (!holder) return false
    const asset = holder.assets.find(item => registeredEntry(item.code)?.skipOrRepeatPhase)
    const verb = timing === 'begin' ? '跳过' : '重复'
    const answer = requestChoice(state, { kind: 'reaction', source: asset.id, seat: holder.seat, canSkip: true,
      prompt: `黄金怀表：是否从游戏中移除它，${verb}${phase === 'investigation' ? '调查' : phase === 'enemy' ? '敌人' : phase === 'upkeep' ? '重整' : '神话'}阶段？`,
      options: [{ id: 'skip', label: '保留黄金怀表' }, { id: 'trigger', label: `${verb}该阶段` }] })
    if (answer !== 'trigger') return false
    leaveAsset(state, holder, asset, events)
    asset.removedFromGame = true
    state.removedFromGame ||= []
    state.removedFromGame.push(asset.code)
    info(state, events, `${holder.name} 从游戏中移除「黄金怀表」，${verb}本阶段。`)
    return true
  }

  function resolveCallOfTheUnknown(state, inv, events) {
    for (const threat of inv.threat.filter(item => getThreatEffect(item)?.turnForced === 'callOfTheUnknown').slice()) {
      // 本回合开始之后才入场的弱点没有指定地点，不在当回合结算。
      if (!threat.callTarget) continue
      const finished = inv.investigatedTurnRound === state.round
        && (inv.investigatedThisTurn || []).includes(threat.callTarget)
      if (finished) continue
      removeOne(inv.threat, threat)
      inv.deck = shuffle([...inv.deck, threat.code], () => randomValue(state))
      info(state, events, `「${cardName(threat.code)}」：${inv.name} 未能调查所选地点，受到 2 点恐惧并洗回牌库。`)
      applyHorror(state, inv, 2, events)
      if (inv.defeated || state.status !== 'playing') return
    }
  }

  return { decisionSeat, actingSeats, seatLocalMove, hubActingSeats, initialHubScenarioMoves, hubInvestigatorChoices, initialHubPreparation, hubStartingDeckReady, validateHubMove, autoHubMove, decisionSeed, moveCost, cardPlayBlockedReason, jakeSkipsOpportunityAttack, canUseExtraEvade, abilityOfMove, actionKind, actionPreview, consumeStartingAdjustments, consumeMulliganBlock, runMulligans, useGoldPocketWatch, resolveCallOfTheUnknown }
}
