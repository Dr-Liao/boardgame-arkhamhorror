// 牌堆操作（查看 / 占卜 / 检索 / 移动 / 抽牌 / 弃牌）从 engine.js 拆出的模块
// （Phase 6 · 6d-28）。
//
// 这一组是「牌怎么在区域之间移动」：
//   lookZoneAdapter / lookAt / scryDeck —— 查看牌堆顶（含选择与顺序决定）
//   searchDeck                          —— 检索（洗牌、展示、选择）
//   moveCardTo                          —— 区域搬运（手牌/牌库/弃牌/放逐/场上）
//   drawCards / discardRandomFromHand   —— 抽牌与随机弃牌
//   removeOne / removeCardByCode        —— 按码移除
// 它们被卡牌效果、剧本运行时与 API 同时使用。

export function createDeckOps(deps) {
  const {
    EFFECTS,
    aliveInvestigators,
    applyHorror,
    attachCardTo,
    canDiscardFromHand,
    cardDef,
    cardName,
    describeCardMove,
    describeLook,
    describeSearch,
    discardLocked,
    // P6（食梦者）：被查找到的那张牌自己的规则（searchedCardRule）需要这两个读点。
    discoverClueAt,
    drawEncounter,
    findZoneCard,
    info,
    isThreatWeakness,
    isWeaknessCard,
    leaveAsset,
    newPlayerAssetInstance,
    normalizeCardMove,
    normalizeLookOptions,
    normalizeSearchOptions,
    randomValue,
    registeredEntry,
    removeThreat,
    requestChoice,
    reactionWindow,
    resolveWeakness,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    campaignCardDrawReaction,
    triggerReaction,
    weaknessProfile,
  } = deps

function lookZoneAdapter(state, seat, zone, targetSeat = null, count = 3) {
  const inv = state.investigators[seat]
  // P6（食梦者）：看牌张数不再固定 3——曼蒂·汤普森可以让一次查找多 3 张，
  // 旧实现在适配器里写死 slice(-3)，多出来的张数会被静默丢掉。
  const take = Math.max(1, Number(count) || 3)
  const readArray = array => array.slice(-take).reverse()
  const adapter = (getArray, setArray) => ({
    pile: readArray(getArray()),
    detach: count => {
      const array = getArray()
      const removed = array.splice(Math.max(0, array.length - count), count)
      setArray(array)
      return removed.reverse()
    },
    attach: (cards, where = 'top') => {
      const array = getArray()
      if (where === 'bottom') array.unshift(...cards)
      else array.push(...cards.slice().reverse())
      setArray(array)
    },
    get owner() { return null },
  })
  switch (zone) {
    case 'deck':
    case 'investigatorDeck': {
      const owner = state.investigators[Number.isInteger(targetSeat) ? targetSeat : seat] || inv
      if (!owner) return null
      const base = adapter(() => owner.deck, next => { owner.deck = next })
      return { ...base, owner }
    }
    case 'discard':
      if (!inv) return null
      return { ...adapter(() => inv.discard, next => { inv.discard = next }), owner: inv }
    case 'encounterDeck':
      return adapter(() => state.encounterDeck, next => { state.encounterDeck = next })
    case 'explorationDeck':
      state.explorationDeck ||= []
      return adapter(() => state.explorationDeck, next => { state.explorationDeck = next })
    default: return null
  }
}

// 看牌：默认「看 N 张、洗回」；choose>0 时把选中的牌放进手牌（检索语义）。

// P6（食梦者）查找牌库的两道读点（deck-ops 是「查找」的唯一实现）：
//   · 窗口 searchWouldResolve：查找开始之前。曼蒂·汤普森「该调查员可以额外查找 3 张卡牌，或者
//     该次查找多结算 1 个目标」——能力写 context.extraCards / context.extraTargets。
//   · 条目级 searchedCardRule：本次查找的牌确定之后，「被找到的那张牌自己」的规则
//     （神秘证据 reveal/take、惊人的发现 discard + cancelSearch）。牌还在牌库里，所以不是窗口。
// 两者只对「正在查找牌库/遭遇牌库」的座位生效。
function searchExplain(zone) {
  return zone === 'encounterDeck' ? '遭遇牌库' : '牌库'
}

function searchWouldResolve(state, inv, zone, count, choose, source, events) {
  if (!reactionWindow) return { count, choose }
  const context = reactionWindow(state, 'searchWouldResolve', {
    when: 'searchWouldResolve',
    seat: inv?.seat ?? null,
    location: inv?.location ?? null,
    zone,
    count,
    choose,
    source: source || null,
    extraCards: 0,
    extraTargets: 0,
    prompt: `${inv?.name || '调查员'} 将要查找${searchExplain(zone)}`,
  }, events) || {}
  return {
    count: Math.max(0, count + (Number(context.extraCards) || 0)),
    choose: Math.max(0, choose + (Number(context.extraTargets) || 0)),
  }
}
function searchedCardsWindow(state, inv, zoneAdapter, codes, events) {
  // P6（食梦者）：查找的牌确定后，「被找到的那张牌自己」的效果由条目上的声明式规则
  // `searchedCardRule` 表达——因为它还在牌库里，引擎的能力源枚举（手牌/场上/调查员）
  // 看不到它，用反应描述子会永远不触发。规则形状：
  //   { mode: 'reaction' | 'forced', label, take?, discard?, cancelSearch?, drawEncounter?, discoverClue? }
  // 读点只有这里；未知字段直接忽略（注册期已由 ability.js 校验）。
  let pile = [...codes]
  let cancelled = false
  const owner = zoneAdapter?.owner || null
  const removeFromDeck = code => {
    if (!owner?.deck) return
    const index = owner.deck.lastIndexOf(code)
    if (index >= 0) owner.deck.splice(index, 1)
  }
  const take = code => {
    pile = pile.filter(item => item !== code)
    removeFromDeck(code)
    if (owner) owner.hand.push(code)
    else state.encounterDeck.push(code)
  }
  const discard = code => {
    pile = pile.filter(item => item !== code)
    removeFromDeck(code)
    if (owner) owner.discard.push(code)
    else state.encounterDiscard.push(code)
  }
  for (const code of [...codes]) {
    const rule = registeredEntry(code)?.searchedCardRule
    if (!rule || !pile.includes(code)) continue
    const apply = () => {
      if (rule.take) take(code)
      if (rule.discard) discard(code)
      if (rule.cancelSearch) cancelled = true
      if (rule.discoverClue && inv) discoverClueAt(state, inv, Number(rule.discoverClue) || 0, events)
      if (rule.drawEncounter && inv) drawEncounter(state, inv, events)
      info(state, events, `「${cardName(code)}」：${rule.label || '查找效果'}`)
    }
    if (rule.mode === 'forced') { apply(); continue }
    const answer = requestChoice(state, {
      kind: 'reaction', source: code, seat: inv?.seat ?? state.currentSeat, canSkip: true,
      prompt: rule.prompt || `查找的牌中有「${cardName(code)}」：是否结算？`,
      options: [{ id: 'skip', label: '不结算' }, { id: 'trigger', label: '结算' }],
    })
    if (answer === 'trigger') apply()
  }
  return { pile, cancel: cancelled }
}

function lookAt(state, seat, rawOptions, events) {
  const inv = state.investigators[seat]
  const options = rawOptions?.zone ? rawOptions : normalizeLookOptions(rawOptions)
  // P6（食梦者）：查找之前的窗口可以要求「额外查找 N 张 / 多结算 1 个目标」。
  // 先开窗口再建适配器：额外张数必须真的从牌库顶取出，而不是被适配器截断。
  const windowed = searchWouldResolve(state, inv, options.zone, options.count, options.choose, options.source, events)
  const zone = lookZoneAdapter(state, seat, options.zone, options.targetSeat, Math.max(options.count, windowed.count))
  if (!zone || !zone.pile.length) {
    info(state, events, `${inv?.name || '调查员'} 查看的牌库是空的。`)
    return []
  }
  const count = Math.min(windowed.count, zone.pile.length)
  let pile = zone.pile.slice(0, count)
  const label = describeLook({ ...options, count })
  info(state, events, `👁 ${inv?.name || '调查员'}：${label}。`)
  // 先把看过的牌整体摘出来，之后的「拿走/放回」都不会和原区域里的副本打架。
  zone.detach(count)
  // P6（食梦者）：查找的牌确定后，「被找到的那张牌自己」的规则（揭示抽走 / 弃掉 / 取消这次查找）。
  const revealed = searchedCardsWindow(state, inv, zone, pile, events)
  pile = revealed.pile
  if (revealed.cancel) {
    zone.attach(pile, 'top')
    if (options.zone === 'encounterDeck') state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
    else if (options.zone === 'explorationDeck') state.explorationDeck = shuffle(state.explorationDeck, () => randomValue(state))
    else if (zone.owner) zone.owner.deck = shuffle(zone.owner.deck, () => randomValue(state))
    info(state, events, `${inv?.name || '调查员'} 的这次查找被取消，牌库已洗回。`)
    return []
  }

  const taken = []
  for (let i = 0; i < windowed.choose && pile.length; i++) {
    const selectable = pile.filter(code => {
      if (!options.filter) return true
      const def = cardDef(code)
      if (!def) return false
      if (options.filter.type && def.type !== options.filter.type) return false
      if (options.filter.trait && !(def.traits || []).some(trait => String(trait).toLowerCase() === String(options.filter.trait).toLowerCase())) return false
      if (options.filter.usesType) {
        const usesType = registeredEntry(code)?.usesType
        if (!usesType || String(usesType).toLowerCase() !== String(options.filter.usesType).toLowerCase()) return false
      }
      return true
    })
    if (!selectable.length) break
    const answer = requestChoice(state, {
      kind: 'search', source: options.source || 'lookAt', seat,
      prompt: options.prompt || `${label}：选择 1 张拿走（剩余 ${options.choose - i}）。`,
      options: selectable.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })),
    })
    const chosen = selectable[Number(answer)]
    if (!chosen) break
    pile.splice(pile.indexOf(chosen), 1)
    taken.push(chosen)
    if (zone.owner) zone.owner.hand.push(chosen)
    info(state, events, `${inv?.name || '调查员'} 取走「${cardName(chosen)}」。`)
  }
  // 排列：只对「看过但没拿走」的牌有意义（≤4 张时用全排列询问，避免组合爆炸）。
  let ordered = pile
  if (options.arrange && pile.length > 1 && pile.length <= 4) {
    const permutations = []
    const permute = (arr, prefix = []) => {
      if (!arr.length) { permutations.push(prefix); return }
      for (let i = 0; i < arr.length; i++) permute(arr.slice(0, i).concat(arr.slice(i + 1)), prefix.concat([arr[i]]))
    }
    permute(pile)
    const answer = requestChoice(state, {
      kind: 'look', source: options.source || 'lookAt', seat, prompt: '选择放回的顺序（从上到下）。',
      options: permutations.map((order, index) => ({ id: String(index), cardCodes: order, label: order.map(code => cardName(code)).join(' → ') })),
    })
    ordered = permutations[Number(answer)] || pile
  }
  const returned = [...ordered]
  if (returned.length) {
    switch (options.returnStrategy) {
      case 'discard':
        if (zone.owner) zone.owner.discard.push(...returned)
        else state.encounterDiscard.push(...returned)
        break
      case 'shuffle': {
        // 洗回：先放回原区域，再洗牌（洗牌走 randomValue，可重放）。
        zone.attach(returned)
        if (options.zone === 'encounterDeck') state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
        else if (options.zone === 'explorationDeck') state.explorationDeck = shuffle(state.explorationDeck, () => randomValue(state))
        else if (zone.owner) zone.owner.deck = shuffle(zone.owner.deck, () => randomValue(state))
        break
      }
      case 'bottom':
        zone.attach(returned, 'bottom')
        break
      case 'top':
      case 'keep':
      default:
        zone.attach(returned, 'top')
        break
    }
  }
  return taken
}

