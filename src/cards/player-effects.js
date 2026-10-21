// 玩家卡效果调度（原 engine.js 的 playerCardEffect，Phase 6 · 6d-15 拆出）。
//
// 位置说明：它在 src/cards/ 而不是 src/engine/ —— 玩家卡效果属于内容层，
// Phase 6 门禁（tests/phase6-guard.test.mjs）要求 src/engine 里不出现战役名，
// 这个函数的命名与注释天然带 "dunwich"，放到 cards 层既符合职责也满足门禁。
//
// 这个函数是「数据体描述不了的玩家卡效果」的落脚点：最初只服务敦威治卡包，
// 名字保留了历史（dunwich），但它现在按 `effect.type` 分派所有战役的玩家卡复杂效果。
// 拆成独立模块是战役插件化的第一步：以后按 `content/campaigns/<id>/player-effects.js`
// 继续切分时，这一层就是调度点。
//
// 依赖注入同前；doFight / doPlay / doInvestigate / performTest 是工厂产物，用惰性 thunk。

export function createPlayerEffects(deps) {
  const {
    aliveInvestigators,
    beginChaosTest,
    cardDef,
    cardName,
    chooseEnemy,
    damageEnemy,
    discardRandomFromHand,
    disengageEnemy,
    doFight,
    doInvestigate,
    doPlay,
    doResign,
    drawCards,
    drawChaosToken,
    drawEncounter,
    endChaosTest,
    enemyAttack,
    enemyEvadeValue,
    enemyFightValue,
    engageEnemy,
    info,
    leaveAsset,
    newCardInstance,
    notifyCluesRemoved,
    performTest,
    placeDoomOnCard,
    randomValue,
    requestChoice,
    shuffle,
    triggerReaction,
  } = deps

function playerCardEffect(state, seat, effect, events) {
  const inv = state.investigators[seat]
  if (effect.type === 'engageEnemies') {
    const enemies = state.enemies.filter(enemy => enemy.location === inv.location && enemy.engagedSeat !== seat)
    for (const enemy of enemies) engageEnemy(state, enemy, seat, events)
    if (effect.drawPerEnemy) for (const line of drawCards(state, inv, enemies.length, events)) info(state, events, line)
    return
  }
  if (effect.type === 'teamwork') {
    const others = aliveInvestigators(state).filter(other => other.seat !== seat && other.location === inv.location)
    if (!others.length) return
    const targetSeat = others.length === 1 ? String(others[0].seat) : requestChoice(state, {
      kind: 'target', source: effect.code, seat, prompt: '选择交换物品、盟友或资源的调查员。',
      options: others.map(other => ({ id: String(other.seat), label: other.name })),
    })
    const target = others.find(other => String(other.seat) === targetSeat)
    const options = []
    if (inv.resources) options.push({ id: 'resource', label: '交给对方 1 资源' })
    for (const asset of inv.assets.filter(item => (cardDef(item.code)?.traits || []).some(t => ['item', 'ally'].includes(String(t).toLowerCase()))))
      options.push({ id: asset.id, label: `交给对方：${cardName(asset.code)}` })
    if (!options.length) return
    const answer = requestChoice(state, { kind: 'target', source: effect.code, seat, prompt: '选择要交换的内容。', options })
    if (answer === 'resource') { inv.resources--; target.resources++ }
    else { const asset = inv.assets.find(item => item.id === answer); if (asset) { leaveAsset(state, inv, asset); target.assets.push(asset) } }
    return
  }
  if (effect.type === 'investigateConnectingClue') {
    const loc = state.locations.find(item => item.id === inv.location)
    const targets = (loc?.connections || []).map(id => state.locations.find(item => item.id === id)).filter(item => item?.clues > 0)
    if (!targets.length) return doInvestigate(state, seat, {}, events, true)
    return performTest(state, seat, 'intellect', loc.shroud + (loc.shroudMod || 0), { source: { label: '调查', name: cardName(effect.code), code: effect.code }, resolve: result => {
      if (!result.success) return
      const targetId = targets.length === 1 ? targets[0].id : requestChoice(state, { kind: 'location', source: effect.code, seat,
        prompt: '选择一个连接地点发现线索。', options: targets.map(item => ({ id: item.id, label: item.name })) })
      const target = targets.find(item => item.id === targetId)
      target.clues--; inv.clues++; info(state, events, `${inv.name} 从「${target.name}」发现 1 条线索。`)
      notifyCluesRemoved(state, target, 1, events)
    } })
  }
  if (effect.type === 'liquidCourage') {
    const targets = aliveInvestigators(state).filter(other => other.location === inv.location && other.horror > 0)
    if (!targets.length) return
    const targetSeat = targets.length === 1 ? String(targets[0].seat) : requestChoice(state, { kind: 'target', source: effect.code, seat,
      prompt: '选择治疗恐惧的调查员。', options: targets.map(other => ({ id: String(other.seat), label: other.name })) })
    const target = targets.find(other => String(other.seat) === targetSeat)
    target.horror--
    return performTest(state, target.seat, 'willpower', 2, { source: { label: '饮用烈酒', name: cardName(effect.code), code: effect.code }, resolve: result => {
      if (result.success) {
        const healed = Math.min(target.horror, 1)
        target.horror -= healed
        info(state, events, `${target.name} 检定成功，额外治愈 ${healed} 点恐惧。`)
      } else {
        info(state, events, `${target.name} 检定失败，随机弃掉 1 张手牌。`)
        discardRandomFromHand(state, target, 1, events)
      }
    } })
  }
  if (effect.type === 'bindMonster') {
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite && !enemy.bindMonster)
    if (!candidates.length) { info(state, events, '本地点没有可绑定的非精英敌人。'); return }
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'target', source: effect.code || 'bindMonster', seat, prompt: '选择要绑定的非精英敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find(item => item.id === id)
    return performTest(state, seat, 'willpower', enemyEvadeValue(state, enemy, inv), {
      source: { label: '绑定怪物', name: enemy.name, code: effect.code || null }, resolve: result => {
        if (!result.success || !state.enemies.includes(enemy)) return
        // Evade the enemy, then attach Bind Monster to it.
        enemy.exhausted = true
        if (enemy.engagedSeat != null) disengageEnemy(state, enemy)
        enemy.bindMonster = { ownerSeat: seat, code: effect.code || null }
        info(state, events, `「绑定怪物」附属于「${enemy.name}」；它被躲避，不能移动，并在重整阶段保持横置。`)
      },
    })
  }
  if (effect.type === 'doubleUses') {
    const targets = aliveInvestigators(state).filter(other => other.location === inv.location).flatMap(owner => owner.assets.filter(asset => effect.usesTypes.includes(asset.usesType)))
    if (!targets.length) return
    const id = requestChoice(state, { kind: 'target', source: effect.code, seat, prompt: '选择弹药或补给翻倍的支援。', options: targets.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
    const asset = targets.find(item => item.id === id); if (asset) asset.uses *= 2
    return
  }
  if (effect.type === 'drawEncounterAll') { for (const target of aliveInvestigators(state)) drawEncounter(state, target, events); return }
  if (effect.type === 'redirectFailedAttack') {
    const context = state._reaction?.context || state._reaction
    if (context?.when !== 'attackFail' && state._reaction?.when !== 'attackFail') return
    const original = context.enemy
    const targets = state.enemies.filter(enemy => enemy.location === inv.location && enemy.id !== original?.id)
    if (!targets.length) return
    const id = targets.length === 1 ? targets[0].id : requestChoice(state, {
      kind: 'target', source: effect.code || 'redirectFailedAttack', seat, prompt: '选择承受这次攻击伤害的另一名敌人。',
      options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const target = targets.find(enemy => enemy.id === id)
    context.redirected = true
    damageEnemy(state, target, Math.max(1, context.attackDamage || 1), seat, events, effect.code || null)
    info(state, events, `${inv.name} 的攻击落空后改为对「${target.name}」造成 ${Math.max(1, context.attackDamage || 1)} 点伤害。`)
    return
  }
  if (effect.type === 'flare') {
    const choice = requestChoice(state, { kind: 'effect', source: effect.code, seat, prompt: '选择照明弹的效果。',
      options: [{ id: 'fight', label: '战斗 +3，伤害 +2' }, { id: 'ally', label: '搜索任意调查员牌库顶 9 张并使一名盟友入场' }] })
    if (choice === 'fight') return doFight(state, seat, { enemyId: chooseEnemy(state, seat, {}).id, combatBonus: 3, damageBonus: 2 }, events, true)
    const owners = aliveInvestigators(state)
    const ownerSeat = owners.length === 1 ? owners[0].seat : Number(requestChoice(state, { kind: 'target', source: effect.code, seat,
      prompt: '选择要搜索的牌库。', options: owners.map(owner => ({ id: String(owner.seat), label: `${owner.name} 的牌库` })) }))
    const owner = state.investigators[ownerSeat]
    const cards = owner.deck.slice(-Math.min(9, owner.deck.length))
    const allies = cards.filter(code => (cardDef(code)?.traits || []).some(t => String(t).toLowerCase() === 'ally'))
    if (allies.length) {
      const code = allies.length === 1 ? allies[0] : allies[Number(requestChoice(state, { kind: 'card', source: effect.code, seat,
        prompt: '选择要放置入场的盟友支援。', options: allies.map((item, index) => ({ id: String(index), cardCode: item, label: cardName(item) })) }))]
      const index = owner.deck.lastIndexOf(code)
      owner.deck.splice(index, 1)
      const asset = newCardInstance(state, code, { exhausted: false }); inv.assets.push(asset)
      triggerReaction(state, seat, 'assetEnteredPlay', events, { assetCode: code, assetId: asset.id, location: inv.location })
    }
    owner.deck = shuffle(owner.deck, () => randomValue(state)); return
  }
  if (effect.type === 'standTogether') {
    const targets = aliveInvestigators(state).filter(other => other.seat !== seat && other.location === inv.location)
    if (!targets.length) return
    const target = targets.length === 1 ? targets[0] : targets.find(other => other.seat === Number(requestChoice(state, {
      kind: 'target', source: effect.code, seat, prompt: '选择与你共享卡牌与资源的调查员。',
      options: targets.map(other => ({ id: String(other.seat), label: other.name })),
    })))
    for (const owner of [inv, target]) { owner.resources += 2; for (const line of drawCards(state, owner, 2, events)) info(state, events, line) }
    return
  }
  if (effect.type === 'resign') { doResign(state, seat, events); return }
  if (effect.type === 'hypnoticGaze') {
    if (state._reaction?.when !== 'enemyAttack') return
    state._reaction.cancelled = true
    beginChaosTest(state); const token = drawChaosToken(state); endChaosTest(state, [token])
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token)) {
      const enemy = state._reaction.context?.enemy || state._reaction.enemy
      if (enemy) damageEnemy(state, enemy, enemy.damage || 0, seat, events)
    }
    return
  }
  if (effect.type === 'attachLure') {
    const loc = state.locations.find(item => item.id === inv.location)
    // Phase 5（5a-14）：标记卡号来自效果数据（effect.code），引擎不再写死。
    if (loc) loc.lure = { seat, round: state.round, code: effect.code || null }
    return
  }
  if (effect.type === 'healHorrorAtLocationByEnemy') {
    const enemy = state._reaction?.context?.enemy || state._reaction?.enemy
    if (!enemy || !(enemy.traits || []).some(t => String(t).toLowerCase() === 'monster')) return
    for (const target of aliveInvestigators(state).filter(other => other.location === inv.location))
      target.horror = Math.max(0, target.horror - (enemy.horror || 0))
    return
  }
  if (effect.type === 'exposeWeakness') {
    const enemies = state.enemies.filter(enemy => enemy.location === inv.location)
    if (!enemies.length) { info(state, events, '本地点没有可选择弱点的敌人。'); return }
    const enemy = enemies.length === 1 ? enemies[0] : enemies.find(item => item.id === requestChoice(state, {
      kind: 'target', source: effect.code, seat, prompt: '选择要暴露弱点的敌人。',
      options: enemies.map(item => ({ id: item.id, label: item.name })),
    }))
    if (!enemy) return
    const difficulty = enemyFightValue(state, enemy, inv)
    return performTest(state, seat, 'intellect', difficulty, { source: { label: '揭露弱点', name: enemy.name, code: effect.code }, resolve: result => {
      if (!result.success) return
      const margin = Math.max(1, result.value - difficulty)
      const active = enemy.fightReduction?.round === state.round && enemy.fightReduction.phase === state.phase
      enemy.fightReduction = { amount: (active ? enemy.fightReduction.amount : 0) + margin, round: state.round, phase: state.phase }
      info(state, events, `「${enemy.name}」本阶段下一次被攻击时战斗值 -${margin}。`)
    } })
  }
  if (effect.type === 'lookTopDeckAndDoom') {
    const choice = requestChoice(state, { kind: 'deck', source: effect.assetId || effect.code, seat, prompt: '选择查看的牌库。',
      options: [{ id: 'encounter', label: '遭遇牌库' }, ...state.investigators.map(owner => ({ id: String(owner.seat), label: `${owner.name} 的牌库` }))] })
    const deck = choice === 'encounter' ? state.encounterDeck : state.investigators[Number(choice)].deck
    const top = deck.at(-1); if (!top) return
    const asset = inv.assets.find(item => item.id === effect.assetId)
    const bury = requestChoice(state, { kind: 'card', source: effect.assetId || effect.code, seat, prompt: `顶牌是「${cardName(top)}」，是否放到牌库底并在艾丽莎上放 1 毁灭？`,
      options: [{ id: 'keep', label: '保留在顶端' }, { id: 'bottom', label: '放到牌库底' }] })
    if (bury === 'bottom') { deck.pop(); deck.unshift(top); if (asset) placeDoomOnCard(state, asset, 1, events, { silent: true }) }
    return
  }
  if (effect.type === 'redrawChaos') return
  if (effect.type === 'cancelHarmGainResources') {
    const context = state._reaction
    if (!context || context.when !== 'harmDealt') return
    const maximum = Math.min(effect.maximum || 5, (context.damage || 0) + (context.horror || 0))
    const options = []
    for (let damage = 0; damage <= Math.min(context.damage || 0, maximum); damage++) {
      for (let horror = 0; horror <= Math.min(context.horror || 0, maximum - damage); horror++) {
        if (damage + horror > 0) options.push({ id: `${damage}:${horror}`,
          label: `取消 ${damage} 伤害、${horror} 恐惧${effect.noResources ? '' : `（获得 ${damage + horror} 资源）`}` })
      }
    }
    if (!options.length) return
    const answer = options.length === 1 ? options[0].id : requestChoice(state, {
      kind: 'harm', source: effect.code, seat, prompt: '选择“我见过更糟的”要取消的伤害与恐惧。', options,
    })
    const [damage, horror] = answer.split(':').map(Number)
    context.damage -= damage; context.horror -= horror
    if (!effect.noResources) inv.resources += damage + horror
    info(state, events, `${inv.name} 取消 ${damage} 点伤害与 ${horror} 点恐惧${effect.noResources ? '。' : `，并获得 ${damage + horror} 资源。`}`)
    return
  }
  if (effect.type === 'removeDoomControlled') {
    const targets = inv.assets.filter(asset => (asset.doom || 0) > 0); if (!targets.length) return
    const target = targets.length === 1 ? targets[0] : targets.find(asset => asset.id === requestChoice(state, {
      kind: 'target', source: effect.code, seat, prompt: '选择要移除全部毁灭标记的卡牌。',
      options: targets.map(asset => ({ id: asset.id, label: `${cardName(asset.code)}（${asset.doom} 毁灭）` })),
    }))
    if (!target) return
    target.doom = 0
    info(state, events, `「${cardName(target.code)}」上的毁灭标记被全部移除。`)
    return
  }
  if (effect.type === 'temporaryAllyFromDiscard') {
    const candidates = aliveInvestigators(state).flatMap(owner => owner.discard
      .map(code => ({ owner, code }))
      .filter(item => (cardDef(item.code)?.traits || []).some(t => String(t).toLowerCase() === 'ally')))
    if (!candidates.length) return
    const chosen = candidates.length === 1 ? candidates[0] : (() => {
      const id = requestChoice(state, { kind: 'card', source: effect.code, seat, prompt: '选择任意玩家弃牌堆中的盟友支援。',
        options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
          label: `${cardName(item.code)}（${item.owner.name} 的弃牌堆）` })) })
      return candidates[Number(id)]
    })()
    const index = chosen.owner.discard.indexOf(chosen.code); chosen.owner.discard.splice(index, 1)
    inv.assets.push(newCardInstance(state, chosen.code, { exhausted: false, temporaryAllyRound: state.round }))
    info(state, events, `${inv.name} 让「${cardName(chosen.code)}」暂时入场。`)
    return
  }
  if (effect.type === 'playItemFromHand') {
    const items = inv.hand.map((code, index) => ({ code, index }))
      .filter(item => (cardDef(item.code)?.traits || []).some(t => String(t).toLowerCase() === 'item'))
    if (!items.length) return
    const chosen = items.length === 1 ? items[0] : items.find(item => String(item.index) === requestChoice(state, {
      kind: 'card', source: effect.code, seat, prompt: '选择要打出的道具支援（支付其费用）。',
      options: items.map(item => ({ id: String(item.index), cardCode: item.code, label: cardName(item.code) })),
    }))
    const code = chosen.code; doPlay(state, seat, code, events); return
  }
  if (effect.type === 'decipheredReality') {
    const revealed = state.locations.filter(loc => loc.revealed)
    const difficulty = Math.max(0, ...revealed.map(loc => loc.shroud + (loc.shroudMod || 0)))
    return performTest(state, seat, 'intellect', difficulty, { source: { label: '调查', name: cardName(effect.code), code: effect.code }, resolve: result => {
      if (result.success) for (const loc of revealed) if (loc.clues > 0) { loc.clues--; inv.clues++; notifyCluesRemoved(state, loc, 1, events) }
    } })
  }
  if (effect.type === 'redrawEncounter') {
    const context = state._reaction?.context || state._reaction
    if (context?.when === 'encounterDrawn' || state._reaction?.when === 'encounterDrawn') {
      context.cancelled = true
      context.redraw = true
    }
    return
  }
  if (effect.type === 'returnCommittedSkill') {
    const candidates = (state.skillTest?.committed || []).filter(item => item.seat === seat && cardDef(item.code)?.type === 'skill')
    if (!candidates.length) return
    const id = candidates.length === 1 ? '0' : requestChoice(state, { kind: 'card', source: effect.code, seat,
      prompt: '选择一张已投入的技能牌返回其持有者手牌。',
      options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
        label: `${cardName(item.code)}（${state.investigators[item.seat].name}）` })),
    })
    const chosen = candidates[Number(id)]
    const index = state.skillTest.committed.indexOf(chosen)
    if (index >= 0) state.skillTest.committed.splice(index, 1)
    state.investigators[chosen.seat].hand.push(chosen.code)
    info(state, events, `「再试一次」将 ${cardName(chosen.code)} 返回 ${state.investigators[chosen.seat].name} 的手牌。`)
    return
  }
  info(state, events, `「${effect.type}」已进入敦威治专属时序。`)
}

  return playerCardEffect
}
