// 弱点揭示与结算（resolveWeakness）从 engine.js 拆出的模块（Phase 6 · 6d-14）。
//
// 弱点是这套引擎里规则最碎的一块：敌人型、威胁型、附着型、可打出的、会升级的、
// 会在结算后洗回牌库的……Phase 5 期间把「弱点描述子 + resolve 通道」补齐之后，
// 这里已经是**数据驱动 + 少量兜底分支**；拆出来便于对照 roadmap §7 的迁移判据继续收。
//
// 依赖注入同前几批；abilityApi 是工厂产物，用惰性调用。

export function createWeakness(deps) {
  const {
    CLASS_NAMES,
    EFFECTS,
    abilityApi,
    addDoom,
    addTrauma,
    aliveInvestigators,
    applyDamage,
    applyHarm,
    applyHorror,
    assetCannotLeavePlay,
    cardDef,
    cardName,
    checkDefeated,
    descriptorOfKind,
    drawCards,
    executeDescriptor,
    farthestLocationsFor,
    info,
    isWeaknessCard,
    leaveAsset,
    locName,
    makeRuntime,
    newCardInstance,
    randomValue,
    registeredEntry,
    removeOne,
    replaceAssets,
    requestChoice,
    resolveEffect,
    sealChaosToken,
    shuffle,
    spawnEnemy,
    tokenLabel,
    weaknessDescriptor,
    weaknessProfile,
    weaknessUpgradeCode,
  } = deps

function resolveWeakness(state, inv, def, events, texts) {
  // Phase 5（5a-12）：弱点描述子可以带 resolve，优先走能力层；旧的数据体分支仍作为回退。
  const weakDescriptor = descriptorOfKind(def.code, 'weakness')
  if (weakDescriptor?.resolve) {
    executeDescriptor(state, { inv, source: { code: def.code, id: def.code }, descriptor: weakDescriptor, events, silent: true })
    return
  }
  if (def.type === 'enemy') {
    let location = inv.location
    // Phase 5（5a-25）：在「离你最远的地点」生成的弱点由条目级 weaknessSpawnsAtFarthestLocation 声明。
    if (registeredEntry(def.code)?.weaknessSpawnsAtFarthestLocation) {
      const farthest = farthestLocationsFor(state, inv)
      if (farthest.length === 1) location = farthest[0]
      else if (farthest.length > 1) location = requestChoice(state, {
        kind: 'location', source: def.code, seat: inv.seat, prompt: '选择距离你最远的地点生成随行鬼影。',
        options: farthest.map(id => ({ id, label: locName(state, id) })),
      })
    }
    const enemy = spawnEnemy(state, def.code, location, inv.seat)
    if (enemy) {
      // 伊格蛇族：显现时把旧印标记封印在自身。
      if ((registeredEntry(def.code)?.enemyWeakness?.sealsElderSign) && state.chaosBag.includes('eldersign')) {
        sealChaosToken(state, 'eldersign', enemy.id)
        info(state, events, `🔒 「${enemy.name}」封印了 ${tokenLabel('eldersign')}。`)
      }
      info(state, events, `👹 弱点敌人「${enemy.name}」出现并与 ${inv.name} 交战！`)
    }
    return
  }
  // 弱点数据唯一读点（Phase 1 的 weakness kind）：描述子优先，旧 DSL 回落。
  const profile = weaknessProfile(def.code)
  if (!profile) throw new Error(`未实现的弱点效果：${def.code}`)
  // 自定义结算：描述子带 resolve() 时由它接管（新卡走这条，不改引擎）。
  const descriptor = weaknessDescriptor(def.code)
  if (descriptor?.resolve) {
    descriptor.resolve({
      state, inv, seat: inv.seat, source: { code: def.code }, descriptor, events,
      context: { weakness: profile }, api: abilityApi(state, events),
    })
    return
  }
  // 旧式类型分支仍然只读数据；为了让下面的代码一字不改，这里包成同形状的 eff。
  const eff = { weakness: profile }
  // 失落的时代剧本模式弱点链（04038–04042）。
  const swapWeakness = (from, to) => {
    const index = inv.deck.indexOf(from)
    if (index >= 0) inv.deck.splice(index, 1)
    inv.deck.push(to)
  }
  if (eff.weakness.type === 'darkPact') {
    const options = aliveInvestigators(state).filter(owner => owner.location === inv.location)
    const target = options.length === 1 ? options[0].seat : requestChoice(state, { kind: 'target', source: def.code,
      seat: inv.seat, prompt: '「黑暗契约」：选择受到 2 点伤害的调查员。',
      options: options.map(owner => ({ id: String(owner.seat), label: owner.name })) })
    const victim = state.investigators[Number(target)] || inv
    applyHarm(state, victim, 2, 0, events)
    info(state, events, `「${cardName(def.code)}」对 ${victim.name} 造成 2 点伤害。`)
    return
  }
  if (eff.weakness.type === 'outOfBody') {
    // 离体体验（04264）：所有手牌洗回牌库并抽取等量，然后把本卡洗回牌库。
    const hand = [...(inv.hand || [])]
    inv.hand = []
    if (hand.length) inv.deck = shuffle([...inv.deck, ...hand], () => randomValue(state))
    inv.shuffleWeaknessAfterResolution = def.code
    info(state, events, `「${cardName(def.code)}」：${inv.name} 把 ${hand.length} 张手牌洗回牌库并重抽。`)
    if (hand.length) texts.push(...drawCards(state, inv, hand.length, events))
    return
  }
  if (eff.weakness.type === 'priceOfFailure') {
    applyHarm(state, inv, 2, 2, events)
    addDoom(state, 1, events)
    // 卡面：把 04039 从牌库移除，并把 04038 放入弃牌堆（不是牌库）。
    const index = inv.deck.indexOf(def.code)
    if (index >= 0) inv.deck.splice(index, 1)
    // Phase 5（5a-17）：弱点升级后的替换卡号在卡号规则数据里。
    inv.discard.push(weaknessUpgradeCode('priceOfFailure'))
    info(state, events, `「${cardName(def.code)}」：伤害与恐惧各 2 点，密谋 +1 毁灭；「黑暗契约」进入弃牌堆。`)
    return
  }
  if (eff.weakness.type === 'impendingDoom') {
    applyHorror(state, inv, 1, events)
    // 记录按调查员各算一份（不再写进共享的 campaign.records）。
    inv.weaknessCounters ||= {}
    inv.weaknessCounters.impendingDoom = (inv.weaknessCounters.impendingDoom || 0) + 1
    if (inv.weaknessCounters.impendingDoom > 1) swapWeakness(def.code, weaknessUpgradeCode('impendingDoom'))
    info(state, events, `「${cardName(def.code)}」：1 点恐惧并记录（第 ${inv.weaknessCounters.impendingDoom} 次）。`)
    return
  }
  if (eff.weakness.type === 'cursedFate') {
    applyHorror(state, inv, 2, events)
    inv.weaknessCounters ||= {}
    inv.weaknessCounters.cursedFate = (inv.weaknessCounters.cursedFate || 0) + 1
    if (inv.weaknessCounters.cursedFate > 1) swapWeakness(def.code, weaknessUpgradeCode('cursedFate'))
    info(state, events, `「${cardName(def.code)}」：2 点恐惧并记录（第 ${inv.weaknessCounters.cursedFate} 次）。`)
    return
  }
  if (eff.weakness.type === 'deathKnell') {
    info(state, events, `「${cardName(def.code)}」：${inv.name} 的死期到了——阵亡。`)
    inv.defeatCause = 'killed'
    inv.defeated = true
    const record = state.campaign?.investigators?.[inv.seat]
    if (record) record.status = 'killed'
    checkDefeated(state, inv.seat, events)
    return
  }
  // 血的代价：必须弃掉控制的盟友支援，或弃掉手牌中所有盟友支援；否则洗回牌库。
  if (eff.weakness.type === 'boughtInBlood') {
    const allyTrait = item => (cardDef(item.code)?.traits || [])
      .some(trait => String(trait).toLowerCase() === 'ally')
    const controlled = inv.assets.filter(asset => allyTrait(asset) && !assetCannotLeavePlay(asset))
    const handAllies = inv.hand.filter(code => (cardDef(code)?.traits || [])
      .some(trait => String(trait).toLowerCase() === 'ally'))
    let discarded = 0
    const options = []
    if (controlled.length) options.push({ id: 'asset', label: '弃掉一张你控制的盟友支援' })
    if (handAllies.length) options.push({ id: 'hand', label: '弃掉手牌中所有盟友支援' })
    const choice = options.length <= 1 ? options[0]?.id : requestChoice(state, {
      kind: 'discard', source: def.code, seat: inv.seat,
      prompt: '「血的代价」：弃掉一张盟友支援，或弃掉手牌中所有盟友支援。', options,
    })
    if (choice === 'asset' && controlled.length) {
      const chosen = controlled.length === 1 ? controlled[0].id : requestChoice(state, { kind: 'discard',
        source: def.code, seat: inv.seat, prompt: '「血的代价」：选择弃掉的盟友支援。',
        options: controlled.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
      const asset = controlled.find(item => item.id === chosen) || controlled[0]
      leaveAsset(state, inv, asset, events)
      inv.discard.push(asset.code)
      discarded = 1
      info(state, events, `「${cardName(def.code)}」：${inv.name} 弃掉「${cardName(asset.code)}」。`)
    } else if (choice === 'hand' && handAllies.length) {
      for (const code of handAllies.slice()) {
        removeOne(inv.hand, code)
        inv.discard.push(code)
        discarded++
      }
      info(state, events, `「${cardName(def.code)}」：${inv.name} 弃掉手牌中 ${discarded} 张盟友支援。`)
    }
    if (!discarded) {
      inv.shuffleWeaknessAfterResolution = def.code
      info(state, events, `「${cardName(def.code)}」没有弃掉任何支援，洗回牌库。`)
    }
    return
  }
  // 当场抓获：重整你所在地点或连接地点的所有敌人；连接地点的猎手向你移动 1 个地点。
  if (eff.weakness.type === 'caughtRedHanded') {
    const loc = state.locations.find(item => item.id === inv.location)
    const spots = new Set([inv.location, ...(loc?.connections || [])])
    let moved = 0
    for (const enemy of state.enemies.filter(item => spots.has(item.location) && !item.defeated)) {
      enemy.exhausted = false
      if (enemy.location !== inv.location && enemy.hunter) {
        enemy.location = inv.location
        moved++
      }
    }
    if (moved) info(state, events, `「${cardName(def.code)}」：${moved} 个猎手敌人向 ${inv.name} 移动。`)
    else {
      inv.shuffleWeaknessAfterResolution = def.code
      info(state, events, `「${cardName(def.code)}」没有敌人移动，洗回牌库。`)
    }
    return
  }
  // 信使之声：受到 1 点直接伤害与 1 点肉体创伤，或 1 点直接恐惧与 1 点精神创伤。
  if (eff.weakness.type === 'voiceOfTheMessenger') {
    const answer = requestChoice(state, { kind: 'effect', source: def.code, seat: inv.seat,
      prompt: '「信使之声」：选择承受的代价。',
      options: [{ id: 'damage', label: '1 点直接伤害与 1 点肉体创伤' },
        { id: 'horror', label: '1 点直接恐惧与 1 点精神创伤' }] })
    if (answer === 'damage') {
      applyDamage(state, inv, 1, events, true)
      if (!inv.defeated) addTrauma(state, inv.seat, 'physical', 1, events)
    } else {
      applyHorror(state, inv, 1, events, true)
      if (!inv.defeated) addTrauma(state, inv.seat, 'mental', 1, events)
    }
    return
  }
  if (eff.weakness.type === 'shellShock') {
    const amount = Math.floor(inv.damage / 2)
    applyHorror(state, inv, amount, events)
    info(state, events, `「${cardName(def.code)}」：${inv.name} 受到 ${amount} 点恐惧。`)
    return
  }
  if (eff.weakness.type === 'crisisOfIdentity') {
    const role = inv.role
    for (const asset of inv.assets.slice()) {
      const factions = cardDef(asset.code)?.factions || [cardDef(asset.code)?.klass].filter(Boolean)
      if (!factions.includes(role) || assetCannotLeavePlay(asset)) continue
      leaveAsset(state, inv, asset, events)
      inv.discard.push(asset.code)
    }
    const top = inv.deck.pop()
    if (top) inv.discard.push(top)
    const topDef = cardDef(top)
    inv.role = !topDef || isWeaknessCard(topDef) ? 'neutral'
      : (topDef.factions || [topDef.klass, topDef.klass2, topDef.klass3].filter(Boolean))[0] || 'neutral'
    info(state, events, `「${cardName(def.code)}」弃置了当前角色支援，并将角色切换为${CLASS_NAMES[inv.role] || inv.role}。`)
    return
  }
  if (eff.weakness.type === 'starsOfHyades') {
    const shouldShuffle = inv.deck.length >= 5
    if (inv.beneath?.length) {
      const index = Math.floor(randomValue(state) * inv.beneath.length)
      const removed = inv.beneath.splice(index, 1)[0]
      state.removedFromGame ||= []
      state.removedFromGame.push(removed)
      info(state, events, `「${cardName(def.code)}」随机将赛菲娜下方的「${cardName(removed)}」移出游戏。`)
    } else {
      applyHarm(state, inv, 1, 1, events)
    }
    if (shouldShuffle) inv.shuffleWeaknessAfterResolution = def.code
    return
  }
  if (eff.weakness.type === 'threat') {
    // Phase 5（5a-12）：「噩梦来袭」这类「入场时横置你所有支援」由条目级标记声明。
    if (registeredEntry(def.code)?.weaknessExhaustsAssets) for (const asset of inv.assets) asset.exhausted = true
    if (def.type === 'asset') replaceAssets(state, inv, def, events)
    if (eff.weakness.clues != null) {
      inv.threat.push(newCardInstance(state, def.code, { counters: eff.weakness.clues }))
    } else if (eff.weakness.horror != null) {
      inv.threat.push(newCardInstance(state, def.code, { counters: eff.weakness.horror }))
    } else if (eff.weakness.debt) {
      inv.threat.push(newCardInstance(state, def.code, { resources: eff.weakness.resources || 0, debtPaymentsThisRound: 0 }))
    } else {
      inv.threat.push(newCardInstance(state, def.code, eff.weakness.initialUses == null ? {}
        : { uses: eff.weakness.initialUses, usesType: eff.weakness.usesType || 'charges', exhausted: false }))
    }
    info(state, events, `⚠️ 「${cardName(def.code)}」进入 ${inv.name} 的威胁区域。`)
    return
  }
  if (eff.weakness.effects) {
    for (const fx of eff.weakness.effects) resolveEffect(state, inv.seat, fx, makeRuntime(state, events))
  } else {
    resolveEffect(state, inv.seat, eff.weakness, makeRuntime(state, events))
  }
  checkDefeated(state, inv.seat, events)
}

  return resolveWeakness
}