// 检索整副牌库（trait / type / usesType 之一），取出 choose 张进手牌，然后洗牌。

function scryDeck(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const choices = []
  for (const target of aliveInvestigators(state)) choices.push({ id: 'deck:' + target.seat, label: target.name + ' 的牌库' })
  choices.push({ id: 'encounter', label: '遭遇牌库' })
  const source = choices.length === 1 ? choices[0].id : requestChoice(state, {
    kind: 'scry', source: effect.source || 'scry', seat, prompt: '选择要查看的牌库顶 3 张。',
    options: choices,
  })
  let pile
  if (source === 'encounter') pile = state.encounterDeck.slice(-3).reverse()
  else {
    const target = state.investigators[Number(source.slice(5))]
    pile = target ? target.deck.slice(-3).reverse() : []
  }
  if (!pile.length) { info(state, events, '所选牌库已空。'); return }
  const permutations = []
  const permute = (arr, prefix = []) => {
    if (!arr.length) { permutations.push(prefix); return }
    for (let i = 0; i < arr.length; i++) permute(arr.slice(0, i).concat(arr.slice(i + 1)), prefix.concat([arr[i]]))
  }
  permute(pile)
  const answer = permutations.length === 1 ? '0' : requestChoice(state, {
    kind: 'scry', source: effect.source || 'scry', seat, prompt: '选择牌库顶的顺序（从上到下）。',
    options: permutations.map((order, index) => ({ id: String(index), cardCodes: order, label: order.map(code => cardName(code)).join(' → ') })),
  })
  const ordered = permutations[Number(answer)]
  if (source === 'encounter') {
    state.encounterDeck.splice(Math.max(0, state.encounterDeck.length - pile.length), pile.length, ...ordered.slice().reverse())
  } else {
    const target = state.investigators[Number(source.slice(5))]
    target.deck.splice(Math.max(0, target.deck.length - pile.length), pile.length, ...ordered.slice().reverse())
  }
  info(state, events, inv.name + ' 查看并重新排列了牌库顶 ' + pile.length + ' 张。')
}

