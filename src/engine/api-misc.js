// 能力 API · 通用动作与展示（Phase 6 · 6d-11，abilityApi 收尾）。
//
// abilityApi 的最后一批：通用动作（伤害/恐惧/资源/抽牌/线索/移动/混沌标记/检定入口）、
// 卡牌与地点信息读取、牌堆与牌库操作、若干状态标记。拆完这一批，abilityApi 只剩
// 一个「按域 spread」的装配函数。
//
// 依赖注入同前几批；doFight 是工厂产物，用惰性 thunk 注入避免 TDZ。

export function createMiscApi(state, events, deps) {
  const {
    SKILL_NAMES,
    abilityTargets,
    activeEffects,
    addDoom,
    addTrauma,
    aliveInvestigators,
    applyDamage,
    applyHorror,
    assetsCannotReady,
    attachCardTo,
    autoEvadeEnemy,
    cardDef,
    cardHasTrait,
    cardName,
    checkDefeated,
    createEffect,
    damageEnemy,
    discoverClueAt,
    disengageEnemy,
    drawCards,
    effectiveTraits,
    engageEnemy,
    failedTestResolves,
    finishScenario,
    getHandSize,
    getMaxHealth,
    getStat,
    handSize,
    info,
    isWeaknessCard,
    leaveAsset,
    locName,
    newPlayerAssetInstance,
    performTest,
    placeCluesOnLocation,
    playCost,
    playedEffect,
    randomValue,
    relocateEnemy,
    relocateInvestigator,
    removeCardByCode,
    removeOne,
    requestChoice,
    returnAssetToHand,
    searchTop,
    shuffle,
    tokenLabel,
    unique,
    doFightRaw,
  } = deps

  const doFight = (...args) => doFightRaw(...args)

  return {
    info: text => info(state, events, text),
    random: () => randomValue(state),
    choice: options => requestChoice(state, options),
    damage: (seat, amount) => applyDamage(state, state.investigators[seat], amount, events),
    horror: (seat, amount) => applyHorror(state, state.investigators[seat], amount, events),
    directDamage: (seat, amount) => applyDamage(state, state.investigators[seat], amount, events, true),
    directHorror: (seat, amount) => applyHorror(state, state.investigators[seat], amount, events, true),
    healDamage: (seat, amount) => {
      const inv = state.investigators[seat]
      if (inv) inv.damage = Math.max(0, (inv.damage || 0) - amount)
    },
    healHorror: (seat, amount) => {
      const inv = state.investigators[seat]
      if (inv) inv.horror = Math.max(0, (inv.horror || 0) - amount)
    },
    gainResources: (seat, amount) => {
      const inv = state.investigators[seat]
      if (inv) inv.resources += amount
    },
    loseResources: (seat, amount) => {
      const inv = state.investigators[seat]
      if (inv) inv.resources = Math.max(0, inv.resources - amount)
    },
    drawCards: (seat, amount) => drawCards(state, state.investigators[seat], amount, events),
    // Phase 5（5c-18）：抽牌并把引擎的抽牌日志写进事件流。
    // 「扒手」这类旧 handler 自己遍历 drawCards 的返回值打日志，走 api.drawCards 会丢掉
    // 「抽取了 1 张牌」这行——它进 state.log 也进重放指纹，因此需要一个同源的带日志版本。
    drawCardsLogged: (seat, amount) => {
      const texts = drawCards(state, state.investigators[seat], amount, events)
      for (const text of texts) info(state, events, text)
      return texts.length
    },
    discardFromHand: (seat, code) => {
      const inv = state.investigators[seat]
      const index = inv?.hand.indexOf(code)
      if (index == null || index < 0) return false
      inv.hand.splice(index, 1)
      inv.discard.push(code)
      return true
    },
    discoverClue: (seat, amount = 1) => discoverClueAt(state, state.investigators[seat], amount, events),
    placeClues: (seat, amount = 1) => placeCluesOnLocation(state, state.investigators[seat], amount, events),
    moveInvestigator: (seat, locationId) => relocateInvestigator(state, seat, locationId, events),
    damageEnemy: (enemy, amount, seat) => damageEnemy(state, enemy, amount, seat, events),
    moveEnemy: (enemy, locationId) => relocateEnemy(state, enemy, locationId, events),
    engage: (enemy, seat) => engageEnemy(state, enemy, seat, events),
    autoEvade: enemy => autoEvadeEnemy(state, enemy, events),
    exhaust: card => { if (card) card.exhausted = true },
    ready: card => { if (card) card.exhausted = false },
    addUses: (card, amount) => { if (card) card.uses = (card.uses || 0) + amount },
    addDoom: (amount = 1) => addDoom(state, amount, events),
    // Phase 1（A1）：持续效果的唯一创建接口。修正与能力都从 state.effects 读，
    // 到期由引擎的统一过期点处理，内容层不需要（也不允许）自己记时间戳。
    addEffect: (record, ownerSeat = null) => createEffect(state, {
      ...record,
      controllerSeat: record?.controllerSeat ?? ownerSeat ?? state.currentSeat,
    }),
    effects: () => activeEffects(state),
    addChaosToken: token => { state.chaosBag.push(token) },
    removeChaosToken: token => {
      const index = state.chaosBag.indexOf(token)
      if (index >= 0) state.chaosBag.splice(index, 1)
      return index >= 0
    },
    test: (seat, skill, difficulty, options = {}) => performTest(state, seat, skill, difficulty, options),
    setShroudMod: (location, amount) => { if (location) location.shroudMod = (location.shroudMod || 0) + amount },
    addLocationTrait: (location, trait) => {
      if (!location) return
      location.traits ||= []
      if (!location.traits.some(value => String(value).toLowerCase() === String(trait).toLowerCase())) location.traits.push(trait)
    },
    gainAction: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      if (inv) inv.actionsLeft += amount
    },
    finish: key => finishScenario(state, key, events),
    // 查询与检索：内容层不直接读引擎内部实现，只通过这些窄接口。
    cardName: code => cardName(code),
    // Phase 2（C2）：运行期特性读点（含 add:trait 授予），内容层不需要 import 引擎。
    cardTraits: code => cardDef(code)?.traits || [],
    cardIcons: code => ({ ...(cardDef(code)?.icons || {}) }),
    effectiveTraits: code => effectiveTraits(state, state.investigators[state.currentSeat], code),
    locationName: id => locName(state, id),
    // Phase 5（5c）：卡面印刷数值（恐惧/伤害上限），「治愈支援身上的恐惧」这类卡要用。
    cardSanity: code => cardDef(code)?.sanity || 0,
    cardType: code => cardDef(code)?.type || null,
    // Phase 5（5c）：治愈支援自身承受的伤害/恐惧（「急救」这类卡）。
    healAsset: (card, spec = {}) => {
      if (!card) return card
      card.damage = Math.max(0, (card.damage || 0) - (spec.damage || 0))
      card.horror = Math.max(0, (card.horror || 0) - (spec.horror || 0))
      return card
    },
    cardFactions: code => {
      const def = cardDef(code)
      return def?.factions || (def?.klass ? [def.klass] : [])
    },
    // Phase 5（5c）：「本回合该敌人的战斗/躲避值 -N」（解剖图）。
    sealRandomChaosToken: card => {
      if (!card) return null
      let token
      if (state.chaosBag.length) {
        token = state.chaosBag.splice(Math.floor(randomValue(state) * state.chaosBag.length), 1)[0]
      }
      if (!token) { state.chaosBag.push(token); return null }
      card.sealedToken = token
      state.chaos.sealed ||= []
      state.chaos.sealed.push({ token, source: card.id })
      state.sealedTokens = state.chaos.sealed.map(entry => entry.token)
      return token
    },
    // Phase 5（5c-24）：混乱标记的展示文案（内容层写日志时用）。
    tokenLabel: token => tokenLabel(token),
    // Phase 5（5c-21）：「以折扣打出另一张牌」的候选筛选——这张牌现在打出去有没有合法目标。
    // 与 effectError / validateMove 用的是同一份 abilityTargets；没有目标要求时恒为真
    // （与旧 handler 的判定一致：`played` 为空也算"可以打"）。
    cardHasLegalTarget: (seat, code) => {
      const owner = state.investigators[seat]
      const played = playedEffect(code)
      if (!owner || !played) return true
      if (played.target === 'enemy' || ['fight', 'evade'].includes(played.type)) {
        return abilityTargets(state, owner, played).length > 0
      }
      return true
    },
    // Phase 5（5c-19）：把控制的一张支援拿回手牌（「求助盟友」）。
    // 离场钩子照常结算（leaveAsset），与旧 handler 的写法一致。
    returnAssetToHand: (seat, card) => {
      const owner = state.investigators[seat]
      if (!owner || !card) return false
      leaveAsset(state, owner, card, events)
      owner.hand.push(card.code)
      return true
    },
    // Phase 5（5c-19）：读牌库顶 N 张的卡号（**只读**，不移动也不洗牌）。
    // 顺序与 `inv.deck.slice(-N)` 相同（末位是牌库顶），筛选逻辑留在内容层。
    topDeckCodes: (seat, count = 1) => {
      const owner = state.investigators[seat]
      if (!owner) return []
      const n = Math.min(Math.max(0, count), owner.deck.length)
      return n > 0 ? owner.deck.slice(-n) : []
    },
    // Phase 5（5c-19）：把牌库里的一张牌附属到场上的一张支援（不占用槽位）。
    attachCardFromDeck: (host, code) => {
      const owner = state.investigators.find(person => (person.assets || []).includes(host))
      if (!owner || !code) return null
      const index = owner.deck.lastIndexOf(code)
      if (index < 0) return null
      owner.deck.splice(index, 1)
      return attachCardTo(state, owner.seat, code, host)
    },
    shuffleDeck: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.deck = shuffle(owner.deck, () => randomValue(state))
      return owner.deck.length
    },
    // Phase 5（5c-9）：检定的「揭示计划」与额外标记数（黑暗预言 / 勇斗异劫）。
    // Phase 5（5c-12）：重试上一次失败的技能检定（学无止境）。
    retryLastFailedTest: (cardLabel, skillBonus = 0) => {
      const failed = state.lastFailedTest
      const active = state.investigators[state.currentSeat]
      if (!failed || failed.seat !== state.currentSeat) {
        info(state, events, '没有可以重新尝试的技能检定。')
        return false
      }
      info(state, events, `🔁 ${active.name} 用「${cardLabel}」重新尝试${SKILL_NAMES[failed.skill]}检定（+${skillBonus}）。`)
      performTest(state, failed.seat, failed.skill, failed.difficulty, {
        source: failed.source, skillBonus, peril: failed.peril, resolve: failedTestResolves.get(state),
      })
      return true
    },
    // Phase 5（5c-12）：这名调查员**下一次**检定不揭示混乱标记（秘籍的主动能力）。
    skipNextTestTokens: seat => {
      const owner = state.investigators[seat]
      if (!owner) return false
      owner.nextTestNoTokens = { round: state.round }
      return true
    },
    // Phase 5（5c-12）：本次检定不揭示混乱标记（秘籍 / 纳克特手稿）。
    skipTestTokens: () => {
      if (!state.skillTest) return false
      state.skillTest.skipTokens = true
      return true
    },
    // Phase 5（5c-17）：把这张支援附属到敌人身上（手铐：横置 + 脱离交战）。
    attachSelfTo: (code, enemyId) => {
      const active = state.investigators[state.currentSeat]
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (!active || !enemy) return false
      const existing = active.assets.find(asset => asset.code === code)
      if (existing) leaveAsset(state, active, existing, events, { keepAttachments: true })
      attachCardTo(state, active.seat, code, enemy)
      enemy.exhausted = true
      disengageEnemy(state, enemy)
      return true
    },
    // Phase 5（5c-16）：卡面费用与"直接放置入场"（发掘古物）。
    cardCost: code => cardDef(code)?.cost ?? 0,
    putAssetIntoPlay: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !cardDef(code)) return false
      if (!removeCardByCode(owner.hand, code)) return false
      owner.assets.push(newPlayerAssetInstance(state, owner, code))
      return true
    },
    // Phase 5（5c-15）：把伤害设为上限并做击败检查（「我会在地狱里见你」这类自我击败）。
    lethalSelfDamage: seat => {
      const target = state.investigators[seat]
      if (!target) return false
      target.damage = getMaxHealth(target)
      checkDefeated(state, seat, events)
      return true
    },
    // Phase 5（5c-15）：检定中的临时加成 / 成功后的额外结算 / 创伤 / 弃牌堆招募盟友。
    addTestPendingBonus: amount => {
      if (!state.skillTest) return 0
      state.skillTest.pendingBonus = (state.skillTest.pendingBonus || 0) + amount
      return state.skillTest.pendingBonus
    },
    addExtraOnSuccess: effectData => {
      if (!state.skillTest) return false
      state.skillTest.extraOnSuccess ||= []
      state.skillTest.extraOnSuccess.push(effectData)
      return true
    },
    addTrauma: (seat, kind, amount = 1) => {
      if (!state.investigators[seat]) return false
      addTrauma(state, seat, kind, amount, events)
      return true
    },
    recruitAllyFromDiscard: (seat, source = null) => {
      const owner = state.investigators[seat]
      const candidates = state.investigators.flatMap(person => person.discard
        .filter(code => cardDef(code)?.type === 'asset' && (cardDef(code)?.traits || [])
          .some(trait => String(trait).toLowerCase() === 'ally'))
        .map(code => ({ code, owner: person })))
      if (!candidates.length || !owner) return false
      const answer = requestChoice(state, { kind: 'card', source, seat, prompt: '选择弃牌堆中的盟友。',
        options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code, label: cardName(item.code) })) })
      const picked = candidates[Number(answer)]
      if (!picked) return false
      removeOne(picked.owner.discard, picked.code)
      owner.assets.push(newPlayerAssetInstance(state, owner, picked.code))
      return true
    },
    // Phase 5（5c-14）：卡面读数与"打出标记"（时刻警惕 / 障眼戏法）。
    playCost: (seat, code) => {
      const owner = state.investigators[seat]
      const def = cardDef(code)
      return owner && def ? playCost(state, owner, def) : 0
    },
    cardName: code => cardName(code),
    cardTraits: code => (cardDef(code)?.traits || []).map(trait => String(trait).toLowerCase()),
    markSleightOfHand: code => {
      const played = state.investigators[state.currentSeat]?.assets.filter(item => item.code === code).at(-1)
      if (played) played.sleightOfHand = { round: state.round, turnSeat: state.currentSeat }
      return Boolean(played)
    },
    // Phase 5（5c-13）：启动一次技能检定（内容层自己给难度与成功后的后续动作）。
    // 注意：abilityApi 已有 test(seat, skill, difficulty, options)，这里用不同名字避免覆盖。
    startTest: spec => {
      const seat = spec.seat ?? state.currentSeat
      performTest(state, seat, spec.skill, spec.difficulty ?? 0, {
        source: spec.source || undefined,
        skillBonus: spec.skillBonus ?? 0,
        peril: spec.peril === true,
        resolve: typeof spec.resolve === 'function' ? spec.resolve : undefined,
      })
      return true
    },
    // Phase 5（5c-13）：手牌上限与直接恐惧（养神术的溢出惩罚）。
    handSize: seat => getHandSize(state, state.investigators[seat ?? state.currentSeat]),
    applyHorror: (seat, amount) => {
      const target = state.investigators[seat]
      if (!target || !amount) return
      applyHorror(state, target, amount, events)
    },
    planTestReveal: spec => {
      if (!state.skillTest) return null
      state.skillTest.pendingRevealPlan = { ...spec }
      return state.skillTest.pendingRevealPlan
    },
    addExtraChaosChoices: (amount, source = null) => {
      if (!state.skillTest) return 0
      state.skillTest.extraChaosChoices = (state.skillTest.extraChaosChoices || 0) + amount
      if (source) state.skillTest.extraChaosSource = source
      return state.skillTest.extraChaosChoices
    },
    // 调查员当前属性（与 getStat 同源）：判定「难度高出多少」这类卡要用。
    stat: (seat, skill) => getStat(state, state.investigators[seat], skill),
    // 把当前遭遇卡改由指定座位接手（可以指定别人，不只是自己）。
    redirectEncounterTo: seat => {
      const context = state._reaction?.context || state._reaction
      const owner = state.investigators[seat]
      if (!context || !owner || context.when !== 'encounterDrawn') return false
      context.redirectSeat = seat
      context.location = owner.location
      return true
    },
    // 把敌人放回遭遇牌库顶并解除交战（狗屎运）。
    shuffleEnemyToEncounterTop: enemy => {
      if (!enemy) return false
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      for (const owner of state.investigators) {
        if (Array.isArray(owner.engaged)) owner.engaged = owner.engaged.filter(id => id !== enemy.id)
      }
      state.encounterDeck.push(enemy.code)
      return true
    },
    // Phase 5（5c-8）：反应窗口的上下文（快速事件的结算靠它拿到「这次遭遇/攻击」的信息）。
    reactionContext: () => state._reaction || null,
    // 「窄路逃生」：取消正在结算的攻击，并让下一次躲避 +2。
    cancelCurrentAttack: () => {
      if (!state._reaction) return false
      state._reaction.cancelled = true
      return true
    },
    prepareEvadeBonus: (amount = 2, seat = state.currentSeat) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      owner.narrowEscape = { amount, round: state.round, turnSeat: state.currentSeat }
      return owner.narrowEscape
    },
    // 「阿登森林护甲」：取消正在分配的 N 点伤害（反应窗口里的唯一接线点）。
    cancelDamage: (amount = 1) => {
      const reaction = state._reaction
      if (!reaction) return 0
      if (reaction.context) reaction.context.cancelDamage = (reaction.context.cancelDamage || 0) + amount
      else reaction.damage = Math.max(0, (reaction.damage || 0) - amount)
      return amount
    },
    // Phase 5（5c-18）：「追忆未来」在检定开始时指定一个混乱标记。
    // 命中时横置与 +2 仍由引擎的标记揭示段处理（读点 state.skillTest.namedToken 不变）。
    nameChaosToken: (seat, options = {}) => {
      const owner = state.investigators[seat]
      const asset = options.asset || null
      if (!asset || asset.exhausted || !state.skillTest || !owner) {
        info(state, events, options.unavailableText || '现在不能指定混乱标记。')
        return null
      }
      const faces = unique(state.chaosBag)
      const chosen = faces.length === 1 ? faces[0] : requestChoice(state, { kind: 'token', source: asset.id, seat,
        prompt: options.prompt || '指定一个混乱标记；本次检定揭示它时本次检定 +2。',
        options: faces.map(face => ({ id: face, label: tokenLabel(face) })) })
      state.skillTest.namedToken = { token: faces.includes(chosen) ? chosen : faces[0], assetId: asset.id }
      info(state, events, `🔮 ${owner.name} 用「${cardName(asset.code)}」指定了 ${tokenLabel(state.skillTest.namedToken.token)}。`)
      return state.skillTest.namedToken.token
    },
    // Phase 5（5c-18）：「再试一次」把本次检定投入的一张自己的技能牌收回手牌。
    recallCommittedSkill: (seat, options = {}) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      const committed = (state.skillTest?.committed || [])
        .filter(item => item.seat === seat && cardDef(item.code)?.type === 'skill')
      if (!committed.length) {
        info(state, events, options.emptyText || '本次检定没有可收回的技能牌。')
        return null
      }
      const chosen = committed.length === 1 ? committed[0].code : requestChoice(state, { kind: 'card',
        source: options.source || committed[0].code, seat,
        prompt: options.prompt || '选择要返回手牌的一张技能牌。',
        options: committed.map(item => ({ id: item.code, cardCode: item.code, label: cardName(item.code) })) })
      const entry = committed.find(item => item.code === chosen) || committed[0]
      removeOne(state.skillTest.committed, entry)
      owner.hand.push(entry.code)
      info(state, events, `「${cardName(options.source || entry.code)}」把「${cardName(entry.code)}」返回 ${owner.name} 的手牌。`)
      return entry.code
    },
    // 「我來处理」：把当前遭遇卡改由该座位接手结算（反应窗口里唯一的接线点）。
    redirectEncounter: seat => {
      const context = state._reaction?.context || state._reaction
      const owner = state.investigators[seat]
      if (!context || !owner || context.when !== 'encounterDrawn' || context.seat === seat) return false
      context.redirectSeat = seat
      context.location = owner.location
      return true
    },
    isNonWeakness: code => {
      const def = cardDef(code)
      return Boolean(def) && !isWeaknessCard(def)
    },
    enemiesAt: locationId => state.enemies.filter(enemy => enemy.location === locationId),
    investigatorsAt: locationId => aliveInvestigators(state).filter(inv => inv.location === locationId),
    countControlled: (seat, { trait = null, usesType = null } = {}) => {
      const inv = state.investigators[seat]
      if (!inv) return []
      return [...inv.assets, ...(inv.threat || [])].filter(card => {
        // Phase 2（C2）：特性判定合并运行期授予（add:trait）。
        if (trait && !cardHasTrait(state, inv, card.code, trait)) return false
        if (usesType) {
          const type = String(card.usesType || '').toLowerCase()
          if (!(type === String(usesType).toLowerCase() || type === `${String(usesType).toLowerCase()}s`)) return false
        }
        return true
      })
    },
    assetsCannotReady: inv => assetsCannotReady(inv),
    searchTop: (seat, options) => searchTop(state, seat, options, events),
    fight: (seat, enemyId, options = {}) => doFight(state, seat, { enemyId, ...options }, events, options.noSpend === true),
    // Phase 5（5b-8）：技能名（「戴红手套的男子」的提示与日志要用）。
    skillName: skill => SKILL_NAMES[skill] || skill,
    // Phase 5（5a-15）：按 id 取地点（弱点附着用）。
  }
}
