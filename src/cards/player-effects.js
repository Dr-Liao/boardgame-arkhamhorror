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