// ---------------------------------------------------------------------------
// Phase 2（B5）：看牌与检索的统一入口
//
// 「看顶 N 张、排列、放回顶/底/洗回」「看弃牌堆」「搜索整副牌库」此前没有通用写法，
// 每张卡都在引擎里手写 splice/push。这里做成一份实现，选项的形状与校验在 look.js（纯函数），
// 本函数的职责只有：读牌、询问、写回、记日志。
//
// 一切随机走 randomValue(state)，一切询问走 requestChoice(state)，
// 因此看牌/洗回同样可重放，不需要额外的快照。
// ---------------------------------------------------------------------------

// 区域适配器：{ pile: 从顶到底的牌, detach(n): 从区域里摘掉顶 n 张, attach(cards, where): 放回 }。
// 「先摘掉再放回」是关键：如果只替换尾部，choose>0 拿走的牌会留在原来的区域里（重复）。

function searchDeck(state, seat, rawOptions, events) {
  const inv = state.investigators[seat]
  const options = rawOptions?.choose ? rawOptions : normalizeSearchOptions(rawOptions)
  if (!inv) return []
  const matches = inv.deck.filter(code => {
    const def = cardDef(code)
    if (!def) return false
    if (options.type && def.type !== options.type) return false
    if (options.trait && !(def.traits || []).some(trait => String(trait).toLowerCase() === String(options.trait).toLowerCase())) return false
    // usesType 不是卡面数据，按注册条目 / 旧 DSL 的 uses 判定。
    if (options.usesType) {
      const usesType = registeredEntry(code)?.usesType
      if (!usesType || String(usesType).toLowerCase() !== String(options.usesType).toLowerCase()) return false
    }
    return true
  })
  if (!matches.length) {
    info(state, events, `${inv.name} 检索牌库，没有符合条件的卡牌${options.shuffle ? '，洗回牌库。' : '。'}`)
    if (options.shuffle) inv.deck = shuffle(inv.deck, () => randomValue(state))
    return []
  }
  // P6（食梦者）：整库检索同样开查找窗口（「多结算 1 个目标」用 choose+1；
  // 「取消这次查找」把牌库洗回；「揭示抽走」把那张直接加入手牌）。
  const windowed = searchWouldResolve(state, inv, 'investigatorDeck', matches.length, options.choose, options.source, events)
  const revealed = searchedCardsWindow(state, inv, { owner: inv }, matches.filter(code => inv.deck.includes(code)), events)
  if (revealed.cancel) {
    inv.deck = shuffle(inv.deck, () => randomValue(state))
    info(state, events, `${inv.name} 的这次检索被取消，牌库已洗回。`)
    return []
  }
  const searched = revealed.pile.filter(code => inv.deck.includes(code))
  const taken = []
  for (let i = 0; i < windowed.choose && searched.length; i++) {
    const selectable = searched.filter(code => inv.deck.includes(code) && !taken.includes(code))
    if (!selectable.length) break
    const answer = requestChoice(state, {
      kind: 'search', source: options.source || 'searchDeck', seat, canSkip: options.optional,
      prompt: options.prompt || `${describeSearch({ ...options, choose: windowed.choose - i })}：选择 1 张加入手牌。`,
      options: [...(options.optional ? [{ id: 'skip', label: '不拿取' }] : []),
        ...selectable.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))],
    })
    if (answer === 'skip') break
    const chosen = selectable[Number(answer)]
    if (!chosen) break
    const index = inv.deck.lastIndexOf(chosen)
    if (index >= 0) inv.deck.splice(index, 1)
    inv.hand.push(chosen)
    taken.push(chosen)
    info(state, events, `${inv.name} 从牌库找到「${cardName(chosen)}」。`)
  }
  if (options.shuffle) inv.deck = shuffle(inv.deck, () => randomValue(state))
  return taken
}

