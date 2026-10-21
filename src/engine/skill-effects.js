// 技能检定效果（applyTokenFx / applySkillOnSuccess / makeRuntime）从 engine.js 拆出的模块
// （Phase 6 · 6d-24）。
//
// 这三个函数是「检定的效果侧」：
//   applyTokenFx        —— 混乱标记上的 onFail/onSuccess 效果（数据体 + 旧式标记效果）
//   applySkillOnSuccess —— 投入技能牌的成功结算（clueBonus / damageBonus / 自动躲避等）
//   makeRuntime         —— 效果 DSL 的运行时注入对象（resolveEffect 需要 rt，engine 提供实现）
// 与 tests.js（检定主流程）分工：那边管 ST.1–ST.8 的流程，这边管「结果怎么落到状态上」。

export function createSkillEffects(deps) {
  const {
    campaignState,
    carcosaInvestigatorEffect,
    carcosaPlayerEffect,
    tfaInvestigatorEffect,
    legalMoves,
    upkeepPhase,
    doPlay,
    doInvestigate,
    doEvade,
    doFight,
    INVESTIGATOR_ABILITIES,
    SKILL_NAMES,
    addDoom,
    aliveInvestigators,
    all,
    applyDamage,
    applyHorror,
    assetsCannotReady,
    attachBarricade,
    autoEngageAt,
    autoEvadeEnemy,
    autoEvadeNonElite,
    blankEnemy,
    cardDef,
    cardName,
    checkDefeated,
    chooseEnemy,
    chooseInvestigator,
    commitProfile,
    createEffect,
    damageEnemy,
    dealDamageAll,
    dealDamageExhausted,
    defeatEnemy,
    defeatNonEliteEnemyAt,
    discardHandTo,
    discardRandomAsset,
    discardRandomFromHand,
    discoverClueAt,
    disengageAll,
    drawCards,
    drawEncounter,
    drawEnemyByTrait,
    dukeInvestigate,
    playerCardEffect,
    effectError,
    enemyForTarget,
    healDamageAtLocation,
    healHorrorNearby,
    ignoreChaos,
    info,
    investigateForResources,
    isWeaknessCard,
    locName,
    moveHorrorToInvestigator,
    moveInvestigatorTo,
    nearestEnemyByTrait,
    newCardInstance,
    performTest,
    placeCluesOnLocation,
    placeDoomOnCard,
    randomValue,
    rechargeAsset,
    reloadAmmo,
    relocateInvestigator,
    removeOne,
    requestChoice,
    researchSolution,
    returnAssetToHand,
    scenarioBehavior,
    scryDeck,
    searchCards,
    searchDiscard,
    searchTop,
    shuffle,
    shuffleIntoEncounter,
    spawnEnemy,
    syncClues,
    targetedTest,
    campaignPlayerEffect,
    triggerReaction,
  } = deps

function applyTokenFx(state, seat, inv, fx, events) {
  switch (fx.type) {
    case 'damage': case 'takeDamage': info(state, events, `${inv.name} 受到 ${fx.amount} 点伤害。`); applyDamage(state, inv, fx.amount, events); break
    case 'horror': case 'takeHorror': info(state, events, `${inv.name} 受到 ${fx.amount} 点恐惧。`); applyHorror(state, inv, fx.amount, events); break
    case 'drawEnemyTrait': drawEnemyByTrait(state, inv, fx.amount || fx.trait || 'Monster', events, true); break
    case 'placeDoomOnNearestCultist': {
      const target = nearestEnemyByTrait(state, inv.location, 'Cultist')
      if (target) { placeDoomOnCard(state, target, fx.amount || 1, events, { silent: true }); info(state, events, `🌑 「${target.name}」上放置 ${fx.amount || 1} 点毁灭。`) }
      break
    }
    case 'placeDoomOnEachCultist': {
      const cultists = state.enemies.filter((e) => (e.traits || []).some((t) => t.toLowerCase() === 'cultist'))
      for (const e of cultists) { placeDoomOnCard(state, e, fx.amount || 1, events, { silent: true }); info(state, events, `🌑 「${e.name}」上放置 ${fx.amount || 1} 点毁灭。`) }
      break
    }
    case 'placeDoomOnNearestEnemy': {
      const target = nearestEnemyByTrait(state, inv.location)
      if (target) { placeDoomOnCard(state, target, fx.amount || 1, events, { silent: true }); info(state, events, `🌑 「${target.name}」上放置 ${fx.amount || 1} 点毁灭。`) }
      break
    }
    case 'placeCluesOnLocation': {
      if (fx.amount === 'all') placeCluesOnLocation(state, inv, inv.clues, events)
      else placeCluesOnLocation(state, inv, fx.amount || 1, events)
      break
    }
    default: break
  }
}

function applySkillOnSuccess(state, inv, committed, success, successBy = 0) {
  const out = { damageBonus: 0, clueBonus: 0, evadeDisengage: false, mayMoveAfterEvade: false, homeFrontDamage: 0 }
  if (!success) {
    for (const code of committed) campaignState.clearWager(inv, code)
    return out
  }
  for (const code of committed) {
    const s = commitProfile(code)
    if (!s) continue
    const o = { ...(s.onSuccess || {}) }
    if (s.successBy && successBy >= s.successBy.threshold) {
      for (const key of ['damageBonus', 'clueBonus', 'healHorror', 'gainAction']) o[key] = (o[key] || 0) + (s.successBy[key] || 0)
    }
    if (o.draw) {
      const texts = drawCards(state, inv, o.draw, [])
      for (const t of texts) info(state, null, t)
      info(state, null, `${inv.name} 的「${cardName(code)}」触发：抽 ${o.draw} 张牌。`)
    }
    if (o.damageBonus) out.damageBonus += o.damageBonus
    if (o.clueBonus) out.clueBonus += o.clueBonus
    // 「孤注一掷」：按成功超出难度的点数抽牌，抽到的弱点洗回牌库而不是结算。
    if (o.drawPerSuccessBy) {
      const amount = Math.min(o.maxDraw || 5, Math.max(0, successBy) * o.drawPerSuccessBy)
      let drawn = 0
      for (let index = 0; index < amount; index++) {
        if (!inv.deck.length) break
        const drawnCode = inv.deck.pop()
        if (isWeaknessCard(cardDef(drawnCode))) {
          inv.deck = shuffle([...inv.deck, drawnCode], () => randomValue(state))
          continue
        }
        inv.hand.push(drawnCode)
        drawn++
      }
      if (drawn) info(state, null, `${inv.name} 的「${cardName(code)}」触发：抽 ${drawn} 张牌。`)
    }
    // 「如痴如醉」：调查成功后在支援上放置充能或秘密。
    if (o.placeChargeOrSecret) campaignPlayerEffect(state, inv.seat, { action: 'placeChargeOrSecret' }, [])
    if (o.healHorror) {
      const h = Math.min(inv.horror, o.healHorror)
      inv.horror -= h
      info(state, null, `${inv.name} 的「${cardName(code)}」触发：治愈 ${h} 点恐惧。`)
    }
    if (o.gainAction) inv.actionsLeft += o.gainAction
    if (o.evadeDisengage) out.evadeDisengage = true
    if (o.mayMoveAfterEvade) out.mayMoveAfterEvade = true
    const owner = inv
    const wager = campaignState.wager(owner, code)
    if (s.wagerResources && wager) {
      owner.resources += wager * 2
      campaignState.clearWager(owner, code)
    }
    if (o.returnDiscardClass) {
      const candidates = owner.discard.filter(item => item !== code && cardDef(item)?.klass === o.returnDiscardClass)
      if (candidates.length) {
        const answer = requestChoice(state, { kind: 'card', source: code, seat: owner.seat, canSkip: true,
          prompt: '选择从弃牌堆返回手牌的卡牌。', options: [{ id: 'skip', label: '不返回' },
            ...candidates.map((item, index) => ({ id: String(index), cardCode: item, label: cardName(item) }))] })
        if (answer !== 'skip') {
          const picked = candidates[Number(answer)]
          removeOne(owner.discard, picked); owner.hand.push(picked)
        }
      }
    }
    if (o.readyAndHealAlly) {
      const allies = aliveInvestigators(state).filter(other => other.location === inv.location)
        .flatMap(other => other.assets.map(asset => ({ asset, owner: other })))
        .filter(item => (cardDef(item.asset.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')
          && (item.asset.exhausted || item.asset.damage > 0 || item.asset.horror > 0))
      if (allies.length) {
        const answer = requestChoice(state, { kind: 'asset', source: code, seat: inv.seat,
          prompt: '选择重整并治疗的盟友。', options: allies.map(item => ({ id: item.asset.id, label: cardName(item.asset.code) })) })
        const picked = allies.find(item => item.asset.id === answer)?.asset
        if (picked) {
          picked.exhausted = false
          const kind = picked.damage > 0 && picked.horror > 0 ? requestChoice(state, { kind: 'heal', source: code, seat: inv.seat,
            prompt: '选择治疗1点伤害或恐惧。', options: [{ id: 'damage', label: '治疗伤害' }, { id: 'horror', label: '治疗恐惧' }] })
            : picked.damage > 0 ? 'damage' : 'horror'
          picked[kind] = Math.max(0, (picked[kind] || 0) - 1)
        }
      }
    }
    // 「英勇无畏」：检定成功后把技能牌本身作为支援留在场上。
    if (o.becomeAsset) {
      const spec = o.becomeAsset
      const asset = newCardInstance(state, code, { exhausted: false, enteredRound: state.round,
        statBonus: { ...(spec.stats || {}) } })
      campaignState.setRoundEndDiscard(asset, state.round)
      inv.assets.push(asset)
      info(state, null, `${inv.name} 的「${cardName(code)}」作为支援进入游戏区域，并在轮末弃掉。`)
      triggerReaction(state, inv.seat, 'assetEnteredPlay', [], { assetCode: code, assetId: asset.id, location: inv.location })
    }
    if (o.searchTop) searchTop(state, inv.seat, { amount: o.searchTop, source: code }, [])
    // Phase 5（5a-33）：「家庭前线」的伤害转移由调查员能力数据声明。
    if (s.homeFront && INVESTIGATOR_ABILITIES[inv.code]?.homeFrontMoveDamage
      && inv.damage > out.homeFrontDamage && state.skillTest?.source?.enemyId) {
      const answer = requestChoice(state, { kind: 'skillEffect', source: code, seat: inv.seat,
        prompt: '是否从马克·哈里根身上移动1点伤害到正在攻击的敌人？',
        options: [{ id: 'skip', label: '不移动' }, { id: 'move', label: '移动1点伤害' }] })
      if (answer === 'move') { out.homeFrontDamage += 1; out.homeFrontCode = code }
    }
  }
  return out
}

function makeRuntime(state, events) {
  return {
    cancelPending: (when) => {
      if (!state._reaction || state._reaction.when !== when) throw new Error('当前没有可取消的结算')
      state._reaction.cancelled = true
    },
    substituteSkill: (seat, from, to) => {
      const target = state.investigators[seat]
      target.skillSubstitute = { from: [...from], to, round: state.round }
      info(state, events, `${target.name} 本轮可用${SKILL_NAMES[to]}代替${from.map(skill => SKILL_NAMES[skill]).join('、')}。`)
    },
    info: (text) => info(state, events, text),
    effectError: (seat, effect) => effectError(state, state.investigators[seat], effect),
    chooseEnemy: (seat, effect) => chooseEnemy(state, seat, effect),
    search: (seat, effect) => searchCards(state, seat, effect, events),
    drawCards: (inv, n) => drawCards(state, inv, n, events),
    checkDefeated: (seat) => checkDefeated(state, seat, events),
    applyDamage: (seat, amount, direct) => applyDamage(state, state.investigators[seat], amount, events, direct),
    applyHorror: (seat, amount, direct) => applyHorror(state, state.investigators[seat], amount, events, direct),
    discoverClue: (inv, amount) => discoverClueAt(state, inv, amount, events),
    addDoom: (amount) => addDoom(state, amount, events),
    enemyForTarget: (seat, target) => enemyForTarget(state, seat, target),
    defeatEnemy: (enemy) => defeatEnemy(state, enemy, events),
    damageEnemy: (enemy, amount, seat) => damageEnemy(state, enemy, amount, seat, events),
    canGainResources: seat => scenarioBehavior(state).canGainResources?.(state, state.investigators[seat]) !== false,
    canReadyAssets: seat => !assetsCannotReady(state.investigators[seat], state.round),
    investigate: (seat, opts) => doInvestigate(state, seat, opts || {}, events, true),
    fight: (seat, opts) => doFight(state, seat, opts || {}, events, true),
    evade: (seat, opts) => doEvade(state, seat, opts || {}, events, true),
    autoEvade: (enemy) => autoEvadeEnemy(state, enemy, events),
    discardRandomFromHand: (inv, n) => discardRandomFromHand(state, inv, n, events),
    // 弃掉牌库顶 N 张（离场钩子等效果数据用的原语，Phase 1）。
    mill: (seat, amount) => {
      const inv = state.investigators[seat]
      if (!inv) return
      const discarded = []
      for (let index = 0; index < amount && inv.deck.length; index++) discarded.push(inv.deck.pop())
      if (!discarded.length) return
      inv.discard.push(...discarded)
      info(state, events, `${inv.name} 弃掉牌库顶 ${discarded.length} 张牌。`)
    },
    addEffect: (seat, record) => createEffect(state, { ...record, controllerSeat: seat }),
    discardRandomAsset: (inv) => discardRandomAsset(state, inv, events),
    discardHandTo: (inv, keep) => discardHandTo(state, inv, keep, events),
    reloadAmmo: (inv, amount, effect) => reloadAmmo(state, inv, amount, events, effect),
    defeatNonEliteEnemy: (seat, target) => defeatNonEliteEnemyAt(state, seat, target, events),
    rechargeAsset: (inv, amount, effect) => rechargeAsset(state, inv, amount, events, effect),
    exileCards: (inv, arr) => { for (const c of arr) state.exiled.push(c) },
    performTest: (seat, skill, difficulty, options) => performTest(state, seat, skill, difficulty, options),
    spawnEnemy: (code, loc, engagedSeat) => spawnEnemy(state, code, loc, engagedSeat),
    locName: (id) => locName(state, id),
    autoEngageAt: (loc) => autoEngageAt(state, loc, events),
    exhaustSelf: () => {},
    chooseInvestigator: (seat, target, effect, constraints) => chooseInvestigator(state, seat, target, effect, constraints),
    healDamageAtLocation: (seat, amount) => healDamageAtLocation(state, seat, amount, events),
    healHorrorNearby: (seat, amount) => healHorrorNearby(state, seat, amount, events),
    dukeInvestigate: seat => dukeInvestigate(state, seat, events, effect.code),
    carcosaInvestigatorEffect: (seat, effect) => carcosaInvestigatorEffect(state, seat, effect, events),
    carcosaPlayerEffect: (seat, effect) => carcosaPlayerEffect(state, seat, effect, events),
    tfaInvestigatorEffect: (seat, effect) => tfaInvestigatorEffect(state, seat, effect, events),
    tfaPlayerEffect: (seat, effect) => tfaPlayerEffect(state, seat, effect, events),
    playerCardEffect: (seat, effect) => playerCardEffect(state, seat, effect, events),
    researchSolution: (seat, assetId) => researchSolution(state, seat, assetId, events),
    searchTop: (seat, effect) => searchTop(state, seat, effect, events),
    investigateForResources: (seat, effect) => investigateForResources(state, seat, effect, events),
    moveTo: (seat, effect) => moveInvestigatorTo(state, seat, effect, events),
    moveInvestigator: (seat, destination) => relocateInvestigator(state, seat, destination, events),
    dealDamageAll: (seat, effect) => dealDamageAll(state, seat, effect, events),
    dealDamageExhausted: (seat, effect) => dealDamageExhausted(state, seat, effect, events),
    blankEnemy: (seat, effect) => blankEnemy(state, seat, effect, events),
    ignoreChaos: (seat, effect) => ignoreChaos(state, seat, effect, events),
    returnAssetToHand: (seat, effect) => returnAssetToHand(state, seat, effect, events),
    shuffleIntoEncounter: (seat, effect) => shuffleIntoEncounter(state, seat, effect, events),
    moveHorrorToInvestigator: (seat, effect) => moveHorrorToInvestigator(state, seat, effect, events),
    searchDiscard: (seat, effect) => searchDiscard(state, seat, effect, events),
    autoEvadeNonElite: (seat, effect) => autoEvadeNonElite(state, seat, effect, events),
    attachBarricade: (seat, effect) => attachBarricade(state, seat, effect, events),
    drawEncounter: (seat) => { const inv = state.investigators[seat]; drawEncounter(state, inv, events) },
    addTestValue: (amount) => {
      if (state._reaction) state._reaction.testBonus = (state._reaction.testBonus || 0) + amount
      else if (state.skillTest) state.skillTest.pendingBonus = (state.skillTest.pendingBonus || 0) + amount
    },
    disengageAll: (seat) => disengageAll(state, seat, events),
    flipTokenSign: () => { if (state._reaction) state._reaction.flipTokenSign = true },
    scry: (seat, effect) => scryDeck(state, seat, effect, events),
    gainClues: (inv, amount) => { inv.clues += amount; syncClues(state); info(state, events, `${inv.name} 从供应堆获得 ${amount} 个线索（个人 ${inv.clues}）。`) },
    targetedTest: (seat, effect) => targetedTest(state, seat, effect, events),
    reactionContext: null,
  }
}

  return { applyTokenFx, applySkillOnSuccess, makeRuntime }
}
