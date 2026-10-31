// card-ops.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 卡与目标的具体操作：补充使用次数、装弹、按特性检索、选择调查员/敌人/猎物。
// 读点：搜索类效果（api.searchDeck / lookAt）与敌人目标解析。
export function createCardOps(deps) {
  const {
    abilityTargets,
    afterEvade,
    aliveInvestigators,
    assetEffect,
    autoEvadeEnemy,
    cardDef,
    cardName,
    describePrey,
    discardLocked,
    disposePlayedEvent,
    drawCards,
    effectError,
    enemyTextBlanked,
    getMaxSanity,
    getStat,
    info,
    registeredEntry,
    invClues,
    isWeaknessCode,
    leadDecisionSeat,
    randomValue,
    remainingHealth,
    removeOne,
    requestChoice,
    scenarioBehavior,
    searchDeck,
    shuffle,
  } = deps

  const PREY_RANK = {
    highestIntellect: (state, inv) => -getStat(state, inv, 'intellect'),
    lowestIntellect: (state, inv) => getStat(state, inv, 'intellect'),
    lowestWillpower: (state, inv) => getStat(state, inv, 'willpower'),
    highestCombat: (state, inv) => -getStat(state, inv, 'combat'),
    lowestHealth: (state, inv) => remainingHealth(inv),
    mostClues: (state, inv) => -invClues(inv),
    mostHorror: (state, inv) => -inv.horror,
    lowestSanity: (state, inv) => getMaxSanity(inv) - inv.horror,
    // 「猎物 - 剩余神智值最高」：数值越小越优先，所以取负。
    mostRemainingSanity: (state, inv) => -(getMaxSanity(inv) - (inv.horror || 0)),
    lowestAgility: (state, inv) => getStat(state, inv, 'agility'),
    lowestCombat: (state, inv) => getStat(state, inv, 'combat'),
    // P8（食梦者共享组）：「猎物 - 伤害最多」「猎物 - 手牌最多」。
    mostDamage: (state, inv) => -(inv.damage || 0),
    mostCardsInHand: (state, inv) => -((inv.hand || []).length),
    // 「猎物 - 距离昆扬之口最近」：按地点连接数计算最短距离。
    nearestMouth: (state, inv) => {
      const mouth = (state.locations || []).find(location =>
        registeredEntry(location.originalCode || location.code)?.flags?.mouthOfKnyan
        || registeredEntry(location.linkedOriginalCode)?.flags?.mouthOfKnyan)
      if (!mouth || mouth.id === inv.location) return 0
      const distance = (from, to) => {
        if (from === to) return 0
        const queue = [[from, 0]]
        const seen = new Set([from])
        while (queue.length) {
          const [id, steps] = queue.shift()
          const location = state.locations.find(entry => entry.id === id)
          for (const next of location?.connections || []) {
            if (next === to) return steps + 1
            if (seen.has(next)) continue
            seen.add(next)
            queue.push([next, steps + 1])
          }
        }
        return 999
      }
      return distance(inv.location, mouth.id)
    },
    fewestHand: (state, inv) => inv.hand.length,
    // 「猎物 - 手牌最多」：数值越小越优先，所以取负。
    mostHand: (state, inv) => -inv.hand.length,
  }

  function chooseAmong(state, { kind, source, seat, prompt, options }) {
    if (!options.length) return null
    if (options.length === 1) return options[0].id
    return requestChoice(state, { kind, source, seat, prompt, options })
  }

  function preyTarget(state, enemy, candidates) {
    if (!candidates.length) return null
    // 内容层写入的具体猎物（例如 04098「猎物 - 中毒的调查员」由失落时代 encounter-rules 写入
    // enemy.preySeat）：若仍合法则直接作为猎物，不再进入 generic prey 选择。
    if (!enemyTextBlanked(state, enemy) && Number.isInteger(enemy.preySeat)
      && candidates.includes(enemy.preySeat)) {
      const prey = state.investigators[enemy.preySeat]
      if (prey && !prey.defeated && !prey.resigned) return enemy.preySeat
    }
    if (enemy.prey === 'bearer' && !enemyTextBlanked(state, enemy)) {
      const bearer = enemy.bearerSeat
      const inv = bearer != null ? state.investigators[bearer] : null
      if (inv && inv.location === enemy.location && !inv.defeated && !inv.resigned) return inv.seat
      return null
    }
    const rank = !enemyTextBlanked(state, enemy) && PREY_RANK[enemy.prey]
    let pool = candidates
    // 2026-10-25 本循环修复 05221：剧本级猎物排序钩子（如「猎物 - 控制最多钥匙的调查员」）。
    // 返回非空候选池时优先于通用 PREY_RANK；并列仍走 chooseAmong 由队长选择。
    const scenarioPool = !enemyTextBlanked(state, enemy)
      ? scenarioBehavior(state).preyRank?.(state, enemy, candidates)
      : null
    if (Array.isArray(scenarioPool) && scenarioPool.length) {
      pool = candidates.filter(seat => scenarioPool.includes(seat))
    } else if (rank) {
      const scores = candidates.map(seat => rank(state, state.investigators[seat]))
      const best = Math.min(...scores)
      pool = candidates.filter((_, index) => scores[index] === best)
    }
    const answer = chooseAmong(state, {
      kind: 'prey', source: { type: 'enemy', id: enemy.id, code: enemy.code }, seat: leadDecisionSeat(state),
      prompt: `选择「${enemy.name}」的猎物（${describePrey(enemy.prey) || '任意调查员'}并列）。`,
      options: pool.map(seat => ({ id: String(seat), label: state.investigators[seat].name })),
    })
    return answer == null ? null : Number(answer)
  }

  function preySeatForTest(state, enemy, candidates) {
    return preyTarget(state, enemy, candidates)
  }

  function searchDiscard(state, seat, effect, events) {
    const inv = state.investigators[seat]
    if (discardLocked(state, inv)) {
      info(state, events, `${inv.name} 的弃牌堆被锁定，卡牌不能离开。`)
      return
    }
    const matches = inv.discard.filter((code, index) => {
      const def = cardDef(code)
      if (!def) return false
      if (effect.typeFilter && def.type !== effect.typeFilter) return false
      if (effect.trait) {
        const needle = String(effect.trait).toLowerCase()
        return (def.traits || []).some(trait => String(trait).toLowerCase() === needle
          || String(trait) === String(effect.traitZh || ''))
      }
      return true
    }).map(code => ({ code, index: inv.discard.indexOf(code) }))
    if (!matches.length) { info(state, events, `${inv.name} 的弃牌堆中没有符合条件的卡牌。`); return }
    const answer = matches.length === 1 ? '0' : requestChoice(state, {
      kind: 'search', source: effect.source || 'discard-search', seat, canSkip: true,
      prompt: `从弃牌堆选择 1 张牌加入手牌。`,
      options: [{ id: 'skip', label: '不选择' }, ...matches.map((item, index) => ({ id: String(index), cardCode: item.code, label: cardName(item.code) }))],
    })
    if (answer === 'skip') return
    const chosen = matches[Number(answer)]
    const idx = inv.discard.indexOf(chosen.code)
    if (idx >= 0) inv.discard.splice(idx, 1)
    inv.hand.push(chosen.code)
    info(state, events, `${inv.name} 从弃牌堆取回「${cardName(chosen.code)}」。`)
  }

  function autoEvadeNonElite(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
    if (!candidates.length) { info(state, events, '这里没有非精英敌人。'); return }
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'target', source: effect.source || 'auto-evade', seat, prompt: '选择要自动躲避的非精英敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find(item => item.id === id)
    autoEvadeEnemy(state, enemy, events)
    afterEvade(state, inv, enemy, events)
  }

  function attachBarricade(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc) return
    // Phase 5（5a-18）：附属卡号随效果数据走（effect.code）。
    const attachment = { ownerSeat: seat, code: effect.code || null }
    loc.barricades ||= loc.barricade ? [loc.barricade] : []
    loc.barricades.push(attachment)
    loc.barricade = attachment
    info(state, events, `🚧 「屏障」附属到「${loc.name}」：非精英敌人不能移动进入。`)
  }

  function discardBarricades(state, loc) {
    for (const attachment of loc.barricades || (loc.barricade ? [loc.barricade] : [])) {
      if (attachment.code) disposePlayedEvent(state.investigators[attachment.ownerSeat], attachment.code)
    }
    delete loc.barricade
    delete loc.barricades
  }

  function findZoneCard(state, inv, spec) {
    const isInstance = card => (spec.id ? card.id === spec.id : card.code === spec.code)
    const owners = spec.ownerSeat != null ? [state.investigators[spec.ownerSeat]] : state.investigators
    // 声明了 from 就只在那个区域找：否则「从弃牌堆拿回」会先命中牌库里的同名卡。
    const wanted = spec.from && spec.from !== 'auto' ? spec.from : null
    const wants = zone => !wanted || wanted === zone || (wanted === 'attached' && false)
    for (const owner of owners) {
      if (!owner) continue
      for (const zone of ['play', 'threat']) {
        if (!wants(zone)) continue
        const array = zone === 'play' ? owner.assets : owner.threat
        const found = array.find(isInstance)
        if (found) return { zone, owner, instance: found }
      }
      if (!spec.code) continue
      for (const zone of ['hand', 'deck', 'discard']) {
        if (!wants(zone)) continue
        const array = owner[zone]
        const index = array.lastIndexOf(spec.code)
        if (index >= 0) return { zone, owner, index }
      }
    }
    for (const zone of ['setAside', 'removedFromGame', 'victoryDisplay', 'encounterDeck', 'encounterDiscard']) {
      if (!wants(zone)) continue
      const array = state[zone]
      if (!Array.isArray(array) || !spec.code) continue
      const index = array.lastIndexOf(spec.code)
      if (index >= 0) return { zone, owner: inv, index, shared: zone }
    }
    return null
  }

  function chooseInvestigator(state, seat, target = 'location', effect = null, constraints = {}) {
    const inv = state.investigators[seat]
    let candidates = aliveInvestigators(state)
    if (target === 'self') candidates = [inv]
    else if (target === 'location') candidates = candidates.filter(item => item.location === inv.location)
    if (constraints.activeTurnOnly) candidates = candidates.filter(item => state.phase === 'investigation' && item.seat === state.currentSeat && !item.turnEnded)
    if (effect) candidates = candidates.filter(item => !effectError(state, item, effect))
    if (!candidates.length) throw new Error('没有合法调查员目标')
    if (candidates.length === 1) return candidates[0].seat
    const id = requestChoice(state, {
      kind: 'investigator', source: 'target', seat, prompt: '选择一名调查员。',
      options: candidates.map(item => ({ id: String(item.seat), label: `${item.name}（座位 ${item.seat + 1}）` })),
    })
    return Number(id)
  }

  function searchTop(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const n = Math.max(1, effect.amount || 3)
    const cards = inv.deck.slice(-Math.min(n, inv.deck.length))
    if (!cards.length) { info(state, events, `${inv.name} 的牌库已空，无法搜索。`); return }
    const matches = cards.filter(code => {
      const def = cardDef(code)
      if (!def) return false
      if (effect.typeFilter && def.type !== effect.typeFilter) return false
      const wantedTraits = effect.traits || (effect.trait ? [effect.trait] : [])
      if (wantedTraits.length) {
        const wantedZh = effect.traitZh ? [String(effect.traitZh)] : []
        const wanted = wantedTraits.map(item => String(item).toLowerCase())
        if (!(def.traits || []).some(trait => wanted.includes(String(trait).toLowerCase()) || wantedZh.includes(String(trait)))) return false
      }
      return true
    })
    if (!matches.length) {
      inv.deck = shuffle(inv.deck, () => randomValue(state))
      info(state, events, `${inv.name} 查看了牌库顶 ${cards.length} 张，没有符合条件的卡牌，洗回牌库。`)
      return
    }
    const optional = effect.optional === true
    const answer = requestChoice(state, {
      kind: 'search', source: effect.source || 'search-top', seat, canSkip: optional,
      prompt: `查看牌库顶 ${cards.length} 张，选择 ${effect.choose || 1} 张抽取，其余洗回。`,
      options: [...(optional ? [{ id: 'skip', label: '不选择' }] : []),
        ...matches.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))],
    })
    if (answer !== 'skip') {
      const code = matches[Number(answer)]
      const idx = inv.deck.lastIndexOf(code)
      // 把选中的牌放到牌库顶，再走统一抽牌管线：弱点、抽牌窗口与日志都按「抽取」结算。
      if (idx >= 0) inv.deck.splice(idx, 1)
      inv.deck.push(code)
      for (const text of drawCards(state, inv, 1, events)) info(state, events, text)
    }
    inv.deck = shuffle(inv.deck, () => randomValue(state))
  }

  function refillAsset(state, inv, amount, events, { usesType, kind, emptyText, verb, icon, trait = null }) {
    const candidates = inv.assets.filter((asset) => {
      const eff = assetEffect(inv, asset)
      if (!eff || eff.uses == null) return false
      if (usesType && (eff.usesType || 'charges') !== usesType) return false
      if (trait && !(cardDef(asset.code)?.traits || []).some(item => String(item).toLowerCase() === String(trait).toLowerCase())) return false
      return true
    })
    if (!candidates.length) {
      info(state, events, emptyText)
      return
    }
    const id = chooseAmong(state, {
      kind, source: 'refill-asset', seat: inv.seat, prompt: `选择要${verb}的资产。`,
      options: candidates.map((asset) => ({ id: asset.id, label: cardName(asset.code) })),
    })
    const asset = candidates.find((item) => item.id === id)
    const eff = assetEffect(inv, asset)
    asset.uses = (asset.uses || 0) + amount
    info(state, events, `${icon} 「${cardName(asset.code)}」${verb} ${amount}（当前 ${asset.uses}/${eff.uses}）。`)
  }

  function reloadAmmo(state, inv, amount, events, opts = {}) {
    const roots = aliveInvestigators(state).filter(item => item.location === inv.location)
    const candidates = []
    for (const owner of roots) {
      for (const asset of owner.assets) {
        const eff = assetEffect(owner, asset)
        if (!eff || eff.uses == null) continue
        if ((eff.usesType || 'charges') !== 'ammo') continue
        if (opts.trait && !(cardDef(asset.code)?.traits || []).some(item => String(item).toLowerCase() === String(opts.trait).toLowerCase())) continue
        candidates.push({ owner, asset, max: eff.uses })
      }
    }
    if (!candidates.length) { info(state, events, `${inv.name} 所在地点没有可装填的弹药武器。`); return }
    const chosen = candidates.length === 1 ? candidates[0] : (() => {
      const id = requestChoice(state, { kind: 'reload', source: 'reload', seat: inv.seat,
        prompt: '选择要装填的资产。',
        options: candidates.map(item => ({ id: item.asset.id, label: `${cardName(item.asset.code)}（${item.owner.name}）` })) })
      return candidates.find(item => item.asset.id === id)
    })()
    chosen.asset.uses = (chosen.asset.uses || 0) + amount
    info(state, events, `🔫 「${cardName(chosen.asset.code)}」装填 ${amount}（当前 ${chosen.asset.uses}/${chosen.max}）。`)
  }

  function defeatNonEliteEnemyAt(state, seat, target, events) {
    const inv = state.investigators[seat]
    if (typeof target === 'string' && target.startsWith('id:')) {
      const chosen = state.enemies.find(enemy => enemy.id === target.slice(3) && !enemy.elite)
      if (!chosen) { info(state, events, '没有可放逐的非精英敌人。'); return }
      info(state, events, `「${chosen.name}」（非精英）被放逐。`)
      removeOne(state.enemies, chosen)
      if (chosen.engagedSeat != null) {
        const eng = state.investigators[chosen.engagedSeat]
        if (eng) removeOne(eng.engaged, chosen.id)
      }
      if (isWeaknessCode(chosen.code)) state.investigators[chosen.bearerSeat ?? seat].discard.push(chosen.code)
      else state.encounterDiscard.push(chosen.code)
      return
    }
    const candidates = state.enemies.filter((e) => e.location === inv.location && !e.elite)
    if (!candidates.length) {
      info(state, events, '这里没有非精英敌人。')
      return
    }
    const id = chooseAmong(state, {
      kind: 'target', source: 'defeat-non-elite', seat, prompt: '选择要放逐的非精英敌人。',
      options: candidates.map((enemy) => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find((item) => item.id === id)
    info(state, events, `「${enemy.name}」（非精英）被放逐。`)
    removeOne(state.enemies, enemy)
    if (enemy.engagedSeat != null) {
      const eng = state.investigators[enemy.engagedSeat]
      if (eng) removeOne(eng.engaged, enemy.id)
    }
    if (isWeaknessCode(enemy.code)) state.investigators[enemy.bearerSeat ?? seat].discard.push(enemy.code)
    else state.encounterDiscard.push(enemy.code)
  }

  function rechargeAsset(state, inv, amount, events, opts = {}) {
    refillAsset(state, inv, amount, events, {
      kind: 'recharge', verb: '充能', icon: '🔮',
      trait: opts.trait || null,
      emptyText: `${inv.name} 没有可充能的法术资产。`,
    })
  }

  function chooseEnemy(state, seat, effect) {
    const enemies = abilityTargets(state, state.investigators[seat], effect)
    if (!enemies.length) throw new Error('没有合法敌人目标')
    const id = requestChoice(state, { kind: 'target', source: effect.type, seat, prompt: '选择敌人目标。',
      options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
    return enemies.find(enemy => enemy.id === id)
  }

  function enemyForTarget(state, seat, target) {
    if (target?.startsWith('id:')) return state.enemies.find(enemy => enemy.id === target.slice(3)) || null
    // 调用方（effects.js 的 dealDamage / evade）把"没有目标"当成正常分支处理，
    // 因此这里必须返回 null 而不是抛错：随机走子器在"手上有需要敌人的事件卡、场上却没有合法敌人"
    // 时走到过这条路径（Phase 4 · 重放安全网）。
    const enemies = abilityTargets(state, state.investigators[seat], { type: 'dealDamage', target })
    if (!enemies.length) return null
    const id = requestChoice(state, { kind: 'target', source: 'dealDamage', seat, prompt: '选择敌人目标。',
      options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
    return enemies.find(enemy => enemy.id === id) || enemies[0]
  }

  function searchCards(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const cards = inv.deck.slice(-Math.min(effect.amount || 3, inv.deck.length))
    const answer = requestChoice(state, { kind: 'search', source: 'deck-search', seat,
      prompt: '查看搜索到的牌并选择一张加入手牌，其余洗回。', canSkip: true,
      options: [{ id: 'skip', label: '不选择卡牌' }, ...cards.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))] })
    if (answer !== 'skip') {
      const index = inv.deck.length - cards.length + Number(answer)
      inv.hand.push(inv.deck.splice(index, 1)[0])
      info(state, events, `${inv.name} 搜索后将 1 张牌加入手牌。`)
    }
    inv.deck = shuffle(inv.deck, () => randomValue(state))
  }

  return { PREY_RANK, chooseAmong, preyTarget, preySeatForTest, searchDiscard, autoEvadeNonElite, attachBarricade, discardBarricades, findZoneCard, chooseInvestigator, searchTop, refillAsset, reloadAmmo, defeatNonEliteEnemyAt, rechargeAsset, chooseEnemy, enemyForTarget, searchCards }
}