// ---------------------------------------------------------------------------
// Phase 2（B6）：把一张牌搬到别处
//
// 区域词表与规格校验在 zones.js；这里只做四件事：定位来源、摘出来、
// 放进目标区域（必要时建实例/附属/压牌）、记日志。
// ---------------------------------------------------------------------------

function moveCardTo(state, inv, rawSpec, events) {
  const spec = rawSpec?.to ? rawSpec : normalizeCardMove(rawSpec)
  const seat = inv?.seat ?? null
  const found = findZoneCard(state, inv, spec)
  if (!found) {
    info(state, events, `没有找到要移动的牌（${spec.code || spec.id}）。`)
    return null
  }
  // 先摘出来：共享区域是 state 上的数组，场上卡要触发离场钩子。
  if (found.shared) state[found.shared].splice(found.index, 1)
  else if (found.zone === 'play') leaveAsset(state, found.owner, found.instance, events)
  else if (found.zone === 'threat') removeThreat(state, found.owner, found.instance, events)
  else found.owner[found.zone].splice(found.index, 1)

  const code = spec.code || found.instance?.code
  const owner = state.investigators[spec.ownerSeat ?? seat] || inv
  switch (spec.to) {
    case 'hand': owner.hand.push(code); break
    case 'deckTop': owner.deck.push(code); break
    case 'deckBottom': owner.deck.unshift(code); break
    case 'discard': owner.discard.push(code); break
    case 'play': {
      const asset = newPlayerAssetInstance(state, owner, code, spec.facedown ? { facedown: true } : {})
      owner.assets.push(asset)
      scenarioBehavior(state).assetEntered?.(state, owner, asset, scenarioRuntime(state, events))
      break
    }
    case 'threat': owner.threat.push(newPlayerAssetInstance(state, owner, code, spec.facedown ? { facedown: true } : {})); break
    case 'attached': {
      const host = [...owner.assets, ...owner.threat].find(card => card.id === spec.attachTo)
        || state.enemies.find(enemy => enemy.id === spec.attachTo)
        || state.locations.find(location => location.id === spec.attachTo)
      if (!host) {
        owner.discard.push(code)
        info(state, events, `附属宿主不存在，「${cardName(code)}」进入弃牌堆。`)
        break
      }
      attachCardTo(state, owner.seat, code, host)
      break
    }
    case 'beneath': {
      const host = [...owner.assets, ...owner.threat].find(card => card.id === spec.beneath)
        || state.enemies.find(enemy => enemy.id === spec.beneath)
        || state.locations.find(location => location.id === spec.beneath)
      if (host) {
        host.beneath ||= []
        host.beneath.push(code)
      } else owner.discard.push(code)
      break
    }
    case 'setAside':
      state.setAside ||= []
      state.setAside.push(code)
      break
    case 'removedFromGame':
      state.removedFromGame ||= []
      state.removedFromGame.push(code)
      break
    case 'victoryDisplay':
      state.victoryDisplay ||= []
      state.victoryDisplay.push(code)
      break
    default:
      throw new Error(`未知目标区域 ${spec.to}`)
  }
  info(state, events, `🃏 「${cardName(code)}」${describeCardMove(spec)}。`)
  return code
}

