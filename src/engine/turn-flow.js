// turn-flow.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 调查员回合内的推进与代价：advanceInvestigator（行动/结束回合的推进）、
// 打出费用与折扣、旧印结算、反应规格与条件评估、以及「支付/选择」的共用小函数。
export function createTurnFlow(deps) {
  const {
    campaignState,
    ALL_CARDS,
    EFFECTS,
    INVESTIGATOR_ABILITIES,
    LITA_CHANDLER_CODE,
    abilityApi,
    abilityOfMove,
    abilityShim,
    actionKind,
    advanceAct,
    aliveInvestigators,
    applyHorror,
    assetEffect,
    autoEngageAt,
    availableThreatAbilities,
    beginInvestigationPhase,
    blanksTraits,
    canDiscardFromHand,
    canSpendClues,
    cardDef,
    cardKeyword,
    cardName,
    cardPlayFlag,
    controlledAbilityCard,
    createAbilityRulesApi,
    damageEnemy,
    discardableHandCards,
    disengageEnemy,
    elderSignDescriptor,
    enemyDef,
    expireEffects,
    getThreatEffect,
    groupClues,
    hiddenRule,
    info,
    investigateExtraActionsFor,
    investigatorTextBlanked,
    isWeaknessCode,
    leaveAsset,
    legacyReactionLimit,
    legalMoves,
    locationExists,
    newEnemyId,
    nextSeat,
    playCostDelta,
    readyUmordhoth,
    registeredEntry,
    relicDiscountLocation,
    removeOne,
    requestChoice,
    resolveCallOfTheUnknown,
    runBetweenInvestigationPhases,
    runThreatEndTurn,
    scenarioBehavior,
    scenarioRuntime,
    spendClues,
    campaignPlayCostPreview,
    tokenLabel,
    turnBeginningWindow,
    unpaidExtraActionThreats,
    useGoldPocketWatch,
  } = deps

  function tryAquinnahRedirect(state, enemy, inv, events, extraDamage = 0, extraHorror = 0) {
    // Phase 5（5a-31）：会让盟友文字空白化的威胁用 BLANKS_TRAITS 判断。
    if (inv.threat.some(item => blanksTraits(item.code).includes('ally'))) return false
    // Phase 5（5b-8）：「安奎娜」这类「横置并放 1 点恐惧，把这次攻击的伤害转给另一个敌人」由条目级标记声明。
    const aquinnah = inv.assets.find(asset => registeredEntry(asset.code)?.redirectAttackToAsset && !asset.exhausted)
    if (!aquinnah) return false
    const candidates = state.enemies.filter(item => item.location === inv.location && item.id !== enemy.id)
    if (!candidates.length) return false
    const answer = requestChoice(state, { kind: 'reaction', source: aquinnah.id, seat: inv.seat, prompt: '是否横置安奎娜并放置 1 点恐惧，将这次攻击的伤害转移给另一个敌人？', canSkip: true, options: [{ id: 'skip', label: '正常承受攻击' }, { id: 'trigger', label: '转移伤害' }] })
    if (answer !== 'trigger') return false
    aquinnah.exhausted = true
    aquinnah.horror = (aquinnah.horror || 0) + 1
    if ((aquinnah.horror || 0) >= (cardDef(aquinnah.code)?.sanity || Infinity)) {
      leaveAsset(state, inv, aquinnah)
      inv.discard.push(aquinnah.code)
      info(state, events, `「安奎娜」恐惧达到上限并被弃掉。`)
    }
    const targetId = requestChoice(state, { kind: 'target', source: aquinnah.id, seat: inv.seat, prompt: '选择另一个敌人承受伤害。', options: candidates.map(item => ({ id: item.id, label: item.name })) })
    const target = candidates.find(item => item.id === targetId)
    if (target) {
      damageEnemy(state, target, enemy.damage + extraDamage, inv.seat, events)
      info(state, events, '安奎娜将「' + enemy.name + '」的 ' + enemy.damage + ' 点伤害转移给「' + target.name + '」。')
    }
    if (enemy.horror + extraHorror) applyHorror(state, inv, enemy.horror + extraHorror, events)
    return true
  }

  function codexSealedElderSign(state, inv, seat, events) {
    const codex = inv.assets.find(asset => (EFFECTS[asset.code]?.substituteSealedElderSign
      || registeredEntry(asset.code)?.substituteSealedElderSign)
      && (state.chaos?.sealed || []).some(entry => entry.source === asset.id && entry.token === 'eldersign'))
    if (!codex) return null
    const answer = requestChoice(state, { kind: 'reaction', source: codex.id, seat, canSkip: true,
      prompt: '古代抄本：是否弃掉它并结算封印的旧印标记？',
      options: [{ id: 'skip', label: '照常揭示混乱袋' }, { id: 'trigger', label: '结算封印的旧印' }] })
    if (answer !== 'trigger') return null
    leaveAsset(state, inv, codex, events)
    inv.discard.push(codex.code)
    info(state, events, `${inv.name} 弃掉「${cardName(codex.code)}」，改为结算封印的 ${tokenLabel('eldersign')}。`)
    return 'eldersign'
  }

  function elderSignEffect(state, inv, events = []) {
    // 剧本可以整体替换旧印效果（如 04244 伊斯人身体：+2、抽 1 张）。
    const scenarioEffect = scenarioBehavior(state).elderSign?.(state, inv, scenarioRuntime(state, events))
    if (scenarioEffect) return scenarioEffect
    if (investigatorTextBlanked(state, inv)) return { delta: 0 }
    // 能力层：调查员的旧印效果写在 card-abilities.js（kind: 'elderSign'），
    // 与卡牌能力共用同一套描述子、同样可被测试与审计枚举。
    const registered = elderSignDescriptor(inv.code)
    if (registered) {
      const ctx = {
        state, seat: inv.seat, inv, source: { investigator: inv.seat, code: inv.code },
        descriptor: registered, window: 'eldersign', context: {}, events,
        api: abilityApi(state, events),
      }
      return registered.resolve?.(ctx) || { delta: 0 }
    }
    // 21 位可玩调查员的旧印全部迁移到能力层（src/cards/card-abilities.js）；
    // 未登记的新调查员在补描述子之前按默认 +1 结算。
    return { delta: 1 }
  }

  function spawnStoryEnemy(state, code, locationId, stats = {}, extra = {}, events = []) {
    if (!locationExists(state, locationId)) return null
    const enemy = {
      id: newEnemyId(state), code, originalCode: code,
      name: stats.name || code,
      fight: stats.fight ?? 0, evade: stats.evade ?? 0, health: stats.health ?? 1,
      damage: stats.damage ?? 0, horror: stats.horror ?? 0,
      hunter: !!stats.hunter, retaliate: !!stats.retaliate, alert: !!stats.alert,
      elite: !!stats.elite, aloof: !!stats.aloof, massive: !!stats.massive,
      traits: [...(stats.traits || [])], victory: stats.victory || 0, vengeance: 0,
      damageTaken: 0, exhausted: false, doom: 0, engagedSeat: null, location: locationId,
      ...extra,
    }
    state.enemies.push(enemy)
    scenarioBehavior(state).enemySpawned?.(state, enemy, scenarioRuntime(state, events))
    autoEngageAt(state, locationId, events)
    return enemy
  }

  function processPlayerEnemyEntry(state, enemy, events, spawned = false) {  const attachments = state.playerLocationAttachments || []
    // Phase 5（5a-26）：「藏身处」这类给敌人 aloof 的附属由条目级 grantsHidingSpot 声明。
    enemy.hidingSpotAloof = !enemy.elite
      && attachments.some(item => registeredEntry(item.code)?.grantsHidingSpot && item.location === enemy.location)
    enemy.aloof = !!enemy.printedAloof || enemy.hidingSpotAloof
    // Phase 5（5a-27）：「伏击」这类敌人入场即触发伤害的附属由条目级 ambushAttachment 声明。
    const ambush = spawned && attachments.find(item => registeredEntry(item.code)?.ambushAttachment && item.location === enemy.location)
    if (ambush) {
      removeOne(attachments, ambush)
      state.investigators[ambush.ownerSeat]?.discard.push(ambush.code)
      enemy.defeatedBy = ambush.ownerSeat
      damageEnemy(state, enemy, 2, ambush.ownerSeat, events)
    }
    if (!state.enemies.includes(enemy)) return
    const snare = attachments.find(item => registeredEntry(item.code)?.snareAttachment && item.location === enemy.location && !enemy.elite)
    if (snare) {
      removeOne(attachments, snare)
      enemy.exhausted = true
      disengageEnemy(state, enemy)
      enemy.snareTrap = snare
    }
  }

  function groupPayment(state, amount, location, events) {
    const payers = aliveInvestigators(state).filter(inv => canSpendClues(state, inv)).filter(inv => !location || inv.location === location)
    if (groupClues(state, location) < amount) throw new Error('符合地点条件的共同线索不足')
    let remaining = amount
    for (let i = 0; remaining; i++) {
      const inv = payers[i % payers.length]
      if (!inv.clues) continue
      const min = 1
      const max = Math.min(remaining, inv.clues)
      const options = Array.from({ length: max - min + 1 }, (_, offset) => ({ id: String(min + offset), label: `支付 ${min + offset} 个线索` }))
      const round = Math.floor(i / payers.length) + 1
      const answer = requestChoice(state, { kind: 'payment', source: 'group-clues', seat: inv.seat,
        prompt: `第 ${round} 轮分摊 · 共同支付还需 ${remaining} 个线索，请决定个人贡献。`, options,
        payment: { required: amount, remaining, paid: amount - remaining, round, min, max, available: inv.clues } })
      const paid = Number(answer)
      spendClues(state, inv, paid)
      remaining -= paid
      info(state, events, `${inv.name} 支付 ${paid} 个线索。`)
    }
  }

  function addVictory(state, enemy, events) {
    const originalCode = enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code
    const vengeance = enemy.vengeance || enemyDef(enemy.code)?.vengeance || 0
    // 复仇：带复仇点数的敌人被击败时同样进入胜利区（即使没有胜利点）。
    if (Object.hasOwn(ALL_CARDS[originalCode] || {}, 'victory') || enemy.victory > 0 || vengeance > 0 || enemy.uniqueCultist) {
      if (!state.victoryDisplay.some(card => card.id === enemy.id)) state.victoryDisplay.push({
        id: enemy.id, code: enemy.code, originalCode, victory: enemy.victory || 0,
        ...(vengeance ? { vengeance } : {}),
      })
    } else if (isWeaknessCode(enemy.code)) {
      const owner = state.investigators[enemy.bearerSeat]
      if (!owner) throw new Error('弱点敌人缺少牌组归属')
      owner.discard.push(enemy.code)
    } else state.encounterDiscard.push(enemy.code)
    if (enemy.victory) {
      state.victory += enemy.victory
      info(state, events, `💥 「${enemy.name}」被击败了！胜利点 +${enemy.victory}（累计 ${state.victory}）。`)
    }
    if (vengeance) info(state, events, `🐍 「${enemy.name}」带有 ${vengeance} 点复仇。`)
    if (enemy.uniqueCultist && !state.cultistsInVictory.includes(enemy.code)) {
      state.cultistsInVictory.push(enemy.code)
      info(state, events, `🕵️ 「${enemy.name}」被盘问/击败，加入胜利区（${state.cultistsInVictory.length}/6）。`)
    }
  }

  function descriptorReactionSpec(descriptor, when) {
    const flags = descriptor.criteria && typeof descriptor.criteria === 'object' && !Array.isArray(descriptor.criteria)
      ? descriptor.criteria
      : {}
    return {
      ...flags,
      id: descriptor.id || undefined,
      when,
      cost: descriptor.cost || {},
      limit: legacyReactionLimit(descriptor.limit),
      effect: descriptor.effect,
      prompt: null,
      resolve: descriptor.resolve || null,
      criteriaFn: typeof descriptor.criteria === 'function' ? descriptor.criteria : null,
      descriptor,
    }
  }

  function cannotPlayTypes(inv) {
    const set = new Set()
    for (const t of inv.threat) {
      const th = getThreatEffect(t)
      if (th && th.cannotPlay) for (const k of th.cannotPlay) set.add(k)
    }
    return set
  }

  function chooseEnemyFrom(state, seat, candidates, source) {
    if (candidates.length === 1) return candidates[0]
    const id = requestChoice(state, { kind: 'enemy', source, seat, prompt: '选择敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })
    return candidates.find(enemy => enemy.id === id)
  }

  function sealRevealedChaosToken(state, token, source) {
    const revealed = state.chaos?.revealed || []
    const index = revealed.lastIndexOf(token)
    if (index < 0) return false
    revealed.splice(index, 1)
    state.chaos.sealed ||= []
    state.chaos.sealed.push({ token, source })
    state.sealedTokens = state.chaos.sealed.map(entry => entry.token)
    return true
  }

  function discardHandTo(state, inv, keep, events) {
    while (inv.hand.length > keep) {
      const options = inv.hand.map((code, index) => ({ code, index }))
        .filter(item => !isWeaknessCode(item.code) && canDiscardFromHand(inv, item.code))
        .map(item => ({ id: String(item.index), label: cardName(item.code) }))
      if (!options.length) break
      const answer = requestChoice(state, { kind: 'discard', source: 'hand-limit', seat: inv.seat, prompt: `选择弃牌，保留至 ${keep} 张。`, options })
      const code = inv.hand.splice(Number(answer), 1)[0]
      inv.discard.push(code)
      info(state, events, `${inv.name} 弃掉了「${cardName(code)}」。`)
    }
  }

  function discardChosenCards(state, inv, count, events, source, requiredIcon = null) {
    let discarded = 0
    for (let i = 0; i < count && discardableHandCards(inv, requiredIcon).length; i++) {
      const answer = requestChoice(state, {
        kind: 'discard', source, seat: inv.seat, prompt: `选择要弃掉的手牌（还需 ${count - i} 张）。`,
        options: discardableHandCards(inv, requiredIcon)
          .map(({ code, index }) => ({ id: String(index), cardCode: code, label: cardName(code) })),
      })
      const code = inv.hand.splice(Number(answer), 1)[0]
      inv.discard.push(code)
      info(state, events, `${inv.name} 弃掉了「${cardName(code)}」。`)
      discarded++
    }
    return discarded
  }

  function advanceInvestigator(state, seat, events) {
    const inv = state.investigators[seat]
    if (inv && !inv.defeated && !inv.resigned) resolveCallOfTheUnknown(state, inv, events)
    if (inv && state.status !== 'playing') return
    if (inv && !inv.defeated && !inv.resigned && inv.actionsLeft <= 0
        && !inv.tomeActionUsed && !investigatorTextBlanked(state, inv) && INVESTIGATOR_ABILITIES[inv.code]?.extraTomeAction
        && legalMoves(state).some(move => tomeActionEligible(state, inv, move))) return
    if (inv) {
      runThreatEndTurn(state, inv, events)
      // 04031 保护咒语：回合结束时花费 1 资源，或弃掉它。
      for (const asset of [...inv.assets]) {
        const pay = registeredEntry(asset.code)?.forcedTurnEndPayOrDiscard
      ?? EFFECTS[asset.code]?.forcedTurnEndPayOrDiscard
        if (!pay) continue
        const answer = requestChoice(state, {
          kind: 'reaction', source: asset.code, seat: inv.seat, canSkip: true,
          prompt: `「${cardName(asset.code)}」：花费 ${pay} 资源，或弃掉它。`,
          options: [
            { id: 'pay', label: `花费 ${pay} 资源保留` },
            { id: 'discard', label: '弃掉它' },
          ],
        })
        if (answer === 'pay' && (inv.resources || 0) >= pay) {
          inv.resources -= pay
          info(state, events, `💸 ${inv.name} 为「${cardName(asset.code)}」支付 ${pay} 资源。`)
        } else {
          inv.discard.push(asset.code)
          leaveAsset(state, inv, asset, events)
          info(state, events, `🗑️ ${inv.name} 弃掉了「${cardName(asset.code)}」。`)
        }
      }
      scenarioBehavior(state).turnEnded?.(state, inv, scenarioRuntime(state, events))
      for (const asset of inv.assets) {
        const heal = assetEffect(inv, asset)?.healSelfHorrorAfterTurn || 0
        if (heal && (asset.horror || 0) > 0) asset.horror = Math.max(0, asset.horror - heal)
      }
      for (const code of inv.hand.slice()) {
        const horror = registeredEntry(code)?.endTurnInHandHorror ?? EFFECTS[code]?.endTurnInHandHorror
        if (!horror) continue
        info(state, events, `🌑 ${inv.name} 回合结束时揭示「${cardName(code)}」，受到 ${horror} 恐惧，卡牌留在手中。`)
        applyHorror(state, inv, horror, events)
      }
      inv.tomeActionUsed = true
      inv.ignoreChaosThisTurn = false
    }
    // 回合结束：本回合内生效的效果到期（A1 的统一过期点）。
    for (const effect of expireEffects(state, 'endOfTurn')) {
      if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（回合结束）。`)
    }
    const next = nextSeat(state, seat)
    if (next != null && next !== seat) {
      state.currentSeat = next
      state.phase = 'investigation'
      // 乌默尔多斯：每位调查员回合结束时重整。
      readyUmordhoth(state, events)
      turnBeginningWindow(state, events)
      return
    }
    readyUmordhoth(state, events)
    if (useGoldPocketWatch(state, 'end', 'investigation', events)) {
      beginInvestigationPhase(state, events, true)
      return
    }
    runBetweenInvestigationPhases(state, events)
    if (state.status !== 'playing') return
    while (useGoldPocketWatch(state, 'begin', 'investigation', events)) {
      runBetweenInvestigationPhases(state, events)
      if (state.status !== 'playing') return
    }
    beginInvestigationPhase(state, events)
  }

  function scenarioResignAvailable(state) {
    if (state.scenario?.resignAnywhere) return true
    if (state.locations.some(loc => loc.resign)) return true
    return [...(state.acts || []), ...(state.agendas || [])]
      .some(card => /(^|\n)\s*(Resign|撤退)[.。]/i.test(card.text || ''))
  }

  function playCost(state, inv, def) {
    const discount = inv.location === 'easttown' && def.type === 'asset' && (def.traits || []).some(trait => trait.toLowerCase() === 'ally') ? 2 : 0
    const factions = def.factions || [def.klass, def.klass2, def.klass3].filter(Boolean)
    const lola = inv.lolaDiscount?.round === state.round && inv.lolaDiscount?.turnSeat === state.currentSeat
      && factions.includes(inv.lolaDiscount.role) ? inv.lolaDiscount.amount : 0
    // Phase 6：这两项都是「打出折扣」的通用通道（名字里的战役前缀是历史遗留的 state 字段）。
    const cardDiscount = campaignState.playDiscount(inv)
    const playDiscount = inv.playDiscount || 0
    const threatIncrease = inv.threat.reduce((sum, threat) =>
      sum + (getThreatEffect(threat)?.playCostIncrease || 0), 0)
    const loc = state.locations.find(location => location.id === inv.location)
    const locationIncrease = loc?.playCostIncrease || 0
    // 04142 珍品店：位于此处时打出每个 [[遗物]] 支援的费用 -2。
    const relicDiscount = loc && relicDiscountLocation(loc.originalCode || loc.code)
      && def.type === 'asset' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'relic') ? 2 : 0
    const charles = itemDiscountAtLocation(state, inv, def)
    // 能力层修正：例如 03142「黑玛瑙扣环」在手牌中时其他手牌 +1 费用（负数为折扣）。
    const abilityLayer = playCostDelta(state, inv, def.code)
    return Math.max(0, (def.cost || 0) - discount - lola - cardDiscount - playDiscount + threatIncrease + locationIncrease - relicDiscount - charles + abilityLayer)
  }

  function itemDiscountAtLocation(state, inv, def) {
    if (!def || def.type !== 'asset') return 0
    if (!(def.traits || []).some(trait => String(trait).toLowerCase() === 'item')) return 0
    const holder = state.investigators.find(other => other.location === inv.location
      && other.assets.some(asset => asset.itemDiscountAtLocation
        && asset.itemDiscountAtLocation.round === state.round
        && asset.itemDiscountAtLocation.phase === state.phase))
    if (!holder) return 0
    const asset = holder.assets.find(item => item.itemDiscountAtLocation
      && item.itemDiscountAtLocation.round === state.round && item.itemDiscountAtLocation.phase === state.phase)
    return asset?.itemDiscountAtLocation?.amount || 1
  }

  function consumeItemDiscountAtLocation(state, inv) {
    for (const other of state.investigators.filter(item => item.location === inv.location)) {
      for (const asset of other.assets.filter(item => item.itemDiscountAtLocation)) {
        if (asset.itemDiscountAtLocation.round === state.round && asset.itemDiscountAtLocation.phase === state.phase) {
          delete asset.itemDiscountAtLocation
          return true
        }
      }
    }
    return false
  }

  function charlesPayCandidate(state, inv, cost) {
    return state.investigators.find(other => other !== inv && other.location === inv.location
      && !other.defeated && !other.resigned && other.resources >= cost
      && other.assets.some(asset => asset.itemDiscountAtLocation)) || null
  }

  function tomeActionEligible(state, inv, move) {
    if (!INVESTIGATOR_ABILITIES[inv.code]?.extraTomeAction || investigatorTextBlanked(state, inv) || inv.tomeActionUsed
        || state.phase !== 'investigation' || state.currentSeat !== inv.seat) return false
    let source
    if (move.action === 'ability') {
      source = controlledAbilityCard(inv, move.assetId)
      // Phase 5：从牌桌使用的能力可能是旧 DSL 条目，也可能是能力层描述子（abilityShim 折叠后
      // 与 legalMoves 同序）；「书籍额外行动」只能用于真正消耗行动的能力。
      const ability = assetEffect(inv, source)?.abilities?.[move.abilityIndex]
      if (!ability || ability.cost?.action === false || ability.cost?.action === 0) return false
    } else if (move.action === 'purgeThreat') {
      source = inv.threat.find(item => item.id === move.threatId)
      if (!getThreatEffect(source)?.purgeAbility) return false
    } else return false
    return (cardDef(source?.code)?.traits || []).some(trait => trait.toLowerCase() === 'tome')
  }

  function actionCost(state, inv, move, applyTome = true) {
    if (['endTurn', 'advanceAct', 'shortcutMove', 'extraEvade'].includes(move.action)) return 0
    if (move.action === 'freeAction') return INVESTIGATOR_ABILITIES[inv.code]?.freeAction?.actionCost || 0
    let cost = 1
    const investigateLoc = state.locations.find(loc => loc.id === (move.locationId || inv.location))
    // Phase 5（5a-11）：某些地点调查要多花行动，映射在卡号规则数据里。
    if (move.action === 'investigate') cost += investigateExtraActionsFor(investigateLoc?.originalCode || investigateLoc?.code)
    // 04145「屋中无人」：附属地点调查额外 +1 行动（剧本往地点上写计数）。
    if (move.action === 'investigate' && investigateLoc?.investigateExtraActions) {
      cost += investigateLoc.investigateExtraActions
    }
    if (move.action === 'searchIzzie') cost = 2
    if (move.action === 'hiddenAction') cost = hiddenRule(state, move.cardId)?.discard?.actions ?? 1
    if (move.action === 'scenarioAction') cost = scenarioBehavior(state).actions?.(state, inv).find(m => m.rule === move.rule && !m.reason)?.actions ?? 1
    if (move.action === 'encounterAction') cost = scenarioBehavior(state).encounterActions?.(state, inv).find(m => m.rule === move.rule && !m.reason)?.actions ?? 1
    let kind = actionKind(state, inv, move)
    if (move.action === 'discardThreat') {
      const threat = availableThreatAbilities(state, inv).find(item => item.id === move.threatId)
      cost = getThreatEffect(threat)?.discardCost?.action ?? 1
    }
    if (move.action === 'ability') {
      const ability = abilityOfMove(state, inv, move)
      cost = ability?.cost?.action === false ? 0 : typeof ability?.cost?.action === 'number' ? ability.cost.action : 1
      // Phase 5：描述子可以用 countsAs 声明「按哪种行动结算」（旧式能力把这件事写在 effect.kind 上，
      // 例如「意志闪避」按 evade 结算、不引发借机攻击）。
      kind = ability?.descriptor
        ? (ability.descriptor.countsAs || ability.descriptor.kind)
        : (ability?.effect?.kind || ability?.effect?.type)
    }
    // fast 有三个来源：卡面 EFFECTS、描述子的 fast 字段（cardPlayFlag）、
    // 以及 C2 的 add:keyword 授予（卡在运行期获得"快速"）。三处汇合在 actionCost 一处。
    if (move.action === 'play' && (cardPlayFlag(move.copyCode || move.cardId, 'fast')
      || cardKeyword(state, inv, move.copyCode || move.cardId, 'fast')
      || campaignPlayCostPreview(state, inv, move.copyCode || move.cardId)?.noAction)) cost = 0
    if (cost) cost += unpaidExtraActionThreats(state, inv, kind).length
    if (applyTome && cost > 0 && tomeActionEligible(state, inv, move)) cost--
    return cost
  }

  function canParleyCultist(state, inv, cost) {
    if (!cost) return false
    if (cost.clues && !canSpendClues(state, inv)) return false
    if (cost.clues && inv.clues < cost.clues) return false
    if (cost.resources && inv.resources < cost.resources) return false
    if (cost.discardHand && inv.hand.filter(code => !isWeaknessCode(code) && canDiscardFromHand(inv, code)).length < cost.discardHand) return false
    return true
  }

  function litaControlled(state, seat = null) {
    return state.investigators.some(inv => !inv.defeated && !inv.resigned
      && (seat == null || inv.seat === seat) && inv.assets.some(asset => asset.code === LITA_CHANDLER_CODE))
  }

  function litaUncontrolled(state, locationId = null) {
    return state.actIndex === scenarioBehavior(state).litaParleyActIndex && !litaControlled(state)
      && (state.storyAssets || []).some(asset => asset.code === LITA_CHANDLER_CODE && asset.controllerSeat == null
        && (locationId == null || asset.location === locationId))
  }

  function unique(arr) {
    return [...new Set(arr)]
  }

  function evaluateCriteria(...args) { return createAbilityRulesApi().evaluateCriteria(...args) }

  function playConditionHelpers(...args) { return createAbilityRulesApi().playConditionHelpers(...args) }

  return { tryAquinnahRedirect, codexSealedElderSign, elderSignEffect, spawnStoryEnemy, processPlayerEnemyEntry, groupPayment, addVictory, descriptorReactionSpec, cannotPlayTypes, chooseEnemyFrom, sealRevealedChaosToken, discardHandTo, discardChosenCards, advanceInvestigator, scenarioResignAvailable, playCost, itemDiscountAtLocation, consumeItemDiscountAtLocation, charlesPayCandidate, tomeActionEligible, actionCost, canParleyCultist, litaControlled, litaUncontrolled, unique, evaluateCriteria, playConditionHelpers }
}
