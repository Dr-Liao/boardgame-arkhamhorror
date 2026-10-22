// 能力 API · 卡牌与状态写入口（Phase 6 · 6d-7 第一批）。
//
// `abilityApi(state, events)` 是个 179 个方法的巨型对象，按域拆开的第一块：
// 「按 id 查/取、把牌放进弃牌堆、遭遇牌库顶敌人、最远地点、生成敌人、标记弱点、
//  揭示混乱标记、封印、驱逐、复制打出……」——即 Phase 5 期间为卡牌内容补的**薄写入封装**。
//
// 每个方法都闭包 `state` / `events`（能力层只拿得到 api，拿不到引擎内部），
// 所以这里用 `createCardApi(state, events, deps)` 的形式注入。

export function createCardApi(state, events, deps) {
  const {
    CLASS_NAMES,
    beginChaosTest,
    cardDef,
    cardName,
    checkDefeated,
    chooseLolaRole,
    descriptorOfKind,
    disengageAll,
    drawChaosToken,
    endChaosTest,
    enemyAttack,
    enemyDef,
    executeDescriptor,
    farthestLocationsFor,
    getMaxHealth,
    info,
    itemDiscountAtLocation,
    locName,
    makeRuntime,
    newPlayerAssetInstance,
    notifyCluesRemoved,
    playCost,
    playedEffect,
    removeOne,
    resolveEffect,
    scenarioBehavior,
    scenarioRuntime,
    spawnEnemy,
    syncClues,
  } = deps

  return {
    locationById: id => state.locations.find(location => location.id === id) || null,
    // Phase 5（5a-15）：把一张牌直接放进弃牌堆（附着型弱点没找到目标时用）。
    putIntoDiscard: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !code) return false
      owner.discard.push(code)
      return true
    },
    // Phase 5（5a-15）：「惩戒邪恶 / 寻找伊兹」共用——遭遇牌库顶的敌人、最远地点、生成敌人与两个标记。
    encounterTopEnemy: () => {
      while (state.encounterDeck.length) {
        const code = state.encounterDeck.pop()
        if (enemyDef(code)) return code
        state.encounterDiscard.push(code)
      }
      return null
    },
    farthestLocations: seat => farthestLocationsFor(state, state.investigators[seat] || state.investigators[state.currentSeat]),
    spawnEnemyAt: (code, locationId) => spawnEnemy(state, code, locationId, null),
    markSmiteTheWicked: (enemy, seat) => {
      if (!enemy) return false
      enemy.smiteTheWickedSeat = seat
      return true
    },
    markSearchingForIzzie: (location, seat) => {
      if (!location) return false
      location.searchingForIzzieSeat = seat
      return true
    },
    // Phase 5（5a-14）：「梦魇」这类弱点让玩家弃掉牌库顶 N 张（走剧本运行时）。
    scenarioDiscardTop: (seat, count = 3) => scenarioRuntime(state, events).discardTop(seat, count),
    // Phase 5（5a-12）：「最终狂想曲」这类「一次性揭示 N 枚标记（不生成检定）」。
    revealChaosTokens: count => {
      beginChaosTest(state)
      const tokens = Array.from({ length: Math.min(count, state.chaosBag.length) }, () => drawChaosToken(state))
      endChaosTest(state, tokens)
      return tokens
    },
    // Phase 5（5b-8）：「戴红手套的男子」把两项技能的基础值提升为 6。
    setStatOverride: (card, skills) => {
      if (!card) return null
      card.statOverride = [...skills]
      return card.statOverride
    },
    // Phase 5（5c-39）：「原定计划」把牌放进 attached（不是 attachments），并能从那里面打出。
    attachedCodes: host => (host?.attached || []).slice(),
    attachToHostByCode: (host, code) => {
      if (!host) return false
      const owner = state.investigators.find(person => (person.deck || []).includes(code))
      if (!owner) return false
      const index = owner.deck.indexOf(code)
      if (index < 0) return false
      owner.deck.splice(index, 1)
      host.attached ||= []
      host.attached.push(code)
      return true
    },
    // Phase 5（5c-38）：「遗觉记忆」——所有弃牌堆里的候选、复制的费用、移出游戏、重放被复制的事件。
    discardPiles: () => state.investigators.flatMap(owner => (owner.discard || [])
      .map(code => ({ code, seat: owner.seat }))),
    playCostOf: (seat, code) => {
      const owner = state.investigators[seat]
      const def = cardDef(code)
      return owner && def ? playCost(state, owner, def) : 0
    },
    exileFromDiscard: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner) return false
      const index = (owner.discard || []).lastIndexOf(code)
      if (index < 0) return false
      owner.discard.splice(index, 1)
      state.removedFromGame ||= []
      state.removedFromGame.push(code)
      return true
    },
    // 重放「被复制的事件卡」的打出效果：数据体与描述子两条读点都走这里。
    replayPlayedCode: (seat, code) => {
      const played = playedEffect(code)
      const descriptor = descriptorOfKind(code, 'played')
      const previousFromDiscard = state._fromDiscardCode
      state._fromDiscardCode = null
      try {
        if (descriptor?.resolve) {
          executeDescriptor(state, { inv: state.investigators[seat], source: { code, id: code }, descriptor,
            context: { fromDiscard: false, copyCode: null, cardId: code }, events })
          return true
        }
        if (played) { resolveEffect(state, seat, played, makeRuntime(state, events)); return true }
        return false
      } finally {
        if (previousFromDiscard === undefined) delete state._fromDiscardCode
        else state._fromDiscardCode = previousFromDiscard
      }
    },
    // Phase 5（5c-37）：「时间借取」的滴答计数（上限 3）与「虚空碎裂」的封印「0」标记支付。
    addClicks: (card, max = 3) => {
      if (!card) return null
      if ((card.clicks || 0) >= max) return card.clicks
      card.clicks = (card.clicks || 0) + 1
      return card.clicks
    },
    sealedTokensFrom: (card, token = '0') => (state.chaos?.sealed || [])
      .filter(entry => entry.source === card?.id && entry.token === token).length,
    releaseSealedToken: (card, token = '0') => {
      const entry = (state.chaos?.sealed || []).find(item => item.source === card?.id && item.token === token)
      if (!entry) return null
      state.chaos.sealed = state.chaos.sealed.filter(item => item !== entry)
      state.sealedTokens = state.chaos.sealed.map(item => item.token)
      state.chaosBag.push(entry.token)
      return entry.token
    },
    // Phase 5（5c-36）：「死里逃生」的候选地点——已揭示且没有敌人。
    locationsWithoutEnemies: () => state.locations.filter(location => location.revealed
      && !state.enemies.some(enemy => enemy.location === location.id)),
    // Phase 5（5c-36）：「死里逃生」——与所有敌人解除交战、把威胁区的牌丢进弃牌堆、软结束回合。
    disengageAll: seat => disengageAll(state, seat, events),
    discardAllThreats: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      let removed = 0
      for (const threat of owner.threat.slice()) {
        removeOne(owner.threat, threat)
        owner.discard.push(threat.code)
        removed++
      }
      return removed
    },
    softEndTurn: seat => {
      const owner = state.investigators[seat]
      if (!owner) return false
      if (state.currentSeat === seat) { owner.actionsLeft = 0; owner.turnEnded = true }
      return owner.turnEnded === true
    },
    // Phase 5（5c-36）：「时间曲折」——把整局状态回滚到上一个动作的快照，
    // 保留该调查员的手牌/资源/弃牌堆与「移出游戏」，并保留事务层的 _resolution/revision。
    rewindLastAction: seat => {
      const snapshot = state.lastActionSnapshot
      if (!snapshot) return false
      const owner = state.investigators[seat]
      if (!owner) return false
      const preserved = { hand: owner.hand.slice(), resources: owner.resources,
        discard: owner.discard.slice(), removedFromGame: (state.removedFromGame || []).slice() }
      const resolution = state._resolution
      const revision = state.revision
      for (const key of Object.keys(state)) delete state[key]
      Object.assign(state, structuredClone(snapshot))
      Object.assign(state.investigators[seat], preserved)
      state.removedFromGame = preserved.removedFromGame
      state._resolution = resolution
      state.revision = revision
      state._timeWarped = true
      return true
    },
    // Phase 5（5c-35）：「同归于尽」用——列出与我交战的所有敌人（不限地点）。
    engagedEnemies: seat => state.enemies.filter(enemy => enemy.engagedSeat === seat),
    // Phase 5（5c-35）：写调查员实例上的 physicalTrauma/mentalTrauma（**不是**战役账本）。
    // 「同归于尽」的旧实现只写了这个实例字段：引擎里没有读点、也不写日志——见 §4.44 的已知缺陷记录。
    bumpInstanceTrauma: (seat, kind, amount = 1) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      const key = kind === 'physical' ? 'physicalTrauma' : 'mentalTrauma'
      owner[key] = (owner[key] || 0) + amount
      return owner[key]
    },
    // Phase 5（5c-35）：「同归于尽」把伤害直接拉到最大生命值，再走一次击败检查（与旧原语同序）。
    setDamageToMax: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.damage = getMaxHealth(owner)
      checkDefeated(state, seat, events)
      return owner.damage
    },
    // Phase 5（5c-35）：「查尔斯·罗斯」这类「本地点下一件物品 -N」，记在支援或玩家身上。
    setLocationItemDiscount: (seat, card, amount = 1) => {
      const owner = state.investigators[seat ?? state.currentSeat]
      const record = { amount, round: state.round, phase: state.phase }
      if (card) card.itemDiscountAtLocation = record
      else if (owner) owner.itemDiscountAtLocation = record
      return record
    },
    // Phase 5（5c-34）：「背包」把牌放在 attachedCards 上（能从那里当手牌打出）与从牌库取走若干张。
    setAttachedCards: (host, codes) => {
      if (!host) return null
      host.attachedCards = [...codes]
      return host.attachedCards
    },
    takeFromDeck: (seat, codes) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      let taken = 0
      for (const code of codes || []) {
        const index = owner.deck.lastIndexOf(code)
        if (index >= 0) { owner.deck.splice(index, 1); taken++ }
      }
      return taken
    },
    // Phase 5（5c-33）：「吃子弹」这类在反应窗口里给本次检定加「额外揭示数」的卡。
    // 反应窗口里写反应上下文（战斗流程在窗口后读 context.extraChaosChoices），否则写 skillTest。
    addExtraChaosChoicesToTest: amount => {
      const reaction = state._reaction
      const target = reaction && (reaction.context || reaction)
      if (target) {
        target.extraChaosChoices = (target.extraChaosChoices || 0) + amount
        return target.extraChaosChoices
      }
      if (state.skillTest) {
        state.skillTest.extraChaosChoices = (state.skillTest.extraChaosChoices || 0) + amount
        return state.skillTest.extraChaosChoices
      }
      return 0
    },
    // Phase 5（5c-32）：「英勇救援」这类由卡牌造成的敌人攻击（不计入「不能攻击」开关）。
    enemyAttackByCard: (enemy, label, seat = state.currentSeat) => {
      const target = state.investigators[seat] || state.investigators[state.currentSeat]
      if (!enemy || !target) return false
      return enemyAttack(state, enemy, target, events, label, { kind: 'effect' })
    },
    // Phase 5（5c-32）：「即兴表演」这类切换角色（会写 inv.role）与「本回合下一张该阵营卡 -N」。
    switchRole: (seat, source, prompt) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      return chooseLolaRole(state, owner, source, prompt)
    },
    setRoleDiscount: (seat, role, amount = 3) => {
      const owner = state.investigators[seat]
      if (!owner || !role) return null
      owner.lolaDiscount = { role, amount, round: state.round, turnSeat: state.currentSeat }
      return owner.lolaDiscount
    },
    className: role => CLASS_NAMES[role] || role,
    // Phase 5（5c-31）：这个敌人是否还在场上（反击类能力要先确认目标没被同窗口的效果清掉）。
    isEnemyInPlay: enemy => Boolean(enemy) && state.enemies.includes(enemy),
    discoverAt: (seat, locationId, amount = 1, { silent = false, log = null } = {}) => {
      const inv = state.investigators[seat]
      const location = state.locations.find(entry => entry.id === locationId)
      if (!inv || !location) return 0
      const got = Math.min(amount, location.clues || 0)
      if (!got) return 0
      location.clues -= got
      inv.clues += got
      syncClues(state)
      // log：调用方需要自己的文案（「寻找答案」）；silent：调用方已经写过日志。
      if (log) info(state, events, log)
      else if (!silent) info(state, events, `🔍 ${inv.name} 在「${locName(state, location.id)}」发现 ${got} 个线索。`)
      notifyCluesRemoved(state, location, got, events)
      return got
    },
    putIntoPlay: (seat, code) => {
      const inv = state.investigators[seat]
      const index = inv?.hand.indexOf(code) ?? -1
      if (!inv || index < 0) return null
      if (scenarioBehavior(state).canPlaceAsset?.(state, inv, code) === false) {
        info(state, events, `⛔ 「${cardName(code)}」当前不能放置入场。`)
        return null
      }
      inv.hand.splice(index, 1)
      const asset = newPlayerAssetInstance(state, inv, code)
      inv.assets.push(asset)
      scenarioBehavior(state).assetEntered?.(state, inv, asset, scenarioRuntime(state, events))
      info(state, events, `🎴 ${inv.name} 将「${cardName(code)}」放置入场。`)
      return asset
    },
  }
}
