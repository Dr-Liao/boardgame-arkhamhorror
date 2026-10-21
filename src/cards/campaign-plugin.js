// campaign-plugin.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 战役机制插件（Phase 6 · 6e 战役插件化第一批）：原 engine.js 的战役规则与玩家卡调度。
// 位置：内容层（src/cards/），因为 tests/phase6-guard.test.mjs 要求 src/engine 内不出现战役名。
// 分组：A 战役规则原语（补给 / 复仇 / 中毒 / 伊格之怒 / 领队 / 古代遗物 / 探索牌库）；
// B 数据体表达不了的玩家卡效果调度（按 effect.type / action 分派）。
// 依赖注入同前几批；读点仍是引擎里的薄包装（engine.js 只留同名 export 转发）。
export function createCampaignPlugin(deps) {
  const {
    CLASS_NAMES,
    EFFECTS,
    RELIC_OF_AGES_CODE,
    aliveInvestigators,
    assetReplacementPlans,
    cardDef,
    cardName,
    cardPlayFlag,
    chooseLolaRole,
    damageEnemy,
    discardLocked,
    doInvestigate,
    doPlay,
    drawEncounter,
    expeditionLeaderSeat,
    failedTestResolves,
    info,
    isPoisonThreat,
    isWeaknessCard,
    leaveAsset,
    locName,
    newCardInstance,
    normalizedSlots,
    payActionCost,
    placeLocation,
    playCost,
    poisonThreatCode,
    randomValue,
    reactionWindow,
    registeredEntry,
    relocateInvestigator,
    requestChoice,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    tokenLabel,
    triggerReaction,
    unique,
  } = deps

  function ensureSupplies(state, seat) {
    state.campaign.supplies ||= {}
    state.campaign.supplies[seat] ||= []
    return state.campaign.supplies[seat]
  }

  function suppliesFor(state, seat) {
    return [...ensureSupplies(state, seat)]
  }

  function hasSupply(state, seat, name) {
    return ensureSupplies(state, seat).includes(name)
  }

  function grantSupplies(state, seat, names, events) {
    const list = ensureSupplies(state, seat)
    const added = []
    for (const name of [names].flat()) {
      if (!name || list.includes(name)) continue
      list.push(name)
      added.push(name)
    }
    if (added.length) {
      info(state, events, `🎒 ${state.investigators[seat]?.name || seat} 得到补给：${added.join('、')}。`)
    }
    return added
  }

  function crossOffSupply(state, seat, name, events) {
    const list = ensureSupplies(state, seat)
    const index = list.indexOf(name)
    if (index < 0) return false
    list.splice(index, 1)
    info(state, events, `✂️ ${state.investigators[seat]?.name || seat} 划掉了补给「${name}」。`)
    return true
  }

  function checkSupplies(state, inv, name) {
    return aliveInvestigators(state).filter(owner => owner.location === inv.location)
      .some(owner => hasSupply(state, owner.seat, name))
  }

  function suppliesAtLocation(state, location) {
    return aliveInvestigators(state).filter(inv => inv.location === location)
      .map(inv => ({ seat: inv.seat, name: inv.name, supplies: suppliesFor(state, inv.seat) }))
  }

  function vengeancePoints(state) {
    return (state.victoryDisplay || []).reduce((sum, card) => sum + (card.vengeance || 0), 0)
  }

  function recordVengeance(state, amount, card = null) {
    // 非正数不新增记录，直接返回当前累计，便于剧本按「差值」调用。
    if (!(amount > 0)) return vengeancePoints(state)
    state.victoryDisplay ||= []
    state.victoryDisplay.push({ id: `vengeance-${state.instanceSeq?.c || 0}-${state.victoryDisplay.length}`,
      code: card?.code || 'vengeance', originalCode: card?.code || 'vengeance', victory: 0, vengeance: amount, virtual: true })
    return vengeancePoints(state)
  }

  function isPoisoned(inv) {
    // Phase 5（5a-4）：中毒威胁按内容层数据标记判断。
    return (inv?.threat || []).some(card => isPoisonThreat(card.code)) || inv?.poisoned === true
  }

  function poisonInvestigator(state, seat, events) {
    const inv = state.investigators[seat]
    if (!inv || inv.defeated || inv.resigned) return false
    if (isPoisoned(inv)) return false
    // Phase 5（5a-4）：威胁卡卡号只在内容层出现。
    const poisonCode = poisonThreatCode()
    inv.threat.push(newCardInstance(state, poisonCode, { permanent: true }))
    info(state, events, `🧪 ${inv.name} 中毒了（「${cardName(poisonCode)}」进入威胁区域）。`)
    return true
  }

  function yigsFury(state) {
    return Number(state.campaign.records?.yigsFury || 0)
  }

  function addYigsFury(state, amount, events) {
    state.campaign.records ||= {}
    const next = Math.max(0, yigsFury(state) + Number(amount || 0))
    state.campaign.records.yigsFury = next
    if (events) info(state, events, `🐍 伊格之怒变为 ${next}。`)
    return next
  }

  function setExpeditionLeader(state, seat, events) {
    if (!Number.isInteger(seat) || !state.investigators?.[seat]) return null
    state.expeditionLeaderSeat = seat
    state.campaign.expeditionLeader = seat
    info(state, events, `${state.investigators[seat].name} 成为远征求领队。`)
    return seat
  }

  function moveRelicOfAges(state, { code = null, location = null, seat = null } = {}, events) {
    const previous = state.relicOfAges
    state.relicOfAges = {
      code: code || previous?.code || RELIC_OF_AGES_CODE,
      location: seat != null ? state.investigators[seat]?.location ?? null : location,
      seat: seat ?? null,
    }
    if (events) {
      const holder = seat != null ? state.investigators[seat]?.name : null
      info(state, events, `🏺 古代遗物位于${holder ? `${holder} 身上` : locName(state, state.relicOfAges.location) || '一边'}。`)
    }
    return state.relicOfAges
  }

  function relicOfAges(state) {
    return state.relicOfAges || null
  }

  function relicOfAgesLocation(state) {
    const relic = relicOfAges(state)
    if (!relic) return null
    if (relic.seat != null) return state.investigators[relic.seat]?.location ?? null
    return relic.location ?? null
  }

  function buildExplorationDeck(state, codes, events) {
    state.explorationDeck = shuffle([...new Set(codes)], () => randomValue(state))
    state.explorationDiscard = []
    if (events) info(state, events, `🧭 探索牌库已建立（${state.explorationDeck.length} 张）。`)
    return state.explorationDeck.length
  }

  function addToExplorationDeck(state, codes, { top = false } = {}) {
    state.explorationDeck ||= []
    if (top) state.explorationDeck.push(...codes)
    else state.explorationDeck = shuffle([...state.explorationDeck, ...codes], () => randomValue(state))
    return state.explorationDeck.length
  }

  function doExplore(state, seat, events) {
    const inv = state.investigators[seat]
    if (!inv || inv.defeated || inv.resigned) return
    if (!state.explorationDeck?.length) {
      info(state, events, '🧭 探索牌库已经空了。')
      return
    }
    payActionCost(state, inv, 'explore', events)
    // 剧本可以在探索开始前拦截（如「索桥」要求先检定，失败则取消本次探索）。
    const blocked = scenarioBehavior(state).beforeExplore?.(state, inv, scenarioRuntime(state, events))
    if (blocked === false) return
    if (!state.explorationDeck?.length) {
      info(state, events, '🧭 探索牌库已经空了。')
      return
    }
    const code = state.explorationDeck.pop()
    const scenarioLocation = state.scenario?.locations?.[code]
    // 剧本可以要求「只有连接地点才能放置入场」（04285 前往联结点）。
    // 不相连时把牌放回探索牌库底部，本次探索不放置、不移动。
    if (scenarioLocation
      && scenarioBehavior(state).exploreConnects?.(state, inv.location, code) === false) {
      state.explorationDeck.unshift(code)
      info(state, events, `🧭 ${inv.name} 探索到「${scenarioLocation.nameZh || scenarioLocation.name || code}」，`
        + '但它不与当前地点相连，放回探索牌库底部。')
      scenarioBehavior(state).afterExplore?.(state, inv,
        { code, kind: 'blocked', runtime: scenarioRuntime(state, events) })
      return
    }
    const def = scenarioLocation || cardDef(code)
    info(state, events, `🧭 ${inv.name} 探索并翻开「${def?.nameZh || def?.name || code}」。`, {
      kind: 'automatic', phase: state.phase, round: state.round,
      text: `${inv.name} 探索「${def?.nameZh || def?.name || code}」`, code, effect: 'explore',
      seat, location: inv.location,
    })
    if (scenarioLocation) {
      placeLocation(state, code, events, seat)
      const placed = state.locations.find(location => location.id === code)
      const here = state.locations.find(location => location.id === inv.location)
      if (placed && here) {
        placed.connections = [...new Set([...(placed.connections || []), here.id])]
        here.connections = [...new Set([...(here.connections || []), placed.id])]
      }
      if (placed) relocateInvestigator(state, seat, code, events)
    } else {
      // 敌人与诡计走与「遭遇」相同的结算路径。
      state.encounterDeck.push(code)
      drawEncounter(state, inv, events)
    }
    scenarioBehavior(state).afterExplore?.(state, inv,
      { code, kind: scenarioLocation ? 'location' : 'encounter', runtime: scenarioRuntime(state, events) })
  }

  function tfaCardDrawReaction(state, inv, events, count) {
    for (const stone of inv.assets) {
      const mode = registeredEntry(stone.code)?.cardDrawSecretAction
      if (!mode || (stone.uses || 0) < count) continue
      const code = stone.code
      if (mode === 'damageEnemy' && !state.enemies.some(enemy => enemy.location === inv.location)) continue
      if (mode === 'healHorror') {
        const healable = aliveInvestigators(state).some(other => other.location === inv.location
          && (other.horror > 0 || other.assets.some(asset => (asset.horror || 0) > 0)))
        if (!healable) continue
      }
      const answer = requestChoice(state, { kind: 'reaction', source: stone.id, seat: inv.seat, canSkip: true,
        prompt: `抽取了 ${count} 张牌，是否花费 ${count} 秘密使用「${cardName(code)}」？`,
        options: [{ id: 'skip', label: '不花费秘密' }, { id: 'trigger', label: `花费 ${count} 秘密` }] })
      if (answer !== 'trigger') continue
      stone.uses -= count
      if (mode === 'damageEnemy') {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        const chosen = targets.length === 1 ? targets[0].id : requestChoice(state, { kind: 'target', source: code, seat: inv.seat,
          prompt: '选择要造成伤害的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        damageEnemy(state, enemy, count, inv.seat, events)
        info(state, events, `「${cardName(code)}」对「${enemy.name}」造成 ${count} 点伤害。`)
      } else {
        const options = aliveInvestigators(state).filter(other => other.location === inv.location)
          .flatMap(other => [{ id: `inv:${other.seat}`, label: `${other.name}（恐惧 ${other.horror}）` },
            ...other.assets.filter(asset => (asset.horror || 0) > 0)
              .map(asset => ({ id: `asset:${asset.id}`, label: `${cardName(asset.code)}（恐惧 ${asset.horror}）` }))])
        if (!options.length) continue
        const chosen = options.length === 1 ? options[0].id : requestChoice(state, { kind: 'target', source: code, seat: inv.seat,
          prompt: `选择治愈 ${count} 点恐惧的目标。`, options })
        if (chosen.startsWith('inv:')) {
          const target = state.investigators[Number(chosen.slice(4))]
          const healed = Math.min(target.horror, count)
          target.horror -= healed
          info(state, events, `「${cardName(code)}」治愈 ${target.name} ${healed} 点恐惧。`)
        } else {
          const id = chosen.slice(6)
          const owner = aliveInvestigators(state).find(other => other.assets.some(asset => asset.id === id))
          const asset = owner?.assets.find(item => item.id === id)
          if (asset) {
            const healed = Math.min(asset.horror || 0, count)
            asset.horror = (asset.horror || 0) - healed
            info(state, events, `「${cardName(code)}」治愈「${cardName(asset.code)}」${healed} 点恐惧。`)
          }
        }
      }
    }
  }

  function tfaFailedTestWindow(state, seat, context, events) {
    const { resolve, ...serializable } = context
    state.lastFailedTest = { seat, ...serializable, round: state.round }
    if (typeof resolve === 'function') failedTestResolves.set(state, resolve)
    reactionWindow(state, 'skillTestFailed', { when: 'skillTestFailed', seat,
      location: state.investigators[seat]?.location, skill: context.skill, difficulty: context.difficulty,
      peril: context.peril, prompt: '技能检定失败并结算完毕' }, events)
  }

  function carcosaPlayerEffect(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const asset = effect.assetId && inv.assets.find(item => item.id === effect.assetId)
    throw new Error(`未实现的卡尔克萨玩家卡效果：${effect.action}`)
  }

  function carcosaInvestigatorEffect(state, seat, effect, events) {
    const inv = state.investigators[seat]
    if (effect.action === 'yorickPlayAsset') {
      if (discardLocked(state, inv)) return
      const candidates = inv.discard.filter(code => {
        const def = cardDef(code)
        if (!def || def.type !== 'asset' || isWeaknessCard(def) || inv.resources < playCost(state, inv, def)) return false
        if (def.unique && state.investigators.some(owner => owner.assets.some(asset => cardDef(asset.code)?.name === def.name))) return false
        return assetReplacementPlans(inv, def).length > 0
      })
      if (!candidates.length) return
      const choice = requestChoice(state, { kind: 'discard', source: 'yorickAsset', seat, canSkip: true,
        prompt: '选择弃牌堆中的一个支援，支付费用并打出。', options: [{ id: 'skip', label: '不打出支援' },
          ...candidates.map((code, index) => ({ id: String(index), cardCode: code, label: `${cardName(code)}（${playCost(state, inv, cardDef(code))}资源）` }))] })
      if (choice === 'skip') return
      const code = candidates[Number(choice)]
      inv.discard.splice(inv.discard.indexOf(code), 1)
      inv.hand.push(code)
      doPlay(state, seat, code, events, false, true)
      return
    }
    if (effect.action === 'yorickElderSign') {
      if (discardLocked(state, inv) || !inv.discard.length) return
      const choice = requestChoice(state, { kind: 'discard', source: 'yorickElderSign', seat, canSkip: true,
        prompt: '旧印成功：可以将弃牌堆中的一张牌返回手牌。', options: [{ id: 'skip', label: '不返回' },
          ...inv.discard.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))] })
      if (choice !== 'skip') inv.hand.push(...inv.discard.splice(Number(choice), 1))
      return
    }
    if (effect.action === 'lolaSwitchRole') {
      const role = chooseLolaRole(state, inv, effect.action, '选择罗拉要切换到的角色。')
      info(state, events, `${inv.name} 切换为${CLASS_NAMES[role] || role}角色。`)
      return
    }
    if (effect.action === 'sefinaDrawBeneath' || effect.action === 'sefinaElderSign') {
      if (!inv.beneath?.length) return
      const choice = requestChoice(state, { kind: 'beneath', source: effect.action === 'sefinaElderSign' ? 'sefinaElderSign' : 'sefinaBeneath',
        seat, canSkip: effect.action === 'sefinaElderSign',
        prompt: '选择赛菲娜下方的一张事件加入手牌。',
        options: [...(effect.action === 'sefinaElderSign' ? [{ id: 'skip', label: '不抽取下方事件' }] : []),
          ...inv.beneath.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))] })
      if (choice === 'skip') return
      inv.hand.push(...inv.beneath.splice(Number(choice), 1))
      return
    }
    throw new Error(`未实现的卡尔克萨调查员效果：${effect.action}`)
  }

  function tfaInvestigatorEffect(state, seat, effect, events) {
    const inv = state.investigators[seat]
    // 里奥·安德森：回合开始后打出 1 张盟友支援，费用减 1。
    if (effect.action === 'playAllyDiscounted') {
      const costOf = code => Math.max(0, playCost(state, inv, cardDef(code)) - (effect.amount || 0))
      const candidates = inv.hand
        .filter(code => cardDef(code)?.type === 'asset'
          && (cardDef(code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally'))
        .filter(code => inv.resources >= costOf(code))
        .filter(code => cardDef(code)?.unique
          ? !state.investigators.some(other => other.assets.some(asset => cardDef(asset.code)?.name === cardDef(code)?.name))
          : true)
      if (!candidates.length) return
      const chosen = requestChoice(state, { kind: 'target', source: effect.code, seat,
        prompt: '选择要打出并减免 1 费用的盟友支援。',
        options: [{ id: 'skip', label: '跳过' },
          ...candidates.map(code => ({ id: code, cardCode: code, label: `${cardName(code)}（${costOf(code)} 资源）` }))] })
      if (chosen === 'skip') return
      inv.playDiscount = effect.amount || 1
      doPlay(state, seat, chosen, events)
      delete inv.playDiscount
      return
    }
    // 厄休拉·唐斯：移动后进行 1 次调查行动（不额外消耗行动点）。
    if (effect.action === 'investigateAction') {
      doInvestigate(state, seat, {}, events, true)
      return
    }
    // 芬恩·爱德华兹：手枪攻击，未交战时额外 +1 伤害。
    throw new Error(`未实现的失落调查员效果：${effect.action}`)
  }

  function tfaBeforeChaosReveal(state, seat, inv, events) {
    const test = state.skillTest
    if (!test) return null
    // Phase 5（5c-24）：判据改成「封印标记 + 条目声明 substituteSealedToken」，引擎不再认卡号。
    const premonition = inv.assets.find(asset => asset.sealedToken
      && registeredEntry(asset.code)?.substituteSealedToken)
    if (premonition) {
      const token = premonition.sealedToken
      leaveAsset(state, inv, premonition, events)
      if (!premonition.removedFromGame) inv.discard.push(premonition.code)
      state.chaos.sealed = (state.chaos.sealed || []).filter(entry => entry.source !== premonition.id)
      state.sealedTokens = (state.chaos.sealed || []).map(entry => entry.token)
      state.chaosBag.push(token)
      info(state, events, `「${cardName(premonition.code)}」改为结算封印的 ${tokenLabel(token)}，随后被弃掉。`)
      return { token }
    }
    triggerReaction(state, seat, 'tokenReveal', events, { when: 'tokenReveal', seat, location: inv.location, skill: test.skill })
    reactionWindow(state, 'tokenReveal', { when: 'tokenReveal', seat, location: inv.location, skill: test.skill,
      prompt: '即将揭示混乱标记' }, events)
    const plan = test.pendingRevealPlan
    if (plan) { delete test.pendingRevealPlan; return plan }
    return null
  }

  function tfaPlayCostPreview(state, inv, code) {
    const def = cardDef(code)
    if (!def) return null
    const traits = (def.traits || []).map(trait => String(trait).toLowerCase())
    const preview = { discount: 0, noAction: false, sources: [] }
    for (const asset of inv.assets) {
      const eff = EFFECTS[asset.code]
      const entry = registeredEntry(asset.code)
      const fastForIllicit = entry?.fastForIllicit ?? eff?.fastForIllicit
      const survivorEventDiscount = entry?.survivorEventDiscount ?? eff?.survivorEventDiscount
      if ((!fastForIllicit && !survivorEventDiscount) || asset.exhausted) continue
      if (fastForIllicit && traits.includes('illicit') && !preview.sources.includes(asset.id)) {
        preview.sources.push(asset.id)
        // Phase 5：fast 走统一读点（卡面 EFFECTS → 描述子的 fast 字段），迁移后优惠口径不变。
        if (cardPlayFlag(code, 'fast')) preview.discount += 1
        else preview.noAction = true
      }
      if (survivorEventDiscount && def.type === 'event'
        && (def.factions || [def.klass]).includes('survivor') && !preview.sources.includes(asset.id)) {
        preview.sources.push(asset.id)
        preview.discount += 2
      }
    }
    return preview.sources.length ? preview : null
  }

  function tfaApplyPlayCost(state, inv, preview, events) {
    if (!preview) return
    for (const id of preview.sources) {
      const asset = inv.assets.find(item => item.id === id)
      if (!asset) continue
      asset.exhausted = true
      info(state, events, `⚡ 横置「${cardName(asset.code)}」以调整本次打出的费用。`)
    }
  }

  function tfaDiscardOnYourOwn(state, inv, events) {
    // Phase 5（5a-7）：「自食其力」这类「控制盟友槽位支援就自我弃掉」由条目级 discardIfControllingAlly 声明。
    const own = inv.assets.filter(asset => registeredEntry(asset.code)?.discardIfControllingAlly)
    if (!own.length) return
    const ownIds = new Set(own.map(asset => asset.id))
    const ally = inv.assets.some(asset => !ownIds.has(asset.id) && normalizedSlots(cardDef(asset.code)).includes('ally'))
    if (!ally) return
    for (const asset of own) {
      leaveAsset(state, inv, asset, events)
      inv.discard.push(asset.code)
      info(state, events, `「${cardName(asset.code)}」因 ${inv.name} 控制了占用盟友槽位的支援而被弃掉。`)
    }
  }

  function tfaBorrowedTimeTurnStart(state, inv, events) {
    // Phase 5（5a-6）：「时间借取」这类「回合开始把滴答换成额外行动」由条目级 clicksToActions 声明。
    for (const asset of inv.assets.filter(item => registeredEntry(item.code)?.clicksToActions && (item.clicks || 0) > 0)) {
      const clicks = asset.clicks
      asset.clicks = 0
      inv.actionsLeft += clicks
      info(state, events, `⏳ 「${cardName(asset.code)}」移除 ${clicks} 声滴答，${inv.name} 本回合获得 ${clicks} 次额外行动。`)
    }
  }

  const TFA_PLAYER_WAVE3_ACTIONS = new Set([
    'youHandleThisOne', 'darkProphecy', 'dumbLuck', 'yaotlIcons', 'yaotlDiscardTop', 'marksmanship',
    'wellPrepared',
    'againstAllOdds', 'pnakoticSkipTest', 'pnakoticNextTest',
  ])

  function tfaPlayerEffect3(state, seat, effect, events) {
    const inv = state.investigators[seat]
    // 「交给你了！」：把刚抽到的遭遇卡转给另一位调查员。
    // 「黑暗预言」：改为揭示 5 个混乱标记，选 1 个带符号的结算。
    // 「狗屎运」：把刚躲避失败的敌人放到遭遇牌库顶。
    // 「雅沃托」：本次检定按弃牌堆顶卡牌的匹配图标加值。
    // 「雅沃托」：弃掉牌库顶。
    // 「枪法如神」：用枪械/远程支援攻击连接地点上的敌人。
    // 「准备万全」：按所选支援上的匹配图标提升本次检定。
    // 「勇斗异劫」：额外揭示 X 个混乱标记并选 1 个结算。
    // 「纳克特手稿」：本次检定不揭示混乱标记。
    // 「纳克特手稿」：让某位调查员本轮下一次检定不揭示混乱标记。
    // 「时间借取」：在支援上放置 1 声滴答。
    // 「虚空碎裂」：用意志攻击，并按封印的「0」标记增加意志与伤害。
    // 「临时路障」：躲避；从弃牌堆打出时还能多躲一个敌人。
    throw new Error(`未实现的失落玩家卡效果：${effect.action}`)
  }

  function tfaPlayerEffect(state, seat, effect, events) {
    // 第三批卡牌统一走 tfaPlayerEffect3；前两批保持在原来的调度器里。
    if (TFA_PLAYER_WAVE3_ACTIONS.has(effect.action)) return tfaPlayerEffect3(state, seat, effect, events)
    return tfaPlayerEffectCore(state, seat, effect, events)
  }

  function tfaPlayerEffectCore(state, seat, effect, events) {
    const inv = state.investigators[seat]
    // 04157「一心一意」的技能成功后：在自己控制的一个充能/秘密支援上放 1 点。
    // 它属于「技能卡的 onSuccess 标志」而不是卡的 event，因此仍留在本调度器里。
    if (effect.action === 'placeChargeOrSecret') {
      const candidates = inv.assets.filter(asset => ['charges', 'secrets'].includes(String(asset.usesType || ''))
        || EFFECTS[asset.code]?.usesType === 'secrets' || EFFECTS[asset.code]?.usesType === 'charges')
      if (!candidates.length) return
      const chosen = candidates.length === 1 ? candidates[0].id : requestChoice(state, { kind: 'target', source: effect.code, seat,
        prompt: '选择要放置充能/秘密的支援。', options: candidates.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
      const asset = candidates.find(item => item.id === chosen) || candidates[0]
      asset.uses = (asset.uses || 0) + 1
      info(state, events, `「${cardName(asset.code)}」获得 1 点${asset.usesType === 'secrets' ? '秘密' : '充能'}。`)
      return
    }
    // 彩饰骷髅：地点上的敌人被击败后放 1 充能。
    // 犯罪现场：发现 1 个线索，地点有敌人时改为 2 个。
    // 收获日：本回合每个行动换 1 资源；若是自己的回合则结束回合。
    // 献祭贡品：弃掉一张秘术支援，然后分配 3 点抽牌/资源。
    // 最后的枪击：对同地点敌人造成 1 点伤害；击败则抽 1 张；若是自己的回合则结束回合。
    // 陈旧猎枪：攻击；揭示骷髅或自动失败时卡膛（本次攻击不造成伤害）。
    // 如痴如醉：在控制的一张支援上放置 1 充能或秘密。
    // 求生匕首：被敌人攻击造成伤害后横置反击。
    // 冒险家：在自己地点的一个支援上放置 1 补给或子弹。
    // 窃听：对未交战敌人检定智识（难度为躲避值），成功发现 2 个线索。
    // 临时武器：攻击，敌人攻击值 -1；从弃牌堆打出时 +1 伤害。
    // 劝服：谈判人形敌人；成功洗回遭遇牌库，精英改为自动躲避。
    // 恢复元气：治疗 1 点伤害（本回合抽到诡计则 2 点）并抽 1 张。
    // 去伪存真：在控制的一张支援上放置 2 秘密。
    // 挥金如土：本次检定 +2；成功返还 3 资源。
    // 萝拉·桑提亚哥：花费隐藏值等量资源发现 1 个线索。
    // 华饰弓：重新搭箭（1 子弹）。
    // 勃朗宁自动步枪：花 1–5 子弹，+X 战斗并造成 X 点伤害。
    // 悄然遁去：躲避加入智识；成功超过 2 点且非精英时下个补给阶段不重整。
    // 鲜血失色：可额外受到最多 3 点伤害，换取意志攻击加成。
    // 养神术：意志检定(0)，按成功点数抽牌，再按超出手牌上限受恐惧。
    // 将就一下：调查帷幕 -1；从弃牌堆打出并成功时额外 1 个线索。
    // 暖水瓶：治疗同地点调查员 1 点伤害（创伤 2 点时为 2 点）。
    // 古旧锈剑：蓄力斩加入意志并造成 +3 伤害；击败精英抽 3 张（每局一次）。
    // 煤油：本地点本轮击败过敌人时，治愈最多 2 点恐惧。
    // 火焰喷射器：攻击攻击值最高的交战敌人 +4，可改为向所有交战敌人分配 4 点伤害。
    // 有利位置：本回合地点帷幕 -1，并可以把别处 1 个线索移过来。
    // 改变命运：弃掉一张未附属精英敌人的非弱点诡计。

    // 背包：从牌库顶 6 张找出最多 3 张非弱点道具/供给卡，正面朝下附属。
    throw new Error(`未实现的失落玩家卡效果：${effect.action}`)
  }

  return { ensureSupplies, suppliesFor, hasSupply, grantSupplies, crossOffSupply, checkSupplies, suppliesAtLocation, vengeancePoints, recordVengeance, isPoisoned, poisonInvestigator, yigsFury, addYigsFury, setExpeditionLeader, moveRelicOfAges, relicOfAges, relicOfAgesLocation, buildExplorationDeck, addToExplorationDeck, doExplore, tfaCardDrawReaction, tfaFailedTestWindow, carcosaPlayerEffect, carcosaInvestigatorEffect, tfaInvestigatorEffect, tfaBeforeChaosReveal, tfaPlayCostPreview, tfaApplyPlayCost, tfaDiscardOnYourOwn, tfaBorrowedTimeTurnStart, TFA_PLAYER_WAVE3_ACTIONS, tfaPlayerEffect3, tfaPlayerEffect, tfaPlayerEffectCore }
}
