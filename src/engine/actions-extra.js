import { investigatorRule } from '../cards/card-rules.js'
// actions-extra.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 场景/剧情侧的额外行动：谈判、剧情资产、地点能力、威胁与债务等。
// 这些行动都由「卡面文案 + 剧本数据」触发，读点仍是 applyMove → executeAction 的分派。
export function createActionsExtra(deps) {
  const {
    EFFECTS,
    LITA_CHANDLER_CODE,
    SEARCHING_FOR_IZZIE_CODE,
    SKILL_NAMES,
    activeHiddenRules,
    applyDamage,
    applyHorror,
    applyMove,
    assetReplacementPlans,
    autoEngageAll,
    campaignCardChange,
    canDiscardFromHand,
    canEquip,
    cannotPlayTypes,
    capabilityBlocked,
    cardDef,
    cardHasTrait,
    cardName,
    checkAct,
    discardChosenCards,
    discardHiddenCard,
    drawCards,
    effectError,
    effectiveTraits,
    enemyDef,
    enemyTextBlanked,
    executeAction,
    finishScenario,
    getThreatEffect,
    groupClues,
    groupPayment,
    hasHiddenCard,
    hiddenRule,
    info,
    interrogateCultist,
    investigatorTextBlanked,
    isWeaknessCard,
    isWeaknessCode,
    leaveAsset,
    locName,
    lolaCanUseCard,
    makeRuntime,
    nextInstanceId,
    normalizedSlots,
    performTest,
    playCost,
    playTypeBlocked,
    registeredEntry,
    removeOne,
    removeThreat,
    requestChoice,
    resourceBank,
    resolveEffect,
    runtimeCardAvailable,
    scenarioBehavior,
    scenarioRuntime,
    spawnEnemy,
    spendAction,
    spendClues,
    unique,
  } = deps

  function scenarioAssetPlayError(state, inv, code) {
    const def = cardDef(code)
    if (!inv || !def || def.type !== 'asset' || isWeaknessCard(def)) return '该卡牌不是可打出的支援'
    if (!runtimeCardAvailable(state, inv, code) || !lolaCanUseCard(inv, code)) return '当前调查员不能打出该支援'
    if (cannotPlayTypes(inv).has(def.type)
      || scenarioBehavior(state).canPlayCard?.(state, inv, def) === false
      || playTypeBlocked(state, inv, def.type)) {
      return '当前效果禁止打出支援'
    }
    if (inv.resources < playCost(state, inv, def)) return '资源不足'
    if (def.unique && state.investigators.some(other =>
      other.assets.some(asset => cardDef(asset.code)?.name === def.name))) return '同名独特支援已在场'
    if (normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) return '没有可用槽位'
    return null
  }

  function attachmentTargets(state, inv, spec, code) {
    if (!spec) return []
    if (spec.kind === 'asset') {
      // controllerScope==='location'（04193 特制弹药）：可选同地点其他调查员的支援，附件仍由打出者拥有。
      const owners = spec.controllerScope === 'location'
        ? state.investigators.filter(owner => owner.location === inv.location && !owner.defeated && !owner.resigned)
        : [inv]
      const seen = new Set()
      return owners.flatMap(owner => owner.assets.filter(asset => {
        if (seen.has(asset.id)) return false
        seen.add(asset.id)
        if (asset.code === code) return false
        // Phase 2（C2）：特性判定走 effectiveTraits，运行期授予的特性也能当附件目标。
        if (spec.trait && !cardHasTrait(state, owner, asset.code, spec.trait)) return false
        // 2026-10-25：05230 瞄准镜「附属到一张占用 2 个手部槽位的[[枪械]]支援」由
        // attachTo.handSlots 声明；按目标卡印刷槽位过滤。
        if (spec.handSlots) {
          const slots = cardDef(asset.code)?.slots || []
          const handSlots = slots.reduce((count, slot) => {
            const key = String(slot).trim().toLowerCase()
            if (key === 'hand x2') return count + 2
            return key === 'hand' ? count + 1 : count
          }, 0)
          if (handSlots < spec.handSlots) return false
        }
        if (spec.maxPerTarget) {
          const used = (asset.attachments || []).filter(entry => entry.code === code).length
          if (used >= spec.maxPerTarget) return false
        }
        return true
      }))
    }
    // 2026-10-25：05021 勤教延后等「附属到同地点任意调查员」的支援/事件，
    // 由 attachTo.kind='investigator' 声明；返回可附属的调查员（排除自己可选）。
    if (spec.kind === 'investigator') {
      const owners = spec.controllerScope === 'location'
        ? state.investigators.filter(owner => owner.location === inv.location && !owner.defeated && !owner.resigned)
        : state.investigators.filter(owner => !owner.defeated && !owner.resigned)
      return owners.filter(owner => {
        if (spec.excludeSelf && owner.seat === inv.seat) return false
        if (spec.trait && !(investigatorRule(owner.code)?.traits || []).some(trait =>
          String(trait).toLowerCase() === String(spec.trait).toLowerCase())) return false
        return true
      }).map(owner => ({ id: `seat:${owner.seat}`, seat: owner.seat, code: owner.code,
        label: owner.name, investigator: owner }))
    }
    if (spec.kind === 'location') return state.locations.filter(location => location.inPlay !== false)
    if (spec.kind === 'enemy') {
      return state.enemies.filter(enemy => !enemy.defeated
        && (!spec.trait || (enemy.traits || []).some(trait => String(trait).toLowerCase() === spec.trait.toLowerCase()))
        && (!spec.nonElite || !enemy.elite))
    }
    return []
  }

  function attachCardTo(state, seat, code, target, extra = {}) {
    target.attachments ||= []
    const id = nextInstanceId(state, 'a')
    target.attachments.push({ id, code, ownerSeat: seat, attachedRound: state.round, ...extra })
    return target.attachments[target.attachments.length - 1]
  }

  function assetCapacityValue(asset, capacity) {
    let value = cardDef(asset.code)?.[capacity] || 0
    for (const entry of asset.attachments || []) {
      const passive = registeredEntry(entry.code)?.passive
      if (!passive) continue
      if (capacity === 'health') value += passive.hostHealth || 0
      if (capacity === 'sanity') value += passive.hostSanity || 0
    }
    return value
  }

  function withEffectCode(effect, code) {
    if (!effect || !code || effect.code === code) return effect
    return { ...effect, code }
  }

  function doDraw(state, seat, events) {
    const inv = state.investigators[seat]
    spendAction(state, inv)
    const texts = drawCards(state, inv, 1, events)
    for (const t of texts) info(state, events, t)
  }

  function doResource(state, seat, events) {
    const inv = state.investigators[seat]
    spendAction(state, inv)
    if (scenarioBehavior(state).canGainResources?.(state, inv) === false) return
    inv.resources += 1
    info(state, events, `${inv.name} 获得 1 资源（当前 ${inv.resources}）。`)
  }

  function doFreeAction(state, seat, events) {
    const inv = state.investigators[seat]
    const skids = investigatorRule(inv.code)
    if (!skids || !skids.freeAction || investigatorTextBlanked(state, inv)) return
    resourceBank.spendFromPool(inv, skids.freeAction.cost.resources || 0)
    if (skids.freeAction.cost.discardHand) {
      const index = requestChoice(state, { kind: 'discard', source: skids.freeAction.id, seat, prompt: '选择弃掉的手牌。',
        options: inv.hand.flatMap((code, i) => isWeaknessCode(code) || !canDiscardFromHand(inv, code)
          ? [] : [{ id: String(i), label: cardName(code) }]) })
      inv.discard.push(...inv.hand.splice(Number(index), 1))
    }
    if (!skids.freeAction.repeatable) inv.usedReactions[skids.freeAction.id + ':' + state.turnSerial] = true
    info(state, events, `⚡ ${inv.name} 使用调查员免费能力。`)
    resolveEffect(state, seat, skids.freeAction.effect, makeRuntime(state, events))
  }

  function doHiddenAction(state, seat, move, events) {
    const inv = state.investigators[seat]
    const rule = hiddenRule(state, move.cardId)
    const discard = rule?.discard
    if (!discard || !hasHiddenCard(inv, move.cardId)) return
    resourceBank.spendFromPool(inv, discard.resources || 0)
    if (discard.damageInvestigator) {
      const target = state.investigators.find(other => other.seat === move.targetSeat
        && !other.defeated && !other.resigned && other.location === inv.location)
      if (!target) throw new Error('隐私牌没有合法的伤害目标')
      applyDamage(state, target, discard.damageInvestigator, events)
    }
    discardHiddenCard(state, inv, move.cardId, events)
  }

  function doParley(state, seat, enemyId, events) {
    const inv = state.investigators[seat]
    const enemy = state.enemies.find((e) => e.id === enemyId)
    if (!enemy || enemy.engagedSeat !== seat || !enemy.parleyCost) return
    spendAction(state, inv)
    resourceBank.spendFromPool(inv, enemy.parleyCost)
    info(state, events, `🤝 ${inv.name} 花费 ${enemy.parleyCost} 资源谈判，「${enemy.name}」被弃掉。`)
    removeOne(state.enemies, enemy)
    removeOne(inv.engaged, enemy.id)
    if (isWeaknessCode(enemy.code)) inv.discard.push(enemy.code)
    else state.encounterDiscard.push(enemy.code)
  }

  function doParleyCultist(state, seat, enemyId, events) {
    const inv = state.investigators[seat]
    const enemy = state.enemies.find((e) => e.id === enemyId)
    if (!enemy || !enemy.uniqueCultist) return
    const def = enemyDef(enemy.code)
    const cost = def.parley ? def.parley.cost : null
    if (!cost) return
    // 校验成本。
    if (cost.clues && inv.clues < cost.clues) { info(state, events, '线索不足，无法谈判。'); return }
    if (cost.resources && inv.resources < cost.resources) { info(state, events, '资源不足，无法谈判。'); return }
    if (cost.discardHand && inv.hand.length < cost.discardHand) { info(state, events, '手牌不足，无法谈判。'); return }
    spendAction(state, inv)
    if (cost.clues) spendClues(state, inv, cost.clues)
    if (cost.resources) resourceBank.spendFromPool(inv, cost.resources)
    if (cost.discardHand) discardChosenCards(state, inv, cost.discardHand, events, 'parley')
    info(state, events, `🤝 ${inv.name} 谈判盘问「${enemy.name}」，将其加入胜利区。`)
    interrogateCultist(state, enemy, events)
  }

  function doParleyLita(state, seat, events) {
    const inv = state.investigators[seat]
    const asset = state.storyAssets?.find(item => item.code === LITA_CHANDLER_CODE
      && item.controllerSeat == null && item.location === inv.location)
    if (!asset || scenarioBehavior(state).litaParleyActIndex !== state.actIndex) throw new Error('此处没有可谈判的丽塔')
    spendAction(state, inv)
    return performTest(state, seat, 'intellect', 4, { source: { label: '谈判', name: '丽塔·钱德勒', code: LITA_CHANDLER_CODE }, resolve: r => {
      if (r.success) {
        while (!canEquip(inv, cardDef(asset.code))) {
          const allies = inv.assets.filter(item => normalizedSlots(cardDef(item.code)).includes('ally'))
          const id = requestChoice(state, { kind: 'discard-asset', source: 'lita-control', seat,
            prompt: '选择弃掉一位盟友，为丽塔腾出槽位。',
            options: allies.map(item => ({ id: item.id, label: cardName(item.code) })) })
          const discarded = inv.assets.find(item => item.id === id)
          leaveAsset(state, inv, discarded)
          inv.discard.push(discarded.code)
        }
        removeOne(state.storyAssets, asset)
        delete asset.location
        asset.controllerSeat = seat
        inv.assets.push(asset)
        info(state, events, `${inv.name} 谈判成功，取得「丽塔·钱德勒」的控制权！`)
      } else {
        info(state, events, `${inv.name} 谈判失败（智识 ${r.value} vs 4）。`)
      }
    } })
  }

  function doDrawCultist(state, seat, events) {
    const inv = state.investigators[seat]
    const needed = 2 * state.numInvestigators
    if (groupClues(state) < needed) throw new Error('符合条件的共同线索不足')
    if (!state.cultistDeck.length) { info(state, events, '异教徒牌堆已空。'); return }
    spendAction(state, inv)
    groupPayment(state, needed, null, events)
    const code = state.cultistDeck.pop()
    const def = enemyDef(code)
    const loc = def.spawn || inv.location
    const enemy = spawnEnemy(state, code, loc, null)
    info(state, events, `🕵️ 调查队花费 ${needed} 个线索抽取异教徒牌堆：「${enemy.name}」生成于「${locName(state, loc)}」。`)
    autoEngageAll(state, events)
  }

  function doInterruptRitual(state, seat, skill, events) {
    const inv = state.investigators[seat]
    if (scenarioBehavior(state).interruptRitualActIndex !== state.actIndex) return
    if (inv.clues < 1) { info(state, events, '需要 1 个线索。'); return }
    spendAction(state, inv)
    spendClues(state, inv, 1)
    const sk = skill === 'agility' ? 'agility' : 'willpower'
    return performTest(state, seat, sk, 3, { source: { label: '剧本行动', name: '破坏仪式' }, resolve: r => {
      if (r.success) {
        state.actClues += 1
        info(state, events, `📜 ${inv.name} 破坏仪式成功，本场景线索 +1（${state.actClues}/${state.numInvestigators * 2}）。`)
        checkAct(state, events)
      } else {
        info(state, events, `❌ ${inv.name} 破坏仪式失败（${SKILL_NAMES[sk]} ${r.value} vs 3）。`)
      }
    } })
  }

  function doSacrificeLita(state, seat, events) {
    const inv = state.investigators[seat]
    if (!scenarioBehavior(state).sacrificeLitaAction?.(state, inv, scenarioRuntime(state, events))) {
      throw new Error('献祭需要本人控制丽塔并与乌默尔多斯位于同一地点')
    }
  }

  function doBreakDoor(state, seat, skill, events) {
    const inv = state.investigators[seat]
    const loc = state.locations.find((l) => l.id === inv.location)
    if (!loc || !loc.locked) return
    spendAction(state, inv)
    const useSkill = skill === 'agility' ? 'agility' : 'combat'
    const doorCode = loc.lockedDoorCode || null
    return performTest(state, seat, useSkill, 4, { source: { label: '破门', name: loc.name, code: doorCode }, resolve: r => {
      if (r.success) {
        loc.locked = false
        if (doorCode) state.encounterDiscard.push(doorCode)
        delete loc.lockedDoorCode
        info(state, events, `🔓 ${inv.name} 以${SKILL_NAMES[useSkill]}检定破门而入。`)
      } else {
        info(state, events, `❌ ${inv.name} 以${SKILL_NAMES[useSkill]}检定破门失败。`)
      }
    } })
  }

  function doDiscardThreat(state, seat, threatId, events) {
    const inv = state.investigators[seat]
    const owner = state.investigators.find(other => !other.defeated && !other.resigned
      && other.location === inv.location && other.threat.some(t => t.id === threatId
        && (other.seat === seat || getThreatEffect(t)?.sameLocationAction)))
    const t = owner?.threat.find(item => item.id === threatId)
    const th = t && getThreatEffect(t)
    if (!t || !th?.discardCost) throw new Error('该威胁没有可用的弃置能力')
    const cost = th.discardCost.action ?? 1
    for (let i = 0; i < cost; i++) spendAction(state, inv)
    const discard = () => {
      if (removeThreat(state, owner, t, events)) info(state, events, `${inv.name} 花 ${cost} 行动弃掉了「${cardName(t.code)}」。`)
    }
    if (th.discardTest) {
      performTest(state, seat, th.discardTest.skill, th.discardTest.difficulty, { source: { label: '解除威胁', name: cardName(t.code), code: t.code }, resolve: result => {
          if (result.success) discard()
          else info(state, events, `${inv.name} 未通过「${cardName(t.code)}」的弃置检定，该牌留在威胁区域。`)
      } })
    } else discard()
  }

  function doPayDebt(state, seat, threatId, events) {
    const inv = state.investigators[seat]
    const t = inv.threat.find(item => item.id === threatId)
    if (!t || !getThreatEffect(t)?.debt) return
    inv.resources -= 1
    t.resources = (t.resources || 0) + 1
    t.debtPaymentsThisRound = (t.debtPaymentsThisRound || 0) + 1
    info(state, events, `${inv.name} 向医院债务支付 1 资源（债务 ${t.resources}/6）。`)
  }

  function doPurgeThreat(state, seat, threatId, events) {
    const inv = state.investigators[seat]
    const t = inv.threat.find((x) => x.id === threatId)
    if (!t || (t.counters || 0) <= 0) return
    spendAction(state, inv)
    t.counters -= 1
    info(state, events, `📖 ${inv.name} 将「${cardName(t.code)}」的 1 点恐惧移到自己身上（剩余 ${t.counters}），受到 1 点恐惧。`)
    applyHorror(state, inv, 1, events, true)
    if (t.counters <= 0) {
      removeThreat(state, inv, t, events)
      info(state, events, `✔️ 「${cardName(t.code)}」恐惧清空，被弃掉。`)
    }
  }

  function enemyRuleEntry(state, enemy) {
    const code = enemy.originalCode || enemyDef(enemy.code)?.originalCode
      || state.scenario.enemies?.[enemy.code]?.originalCode || enemy.code
    return registeredEntry(code)
  }

  function engagedWithClueBlocker(state, inv) {
    return state.enemies.find(enemy => enemyRuleEntry(state, enemy)?.enemyRule?.blocksCluesWhileEngaged
      && enemy.engagedSeat === inv.seat && !enemyTextBlanked(state, enemy)) || null
  }

  function clueBlockerName(state, enemy) {
    return enemyRuleEntry(state, enemy)?.enemyRule?.blocksCluesMessage || enemy?.name || ''
  }

  function canSpendClues(state, inv) {
    return !engagedWithClueBlocker(state, inv)
  }

  function locationAbilityAvailable(state, loc, inv) {
    if (!loc.revealed || inv.location !== loc.id) return false
    const ab = loc.ability
    if (!ab) return false
    if (ab.limit === 'game' && (loc.abilityUsed || loc.abilityUsedSeats?.includes(inv.seat))) return false
    if (ab.limit === 'team-game' && state.locationAbilityTeamUsed?.[loc.id]) return false
    if (ab.limit === 'round' && loc.abilityRound === state.round) return false
    if (ab.limit === 'player-turn' && loc.abilityTurns?.[inv.seat] === `${state.round}:${state.currentSeat}`) return false
    if (effectError(state, inv, ab.effect)) return false
    if (ab.cost && ab.cost.resources && inv.resources < ab.cost.resources) return false
    return true
  }

  // 给 AI / 描述层的地点能力可用性：不仅回答「能不能用」，还回答「为什么不能用」。
  // 读的条件与 moves.js 的 locationAbility case 对齐，但不受行动点、轮次和待决选择影响——
  // 这些是「现在能不能提交」，不是「地点能力本身有什么门槛」。
  function locationAbilityStatus(state, loc, inv) {
    if (!loc) return { available: false, reason: '地点不存在' }
    if (!loc.revealed) return { available: false, reason: '地点尚未揭示' }
    if (inv.location !== loc.id) return { available: false, reason: '你不在该地点' }
    const ab = loc.ability
    if (!ab) return { available: false, reason: '没有已实现的地点能力' }
    if (capabilityBlocked(state, inv, 'locationAbility')) return { available: false, reason: '当前效果禁止你使用地点能力' }
    if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotTriggerLocationAbilities)) {
      return { available: false, reason: '隐私牌禁止你触发地点能力' }
    }
    if (ab.limit === 'game' && (loc.abilityUsed || loc.abilityUsedSeats?.includes(inv.seat))) {
      return { available: false, reason: '本场游戏此能力已使用' }
    }
    if (ab.limit === 'team-game' && state.locationAbilityTeamUsed?.[loc.id]) {
      return { available: false, reason: '本场游戏队伍已使用此能力' }
    }
    if (ab.limit === 'round' && loc.abilityRound === state.round) {
      return { available: false, reason: '本轮此能力已使用' }
    }
    if (ab.limit === 'player-turn' && loc.abilityTurns?.[inv.seat] === `${state.round}:${state.currentSeat}`) {
      return { available: false, reason: '本回合此能力已使用' }
    }
    if (ab.cost && ab.cost.resources && inv.resources < ab.cost.resources) {
      return { available: false, reason: `需要 ${ab.cost.resources} 资源（当前 ${inv.resources}）` }
    }
    const reason = effectError(state, inv, ab.effect)
    if (reason) return { available: false, reason }
    return { available: true, reason: null }
  }

  // 调查的可用性同样给出原因：禁止调查 / 无线索 / 上锁 / 剧本限制。
  // 与 moves.js 的 investigate case 对齐，但不看行动点。
  function locationInvestigateStatus(state, loc, inv) {
    if (!loc) return { available: false, reason: '地点不存在' }
    if (!loc.revealed) return { available: false, reason: '地点尚未揭示' }
    if (inv.location !== loc.id) return { available: false, reason: '你不在该地点' }
    if (capabilityBlocked(state, inv, 'investigate')) return { available: false, reason: '当前效果禁止你调查' }
    if ((loc.clues || 0) <= 0) return { available: false, reason: '这里没有线索可调查' }
    if (loc.locked) return { available: false, reason: '地点被上锁的门封锁' }
    const reason = scenarioBehavior(state).investigationError?.(state, inv, loc)
    if (reason) return { available: false, reason }
    return { available: true, reason: null }
  }

  function markLocationAbilityUsed(state, loc, inv) {
    const ab = loc.ability || {}
    if (ab.limit === 'game') { loc.abilityUsedSeats ||= []; loc.abilityUsedSeats.push(inv.seat) }
    if (ab.limit === 'team-game') { state.locationAbilityTeamUsed ||= {}; state.locationAbilityTeamUsed[loc.id] = true }
    if (ab.limit === 'round') loc.abilityRound = state.round
    if (ab.limit === 'player-turn') { loc.abilityTurns ||= {}; loc.abilityTurns[inv.seat] = `${state.round}:${state.currentSeat}` }
  }

  function doLocationAbility(state, seat, locationId, events) {
    const inv = state.investigators[seat]
    const loc = state.locations.find(item => item.id === locationId)
    if (!loc || !loc.ability || inv.location !== locationId) return
    const ab = loc.ability
    if (ab.cost && ab.cost.resources) resourceBank.spendFromPool(inv, ab.cost.resources)
    markLocationAbilityUsed(state, loc, inv)
    info(state, events, `📍 ${inv.name} 使用「${loc.name}」的能力：${ab.label}。`)
    resolveEffect(state, seat, ab.effect, makeRuntime(state, events))
  }

  function doSearchIzzie(state, seat, events) {
    const inv = state.investigators[seat]
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc || loc.searchingForIzzieSeat == null) return
    performTest(state, seat, 'intellect', loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0), {
      source: { label: '调查', name: '寻找伊兹', code: SEARCHING_FOR_IZZIE_CODE }, resolve: result => {
        if (!result.success) return
        state.investigators[loc.searchingForIzzieSeat]?.discard.push(SEARCHING_FOR_IZZIE_CODE)
        delete loc.searchingForIzzieSeat
        info(state, events, `${inv.name} 成功寻找伊兹，弃掉这张弱点。`)
      },
    })
  }

  function afterEvade(state, inv, enemy, events, result = null) {
    scenarioBehavior(state).afterEvade?.(state, inv, enemy, result, scenarioRuntime(state, events))
    if (enemy.evadeToVictory && !enemyTextBlanked(state, enemy)) {
      info(state, events, `🕵️ 「${enemy.name}」被躲避，加入胜利区！`)
      interrogateCultist(state, enemy, events)
    }
  }

  return { scenarioAssetPlayError, attachmentTargets, attachCardTo, assetCapacityValue, withEffectCode, doDraw, doResource, doFreeAction, doHiddenAction, doParley, doParleyCultist, doParleyLita, doDrawCultist, doInterruptRitual, doSacrificeLita, doBreakDoor, doDiscardThreat, doPayDebt, doPurgeThreat, engagedWithClueBlocker, clueBlockerName, canSpendClues, locationAbilityAvailable, locationAbilityStatus, locationInvestigateStatus, markLocationAbilityUsed, doLocationAbility, doSearchIzzie, afterEvade }
}
