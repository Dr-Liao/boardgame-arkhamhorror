// 能力 API · 敌人 / 威胁 / 毁灭写入（Phase 6 · 6d-8，abilityApi 第二批）。
//
// 这一组方法覆盖「敌人与威胁区的写入」：测试修正、阻止攻击、移除/生成敌人、
// 遭遇牌库交互、线索与毁灭的搬运、绑定标记、销毁与放逐。
// 与 api-card.js 同样的工厂形状：createXxxApi(state, events, deps) —— 能力层只拿得到 api，
// 所以必须继续闭包 state / events。

export function createEnemyApi(state, events, deps) {
  const {
    campaignState,
    assetCannotLeavePlay,
    attachCardTo,
    cardName,
    chooseEnemy,
    enemyDef,
    engageEnemy,
    info,
    isChargeAsset,
    leaveAsset,
    newCardInstance,
    randomValue,
    recordResearch,
    shuffle,
    spawnEnemy,
  } = deps

  return {
    enemyTestModifier: (enemy, spec = {}) => {
      if (!enemy) return enemy
      return campaignState.setEnemyTestModifier(enemy, state, spec)
    },
    // Phase 5（5c）：「本阶段非精英敌人不攻击」（内讧）。
    preventNonEliteAttacks: (seat = state.currentSeat) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      owner.infighting = { round: state.round, phase: 'enemy' }
      return owner.infighting
    },
    // Phase 5（5c）：把敌人移出游戏（不经过伤害）与把卡洗回遭遇牌库（「劝服」）。
    removeEnemy: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      return enemy
    },
    shuffleIntoEncounterDeck: code => {
      state.encounterDeck = shuffle([...state.encounterDeck, code], () => randomValue(state))
      return state.encounterDeck.length
    },
    // Phase 5（5c-10）：这张正在结算的事件是否来自弃牌堆（临时武器 / 应急处理）。
    fromDiscardCode: () => state._fromDiscardCode || null,
    shuffleDiscardIntoDeck: (seat = state.currentSeat) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.deck = shuffle([...owner.deck, ...owner.discard], () => randomValue(state))
      owner.discard = []
      return owner.deck.length
    },
    // Phase 5（5c-23）：「追猎」——遭遇牌库顶 N 张里的敌人候选（只读，顺序按牌库顶在数组末位）。
    encounterEnemies: (count = 9) => {
      const deck = state.encounterDeck || []
      const top = deck.slice(-Math.min(count, deck.length))
      return top.filter(code => Boolean(enemyDef(code)))
    },
    // Phase 5（5c-23）：从遭遇牌库取一张敌人放到该座位所在地点、洗回牌库并交战。
    spawnEncounterEnemy: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !code) return null
      const index = state.encounterDeck.lastIndexOf(code)
      if (index < 0) return null
      state.encounterDeck.splice(index, 1)
      state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
      const spawned = spawnEnemy(state, code, owner.location, seat)
      if (spawned) engageEnemy(state, spawned, seat, events)
      return spawned
    },
    // Phase 5（5c-22）：「预警」花 1 个线索并把它放回所在地点（这是卡的代价，不是退还费用）。
    // 三处写入与旧 handler 逐字一致：个人线索 -N、state.clues（各人线索之和）-N、地点线索 +N。
    spendClueToLocation: (seat, amount = 1) => {
      const owner = state.investigators[seat]
      const location = state.locations.find(item => item.id === owner?.location)
      if (!owner || !location || (owner.clues || 0) < amount) return 0
      owner.clues -= amount
      state.clues = (state.clues || 0) - amount
      location.clues = (location.clues || 0) + amount
      return amount
    },
    // Phase 5（5c-30）：「骷髅钥匙」把支援附属到所在地点（可带声明式字段，如 shroudAsOne）。
    attachSelfToLocation: (card, locationId, fields = {}) => {
      const owner = state.investigators.find(person => (person.assets || []).includes(card))
      const location = state.locations.find(item => item.id === locationId)
      if (!owner || !location || !card) return null
      leaveAsset(state, owner, card, events)
      return attachCardTo(state, owner.seat, card.code, location, fields)
    },
    // Phase 5（5c-29）：「古代雕文」这类卡要把「研究记录」写进战役账本。
    recordResearch: key => {
      if (!key) return false
      recordResearch(state, key)
      return true
    },
    // Phase 5（5c-29）：支援的充能类型（`usesType`）也要能由内容层声明。
    setUsesType: (card, type) => {
      if (!card || !type) return null
      card.usesType = type
      return card.usesType
    },
    // Phase 5（5c-28）：充能支援的判定与「能不能离场」——「灵语人 / 愤怒之灵」这类卡的候选筛选。
    isChargeAsset: card => isChargeAsset(card),
    canLeavePlay: card => !assetCannotLeavePlay(card),
    // Phase 5（5c-27）：「掩埋」——把刚击败的非精英敌人与这张事件卡一起放进胜利区。
    buryEnemyInVictory: (enemy, eventCode) => {
      if (!enemy || enemy.elite) return false
      const originalCode = enemy.originalCode || enemy.code
      const owner = state.investigators[enemy.bearerSeat]
      const piles = owner ? [owner.discard, state.encounterDiscard] : [state.encounterDiscard]
      for (const pile of piles) {
        const index = pile.lastIndexOf(enemy.code)
        if (index >= 0) { pile.splice(index, 1); break }
      }
      if (!state.victoryDisplay.some(card => card.id === enemy.id)) {
        state.victoryDisplay.push({ id: enemy.id, code: enemy.code, originalCode, victory: enemy.victory || 0 })
      }
      // 事件卡本身也进胜利区：处置段读的是反应上下文里的 eventToVictory。
      if (state._reaction) state._reaction.eventToVictory = eventCode
      if (eventCode) info(state, events, `「${cardName(eventCode)}」将「${enemy.name}」和自身加入胜利区。`)
      return true
    },
    // Phase 5（5c-26）：「暗示」这类「先选敌人、再按某个技能躲避」的能力。
    // 与 effectError / validateMove 共用同一份 abilityTargets（旧实现就是 chooseEnemy）。
    chooseEnemy: (seat, effect = {}) => chooseEnemy(state, seat, effect),
    // Phase 5（5c-25）：调查员级的「本局一次」标记（读点就是 inv.gameFlags，随存档往返）。
    gameFlag: (seat, key) => Boolean(state.investigators[seat]?.gameFlags?.[key]),
    setGameFlag: (seat, key, value = true) => {
      const owner = state.investigators[seat]
      if (!owner) return false
      owner.gameFlags ||= {}
      if (value) owner.gameFlags[key] = true
      else delete owner.gameFlags[key]
      return Boolean(value)
    },
    // Phase 5（5c-25）：当前密谋上的毁灭数与移除（「古代遗物」这类卡要读它再写日志）。
    doom: () => state.doom || 0,
    removeDoom: (amount = 1) => {
      const removed = Math.min(amount, state.doom || 0)
      state.doom = (state.doom || 0) - removed
      return removed
    },
    // Phase 5（5c-24）：把正在结算的这张牌**自身**放置入场（「危险预感」这类打出后变成场上卡的事件）。
    putSelfIntoPlay: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !code) return null
      const asset = newCardInstance(state, code, { exhausted: false, enteredRound: state.round })
      owner.assets.push(asset)
      return asset
    },
    // Phase 5（5c-24）：从混乱袋随机抽一个标记并封印到这张卡上（随机数走 randomValue，可重放）。
    // 空袋时的兜底与旧实现逐字一致（把 undefined 塞回袋子，等价于无事发生）。
  }
}