function drawCards(state, inv, n, events) {
  // 第 2 步 P2.6：无牌组故事调查员不能抽牌（也不进入重洗/弃牌逻辑）。
  if (inv?.storyInvestigator) {
    info(state, events, `📜 ${inv.name} 没有牌组，不能抽牌。`)
    return []
  }
  const texts = []
  let reshuffles = 0
  let drawnCount = 0
  for (let i = 0; i < n; i++) {
    if (inv.deck.length === 0) {
      if (inv.discard.length === 0 || discardLocked(state, inv)) continue
      const rng = () => randomValue(state)
      inv.deck = shuffle(inv.discard, rng)
      inv.discard = []
      reshuffles++
    }
    const code = inv.deck.pop()
    drawnCount++
    const def = cardDef(code)
    if (isWeaknessCard(def)) {
      // 2026-10-25 第六轮修复 05014：抽到弱点前的取消窗口（取消后洗回牌库、不重抽）。
      const weaknessDrawContext = { when: 'cardWouldBeDrawn', seat: inv.seat, location: inv.location,
        cardCode: code, weakness: true, from: 'deck', cancelled: false,
        prompt: `${inv.name} 将要抽到弱点「${cardName(code)}」` }
      reactionWindow(state, 'cardWouldBeDrawn', weaknessDrawContext, events)
      if (weaknessDrawContext.cancelled) {
        inv.deck = shuffle([...inv.deck, code], () => randomValue(state))
        info(state, events, `🛡️ ${inv.name} 取消了抽到的弱点「${cardName(code)}」，并将其洗回牌库。`)
        continue
      }
      texts.push(`⚠️ ${inv.name} 抽到了弱点「${cardName(code)}」：${def.textZh || def.text || ''}`)
      // Phase 5（5a-22）：「黑暗回忆」这类抽到后留在手里的弱点由条目级 weaknessStaysInHand 声明。
      if (registeredEntry(def.code)?.weaknessStaysInHand) {
        inv.hand.push(code)
        const note = registeredEntry(def.code)?.weaknessHandNote
        texts.push(note || cardName(code) + '留在手中；可支付费用打出，否则每回合结束受到 2 恐惧。')
      } else {
        resolveWeakness(state, inv, def, events, texts)
        if (inv.shuffleWeaknessAfterResolution === code) {
          delete inv.shuffleWeaknessAfterResolution
          inv.deck = shuffle([...inv.deck, code], () => randomValue(state))
        } else if (def.type !== 'enemy' && !isThreatWeakness(def.code)
          && !['attachedEnemy', 'attachedLocation'].includes(weaknessProfile(code)?.type)) {
          // Attached weaknesses go to the discard pile when they detach.
          inv.discard.push(code)
        }
      }
    } else {
      inv.hand.push(code)
      texts.push(`${inv.name} 抽取了 1 张牌。`)
      scenarioBehavior(state).cardDrawn?.(state, inv, code, scenarioRuntime(state, events))
      // 能力层窗口：抽牌后（02040 亨利·阿米蒂奇博士等）。
      const drawContext = { when: 'cardDrawn', seat: inv.seat, location: inv.location, cardCode: code,
        prompt: `${inv.name} 抽取了「${cardName(code)}」` }
      triggerReaction(state, inv.seat, 'cardDrawn', events, drawContext)
      reactionWindow(state, 'cardDrawn', drawContext, events)
    }
    scenarioBehavior(state).deckEmptied?.(state, inv, scenarioRuntime(state, events))
    if (inv.defeated) break
  }
  for (let i = 0; i < reshuffles; i++) {
    texts.push(`${inv.name} 重新混洗弃牌堆，抽牌结束后受到 1 点恐惧。`)
    applyHorror(state, inv, 1, events)
  }
  // 「古代巨石（研究完成）」：抽牌后可按抽到的张数花费秘密。
  if (drawnCount > 0 && !inv.defeated) campaignCardDrawReaction(state, inv, events, drawnCount)
  return texts
}

