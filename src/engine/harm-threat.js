// harm-threat.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 伤害 / 恐惧 / 威胁区 / 击败与淘汰：assignHarm 是唯一承伤入口。
// 读点：combat 与 api 的伤害接口、威胁区的强制效果、弱点与淘汰判定。
export function createHarmThreat(deps) {
  const {
    ALL_TREACHERIES,
    EFFECTS,
    activeHiddenRules,
    aliveInvestigators,
    all,
    applyDamage,
    assetCapacityValue,
    assetEffect,
    assetPassiveData,
    autoEngageAt,
    capabilityBlocked,
    captureTableState,
    cardDef,
    cardName,
    chooseInvestigator,
    damageEnemy,
    defeatEnemy,
    discardHiddenCard,
    disengageEnemy,
    doInvestigate,
    drawCards,
    enemyHealth,
    finishScenario,
    getMaxHealth,
    getMaxSanity,
    getStat,
    info,
    investigateBonus,
    investigatorMoveDestinations,
    isWeaknessCode,
    leaveAsset,
    locName,
    makeRuntime,
    performTest,
    placeCluesOnLocation,
    randomValue,
    reactionWindow,
    registeredEntry,
    relocateInvestigator,
    removeOne,
    requestChoice,
    resolveEffect,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    spendAction,
    triggerReaction,
    weaknessProfile,
  } = deps

  function hasTomeAsset(inv) {
    return inv.assets.some((a) => {
      const def = cardDef(a.code)
      return def && (def.traits || []).some((t) => t.toLowerCase() === 'tome')
    })
  }

  function getThreatEffect(cardOrCode) {
    if (cardOrCode && typeof cardOrCode === 'object' && cardOrCode.threatEffect) {
      return cardOrCode.threatEffect
    }
    const code = typeof cardOrCode === 'object' ? cardOrCode?.code : cardOrCode
    const profile = weaknessProfile(code)
    if (profile?.type === 'threat') return profile
    const t = ALL_TREACHERIES[code]
    if (t?.threatEffect) return t.threatEffect
    if (t && t.threat) return t.threat
    return null
  }

  function availableThreatAbilities(state, inv) {
    return state.investigators.filter(owner => !owner.defeated && !owner.resigned && owner.location === inv.location)
      .flatMap(owner => owner.threat.filter(card => owner.seat === inv.seat || getThreatEffect(card)?.sameLocationAction))
  }

  function assetsCannotReady(inv, round = null) {
    // 「蟒蛇」（04079）：下个补给阶段不能重整（标记写在调查员身上）。
    if (Number.isInteger(inv.tfaNoReadyRound) && (round == null || inv.tfaNoReadyRound === round)) return true
    return inv.threat.some(card => getThreatEffect(card)?.preventReady)
  }

  function drawBlocked(state, inv) {
    if (capabilityBlocked(state, inv, 'draw')) return true
    return (inv.threat || []).some(card => card.noDrawAction === true || getThreatEffect(card)?.noDrawAction === true)
  }

  function removeThreat(state, inv, threatCard, events) {
    removeOne(inv.threat, threatCard)
    const discard = ALL_TREACHERIES[threatCard.code] ? state.encounterDiscard : inv.discard
    discard.push(threatCard.code)
  }

  const HARM_STRATEGIES = Object.freeze(['distribute', 'self', 'assetsFirst', 'soakFirst', 'assetsOnly'])

  function assignHarm(state, inv, amount, kind, events, direct, assetsFirst = false, strategy = null) {
    if (strategy != null && !HARM_STRATEGIES.includes(strategy)) {
      throw new Error(`未知伤害分配策略 ${JSON.stringify(strategy)}（可选：${HARM_STRATEGIES.join(' / ')}）`)
    }
    if (strategy === 'self') return new Map([[inv, amount]])
    const preferAssets = assetsFirst || strategy === 'assetsFirst' || strategy === 'soakFirst' || strategy === 'assetsOnly'
    const assignments = new Map()
    const capacity = kind === 'damage' ? 'health' : 'sanity'
    // Allies such as Brother Xavier may soak harm dealt to other investigators at
    // their location (passive.assignHarmAtLocation).
    const soaks = direct ? [] : state.investigators
      .filter(other => other !== inv && !other.defeated && !other.resigned && other.location === inv.location)
      .flatMap(other => other.assets
        .filter(asset => assetEffect(other, asset)?.passive?.assignHarmAtLocation)
        .map(asset => ({ asset, owner: other })))
    for (let i = 0; i < amount; i++) {
      // 「时间尽头」允许把直接伤害/直接恐惧分配给自己，其余支援不能承接直接伤害。
      const directSoaks = direct
        ? inv.assets.filter(asset => assetPassiveData(asset.code)?.assignDirectHarm
          && assetCapacityValue(asset, capacity) > (asset[kind] || 0) + (assignments.get(asset) || 0))
        : []
      let assets = direct ? directSoaks
        : inv.assets.filter(asset => assetCapacityValue(asset, capacity) > (asset[kind] || 0) + (assignments.get(asset) || 0))
      // Phase 5（5b-7）：「沉静」与「redirectOneHorrorToSelf」也可以写在能力层条目上（读点走 assetEffect）。
      const mandatory = kind === 'horror' && assets.filter(asset => (EFFECTS[asset.code]?.composure || assetEffect(inv, asset)?.composure)
        || ((EFFECTS[asset.code]?.redirectOneHorrorToSelf || assetEffect(inv, asset)?.redirectOneHorrorToSelf) && !(assignments.get(asset) > 0)))
      if (mandatory?.length) assets = mandatory
      const candidates = assets.length || soaks.length
        ? requestChoice(state, { kind: 'assign-' + kind, source: 'harm', seat: inv.seat,
          prompt: `分配 1 点${kind === 'damage' ? '伤害' : '恐惧'}（剩余 ${amount - i}）。`,
          options: [...(preferAssets || mandatory?.length ? [] : [{ id: 'self', label: '由调查员承受' }]),
            ...assets.map(asset => ({ id: asset.id, label: cardName(asset.code) })),
            ...soaks.map(({ asset, owner }) => ({ id: asset.id, label: `${cardName(asset.code)}（${owner.name}）` }))] })
        : 'self'
      const recipient = candidates === 'self' ? inv
        : assets.find(item => item.id === candidates) || soaks.find(item => item.asset.id === candidates)?.asset
      assignments.set(recipient, (assignments.get(recipient) || 0) + 1)
    }
    return assignments
  }

  function triggerThreatForced(state, inv, when, events, depth = 0) {
    if (depth > 4 || inv.defeated || inv.resigned) return
    for (const t of inv.threat.slice()) {
      const th = getThreatEffect(t)
      const fx = th && th.forced && th.forced[when]
      if (fx) applyThreatForced(state, inv, t, fx, events, depth)
    }
  }

  function applyThreatForced(state, inv, t, fx, events, depth = 0) {
    if (fx.damage && !inv.defeated && !inv.resigned) {
      inv.damage += fx.damage
      info(state, events, `💥 「${cardName(t.code)}」强制：${inv.name} 受到 ${fx.damage} 点直接伤害。`)
      checkDefeated(state, inv.seat, events)
      if (!inv.defeated && !inv.resigned) triggerThreatForced(state, inv, 'onDamage', events, depth + 1)
    }
    if (fx.horror && !inv.defeated && !inv.resigned) {
      inv.horror += fx.horror
      info(state, events, `😱 「${cardName(t.code)}」强制：${inv.name} 受到 ${fx.horror} 点直接恐惧。`)
      checkDefeated(state, inv.seat, events)
      if (!inv.defeated && !inv.resigned) triggerThreatForced(state, inv, 'onHorror', events, depth + 1)
    }
  }

  function unpaidExtraActionThreats(state, inv, kind) {
    return inv.threat.filter(card => {
      const effect = getThreatEffect(card)
      return effect?.extraActionCost?.includes(kind) && card.extraActionPaidRound !== state.round
    })
  }

  function payActionCost(state, inv, kind, events) {
    if (state._actionPaid) return
    spendAction(state, inv)
    for (const threat of unpaidExtraActionThreats(state, inv, kind)) {
      spendAction(state, inv)
      threat.extraActionPaidRound = state.round
      info(state, events, `⏳ ${inv.name} 受「${cardName(threat.code)}」影响，本次${kind === 'move' ? '移动' : kind === 'fight' ? '攻击' : '躲避'}额外消耗 1 行动。`)
    }
  }

  function defeatAll(state, events) {
    for (const inv of state.investigators) {
      if (!inv.defeated && !inv.resigned) inv.defeated = true
    }
    info(state, events, '💀 调查队全军覆没……')
  }

  function eliminateInvestigator(state, inv, events) {
    for (const code of [...(inv.hiddenCards || [])]) discardHiddenCard(state, inv, code, events)
    // Phase 5（5a-19）：「被消除时离场」的支援由条目级 discardOnElimination 声明。
    for (const asset of inv.assets.filter(item => registeredEntry(item.code)?.discardOnElimination)) {
      leaveAsset(state, inv, asset, events)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
    }
    for (const eid of inv.engaged.slice()) {
      const enemy = state.enemies.find((e) => e.id === eid)
      if (enemy) disengageEnemy(state, enemy)
    }
    inv.engaged = []
    const handled = scenarioBehavior(state).investigatorEliminated?.(state, inv, inv.clues, scenarioRuntime(state, events))
    if (!handled) placeCluesOnLocation(state, inv, inv.clues, events)
  }

  function checkDefeated(state, seat, events) {
    const inv = state.investigators[seat]
    if (!inv || inv.defeated || inv.resigned) return
    const lethalHidden = activeHiddenRules(state, inv).find(item =>
      Number.isFinite(item.rule.killAtHorrorOverSanityMultiplier)
        && inv.horror > getMaxSanity(inv) * item.rule.killAtHorrorOverSanityMultiplier)
    if (lethalHidden) {
      inv.defeated = true
      inv.defeatCause = 'killed'
      if (state.campaign.investigators[inv.seat]) state.campaign.investigators[inv.seat].status = 'killed'
      eliminateInvestigator(state, inv, events)
      info(state, events, `${inv.name} 因隐私牌「${cardName(lethalHidden.code)}」退场并死亡。`)
      checkOutcome(state, events)
      return
    }
    let damageLethal = inv.damage >= getMaxHealth(inv)
    let horrorLethal = inv.horror >= getMaxSanity(inv)
      && scenarioBehavior(state).investigatorCanBeDefeated?.(state, inv, 'horror') !== false
    if (damageLethal || horrorLethal) {
      if (horrorLethal) {
        triggerReaction(state, inv.seat, 'wouldDefeatByHorror', events, {
          when: 'wouldDefeatByHorror', seat: inv.seat, location: inv.location,
        })
      }
      reactionWindow(state, 'wouldDefeat', {
        when: 'wouldDefeat', seat: inv.seat, location: inv.location,
        prompt: `${inv.name} 将要被击败`,
      }, events)
      damageLethal = inv.damage >= getMaxHealth(inv)
      horrorLethal = inv.horror >= getMaxSanity(inv)
        && scenarioBehavior(state).investigatorCanBeDefeated?.(state, inv, 'horror') !== false
      if (!damageLethal && !horrorLethal) return
    }
    if (damageLethal || horrorLethal) {
      inv.defeated = true
      inv.defeatCause = damageLethal && horrorLethal ? 'both' : damageLethal ? 'damage' : 'horror'
      eliminateInvestigator(state, inv, events)
      info(state, events, `💀 ${inv.name} 被击败了！`)
      checkOutcome(state, events)
    }
  }

  function checkOutcome(state, events) {
    if (state.status !== 'playing') return
    // 场景/密谋推进到尽头时由各自的 reveal 处理结局（resolutionChoice / agenda reveal）。
    // 这里只兜底处理「全体调查员均败退/撤退」的无结局情况（按剧本差异结算）。
    if (aliveInvestigators(state).length === 0) {
      finishScenario(state, 'noResolution', events)
    }
  }

  function disengageAll(state, seat, events) {
    const inv = state.investigators[seat]
    for (const enemyId of inv.engaged.slice()) {
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (enemy && canDisengage(state, inv, enemy)) disengageEnemy(state, enemy)
    }
    info(state, events, `${inv.name} 与所有敌人解除交战。`)
  }

  function canDisengage(state, inv, enemy) {
    return scenarioBehavior(state).canDisengage?.(state, inv, enemy) !== false
  }

  function targetedTest(state, seat, effect, events) {
    const targetSeat = chooseInvestigator(state, seat, effect.target || 'location')
    return performTest(state, seat, effect.skill || 'intellect', effect.difficulty ?? 2, { source: { label: '卡牌能力', name: effect.source ? cardName(effect.source) : '目标调查员：' + state.investigators[targetSeat].name, code: effect.source }, resolve: result => {
      const rt = makeRuntime(state, events)
      if (result.success) {
        if (effect.successEffect) resolveEffect(state, targetSeat, effect.successEffect, rt)
      } else if (effect.failEffect) {
        resolveEffect(state, targetSeat, effect.failEffect, rt)
      }
    } })
  }

  function investigateForResources(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc) return
    const skill = loc.investigateSkill || 'intellect'
    const difficulty = loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0)
    return performTest(state, seat, skill, difficulty, { source: { label: '调查以获取资源', name: loc.name, code: loc.originalCode || loc.code }, skillBonus: skill === 'intellect' ? investigateBonus(inv) : 0, resolve: r => {
      if (r.success) {
        const amount = effect.amount || 3
        if (scenarioBehavior(state).canGainResources?.(state, inv) !== false) inv.resources += amount
        info(state, events, `${inv.name} 调查成功，将发现线索改为获得 ${amount} 资源（当前 ${inv.resources}）。`)
        if (loc.fog) {
          loc.shroudMod = Math.max(0, (loc.shroudMod || 0) - 2); loc.fog = 0
          state.encounterDiscard.push(loc.fogCode || 'obscuringFog'); delete loc.fogCode
        }
        triggerReaction(state, seat, 'investigateSuccess', events, { location: loc.id, successBy: r.value - difficulty })
      } else {
        info(state, events, `${inv.name} 的调查失败，未获得资源。`)
        reactionWindow(state, 'investigateFail', { when: 'investigateFail', seat, location: loc.id, failedBy: Math.max(0, difficulty-r.value), prompt: '调查检定失败后' }, events)
      }
    } })
  }

  function dealDamageAll(state, seat, effect, events) {
    const inv = state.investigators[seat]
    let locId = inv.location
    if (effect.location === 'choice') {
      const options = [inv.location, ...((state.locations.find(item => item.id === inv.location)?.connections) || [])]
        .filter((id, index, arr) => arr.indexOf(id) === index && state.locations.some(item => item.id === id))
      locId = options.length === 1 ? options[0] : requestChoice(state, {
        kind: 'target', source: effect.source || 'deal-damage-all', seat, prompt: '选择要造成伤害的地点。',
        options: options.map(id => ({ id, label: locName(state, id) })),
      })
    }
    const enemies = state.enemies.filter(enemy => enemy.location === locId)
    ;(state._resolution?.events || events).push({ type: 'presentation', kind: 'blast', fx: effect.fx || 'blast', seat, location: locId,
      name: locName(state, locId), damage: effect.amount || 3, enemyIds: enemies.map(enemy => enemy.id),
      seats: effect.investigators ? aliveInvestigators(state).filter(item => item.location === locId).map(item => item.seat) : [],
      tableState: captureTableState(state, getStat, getMaxSanity) })
    for (const enemy of enemies.slice()) {
      if (!damageEnemy(state, enemy, effect.amount || 3, seat, events)) continue
      info(state, events, `💥 「${enemy.name}」受到 ${effect.amount || 3} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
    }
    if (effect.investigators) {
      for (const target of aliveInvestigators(state).filter(item => item.location === locId)) {
        info(state, events, `💥 ${target.name} 受到 ${effect.amount || 3} 点伤害。`)
        applyDamage(state, target, effect.amount || 3, events)
      }
    }
  }

  function dealDamageExhausted(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && enemy.exhausted)
    if (!candidates.length) { info(state, events, '这里没有已横置的敌人。'); return }
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'target', source: effect.source || 'deal-damage-exhausted', seat, prompt: '选择已横置的敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find(item => item.id === id)
    if (!damageEnemy(state, enemy, effect.amount || 2, seat, events)) return
    info(state, events, `💥 「${enemy.name}」受到 ${effect.amount || 2} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
  }

  function blankEnemy(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
    if (!candidates.length) { info(state, events, '这里没有可抹消的非精英敌人。'); return }
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'target', source: effect.source || 'blank-enemy', seat, prompt: '选择要抹消文本框的非精英敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find(item => item.id === id)
    enemy.textBlanked = { round: state.round, phase: state.phase }
    if (enemy.damageTaken >= enemyHealth(state, enemy)) { enemy.defeatedBy = seat; defeatEnemy(state, enemy, events) }
    else autoEngageAt(state, enemy.location, events)
    info(state, events, `📖 「${enemy.name}」的印刷文本被视为空白，直到本阶段结束。`)
  }

  function ignoreChaos(state, seat, effect, events) {
    const inv = state.investigators[seat]
    inv.ignoreChaosThisTurn = true
    info(state, events, `${inv.name} 本回合执行的所有技能检定不揭示混乱标记。`)
  }

  function returnAssetToHand(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const asset = effect.assetId ? inv.assets.find(item => item.id === effect.assetId) : null
    if (!asset) return
    leaveAsset(state, inv, asset)
    if (!asset.removedFromGame) inv.hand.push(asset.code)
    info(state, events, `${inv.name} 将「${cardName(asset.code)}」返回手牌。`)
  }

  function shuffleIntoEncounter(state, seat, effect, events) {
    const inv = state.investigators[seat]
    let candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite && !isWeaknessCode(enemy.code))
    if (state._reaction?.enemy && candidates.includes(state._reaction.enemy)) candidates = [state._reaction.enemy]
    if (!candidates.length) { info(state, events, '这里没有可洗回遭遇牌库的敌人。'); return }
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'target', source: effect.source || 'shuffle-enemy', seat, prompt: '选择要洗回遭遇牌库的敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find(item => item.id === id)
    removeOne(state.enemies, enemy)
    if (enemy.engagedSeat != null) {
      const target = state.investigators[enemy.engagedSeat]
      if (target) removeOne(target.engaged, enemy.id)
    }
    state.encounterDeck.push(enemy.code)
    state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
    info(state, events, `🌀 「${enemy.name}」被洗回遭遇牌库。`)
  }

  function moveHorrorToInvestigator(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const source = state.investigators[seat].threat.find(item => item.id === effect.threatId)
    if (source && (source.counters || 0) > 0 && effect.toSeat != null) {
      source.counters -= 1
      const target = state.investigators[effect.toSeat]
      if (target) { target.horror += 1; info(state, events, `😱 将 1 点恐惧移动到 ${target.name}。`); checkDefeated(state, target.seat, events) }
    }
  }

  function damagedTargetsAtLocation(state, seat) {
    const here = state.investigators[seat].location
    return aliveInvestigators(state).filter(owner => owner.location === here).flatMap(owner => [
      ...(owner.damage > 0 ? [{ id: `investigator:${owner.seat}`, name: owner.name, target: owner }] : []),
      ...owner.assets.filter(asset => asset.damage > 0 && (cardDef(asset.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally'))
        .map(asset => ({ id: `asset:${asset.id}`, name: cardName(asset.code), target: asset })),
    ])
  }

  function healDamageAtLocation(state, seat, amount, events) {
    const targets = damagedTargetsAtLocation(state, seat)
    if (!targets.length) return
    const id = targets.length === 1 ? targets[0].id : requestChoice(state, {
      kind: 'target', source: 'healDamageAtLocation', seat, prompt: '选择同地点的调查员或盟友，治疗伤害。',
      options: targets.map(target => ({ id: target.id, label: target.name })),
    })
    const chosen = targets.find(target => target.id === id)
    if (chosen) {
      const healed = Math.min(amount, chosen.target.damage)
      chosen.target.damage -= healed
      info(state, events, `${chosen.name} 治疗了 ${healed} 点伤害。`)
    }
  }

  function recordResearch(state, key) {
    state.campaign.records ||= {}
    state.campaign.records[key] = true
    for (const record of Object.values(state.campaign.investigators)) {
      record.research ||= {}
      record.research[key] = true
    }
  }

  function researchSolution(state, seat, assetId, events) {
    const inv = state.investigators[seat]
    // Phase 5（5a-9）：研究能力只按实例 id 找支援（调用方就是这张卡的能力），不再写死卡号。
    const asset = inv.assets.find(item => item.id === assetId)
    if (!asset) throw new Error('奇异溶液必须在场才能研究')
    return performTest(state, seat, 'intellect', 4, { source: { label: '研究', name: cardName(asset.code), code: asset.code }, resolve: result => {
      if (!result.success) return
      recordResearch(state, 'identifiedStrangeSolution')
      leaveAsset(state, inv, asset, events)
      inv.discard.push(asset.code)
      for (const line of drawCards(state, inv, 2, events)) info(state, events, line)
      info(state, events, `${inv.name} 鉴定了奇异溶液；该研究记录已保存到战役。`)
    } })
  }

  function healHorrorNearby(state, seat, amount, events) {
    const inv = state.investigators[seat]
    const connections = state.locations.find(loc => loc.id === inv.location)?.connections || []
    const targets = aliveInvestigators(state).filter(other => other.horror > 0
      && (other.location === inv.location || connections.includes(other.location)))
    if (!targets.length) return
    const id = targets.length === 1 ? String(targets[0].seat) : requestChoice(state, {
      kind: 'target', source: effect.code, seat, prompt: '选择本地点或连接地点的一名调查员，治疗 1 点恐惧。',
      options: targets.map(target => ({ id: String(target.seat), label: target.name })),
    })
    const target = targets.find(item => String(item.seat) === id)
    if (target) { target.horror = Math.max(0, target.horror - amount); info(state, events, `${target.name} 治疗 ${amount} 点恐惧。`) }
  }

  function dukeInvestigate(state, seat, events, code = null) {
    const inv = state.investigators[seat]
    const destinations = investigatorMoveDestinations(state, seat, {})
    if (destinations.length) {
      const id = requestChoice(state, { kind: 'move', source: code, seat,
        prompt: '杜克调查前是否移动到连接地点？',
        options: [{ id: 'stay', label: '留在原地调查' }, ...destinations.map(loc => ({ id: loc, label: locName(state, loc) }))] })
      if (id !== 'stay') relocateInvestigator(state, seat, id, events)
    }
    return doInvestigate(state, seat, { baseValue: 4 }, events, true)
  }

  return { hasTomeAsset, getThreatEffect, availableThreatAbilities, assetsCannotReady, drawBlocked, removeThreat, HARM_STRATEGIES, assignHarm, triggerThreatForced, applyThreatForced, unpaidExtraActionThreats, payActionCost, defeatAll, eliminateInvestigator, checkDefeated, checkOutcome, disengageAll, canDisengage, targetedTest, investigateForResources, dealDamageAll, dealDamageExhausted, blankEnemy, ignoreChaos, returnAssetToHand, shuffleIntoEncounter, moveHorrorToInvestigator, damagedTargetsAtLocation, healDamageAtLocation, recordResearch, researchSolution, healHorrorNearby, dukeInvestigate }
}