// 古代巨石（研究完成）：条目上的 cardDrawSecretAction 声明「抽牌后花秘密」做什么
// （Phase 5（5a-30）：原来按 04230 / 04231 两个卡号分支）。

function discardRandomFromHand(state, inv, n, events) {
  if (!n || !(inv?.hand || []).length) return
  // 2026-10-25：05280「否决存在：忽略弃掉手牌的效果」的按面向取消窗口。
  const context = reactionWindow(state, 'wouldDiscardFromHand', {
    when: 'wouldDiscardFromHand', seat: inv.seat, amount: n, what: 'discard', location: inv.location,
    // 2026-10-25 第六轮修复 05032：窗口来源标记（enemyAttack/encounter/other）。
    source: { kind: state._enemyAttackResolving ? 'enemyAttack' : state._treacheryResolving ? 'encounter' : 'other' },
    prompt: `${inv.name} 将要随机弃 ${n} 张手牌`,
  }, events)
  if (context.cancelled) {
    info(state, events, `🛡️ ${inv.name} 忽略了弃掉手牌的效果。`)
    return
  }
  for (let i = 0; i < n; i++) {
    const candidates = inv.hand.map((code, index) => ({ code, index }))
      .filter(item => canDiscardFromHand(inv, item.code))
    if (!candidates.length) break
    const chosen = candidates[Math.floor(randomValue(state) * candidates.length)]
    const code = inv.hand.splice(chosen.index, 1)[0]
    inv.discard.push(code)
    info(state, events, `${inv.name} 弃掉了「${cardName(code)}」。`)
  }
}

function removeOne(arr, code) {
  const i = arr.indexOf(code)
  if (i >= 0) arr.splice(i, 1)
}

function removeCardByCode(arr, code) {
  const i = arr.indexOf(code)
  if (i >= 0) arr.splice(i, 1)
  return i >= 0
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------

  return { lookZoneAdapter, lookAt, scryDeck, searchDeck, moveCardTo, drawCards, discardRandomFromHand, removeOne, removeCardByCode }
}
