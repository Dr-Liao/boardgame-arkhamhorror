// 能力 API · 线索 / 毁灭 / 收尾（Phase 6 · 6d-9，abilityApi 第三批）。
//
// 这一组方法负责「调查结果的落账」：线索归还与搬运、毁灭放置与移除、威胁区操作、
// 抽取遭遇、结束回合、资产恐惧/使用次数与牌库顶弃置、帷幕临时修正、附属到地点。
// 与 api-card / api-enemy 相同的工厂形状。

export function createClueApi(state, events, deps) {
  const {
    campaignState,
    doInvestigate,
    doEvade,
    doPlay,
    cardName,
    defeatEnemy,
    doEndTurn,
    drawEncounter,
    enemyEvadeValue,
    enemyFightValue,
    getMaxHealth,
    info,
    leaveAsset,
    locName,
    placeDoomOnCard,
    removeThreat,
    syncClues,
  } = deps

  return {
    returnClueToLocation: (seat, amount = 1) => {
      const owner = state.investigators[seat]
      const location = state.locations.find(item => item.id === owner?.location)
      if (!owner || !location) return 0
      // 「放回 1 个线索」是效果而不是退还费用：线索通常已经作为能力费用付掉了，
      // 因此这里直接放到地点上，不再从调查员身上扣（与旧原语 bookwormBoost 一致）。
      location.clues = (location.clues || 0) + amount
      syncClues(state)
      info(state, events, `🔍 ${owner.name} 把 ${amount} 个线索放回「${locName(state, location.id)}」。`)
      return amount
    },
    placeDoomOnCard: (card, amount = 1) => {
      if (!card) return 0
      placeDoomOnCard(state, card, amount, events, { silent: false })
      return card.doom || 0
    },
    removeThreat: card => {
      const owner = state.investigators.find(item => (item.threat || []).includes(card))
      if (!owner) return false
      removeThreat(state, owner, card, events)
      return true
    },
    drawEncounter: seat => drawEncounter(state, state.investigators[seat], events),
    endTurn: seat => doEndTurn(state, seat ?? state.currentSeat, events),
    // 支援自身的恐惧/充能（不是调查员的）：03112/03271 这类"放在自己身上的计数"。
    addAssetHorror: (card, amount = 1) => {
      if (!card) return 0
      card.horror = (card.horror || 0) + amount
      return card.horror
    },
    setAssetUses: (card, amount) => {
      if (!card) return 0
      card.uses = Math.max(0, amount)
      return card.uses
    },
    discardTopOfDeck: (seat, amount = 1) => {
      const owner = state.investigators[seat]
      if (!owner) return []
      const discarded = []
      for (let i = 0; i < amount && owner.deck.length; i++) {
        const code = owner.deck.pop()
        owner.discard.push(code)
        discarded.push(code)
        info(state, events, `🃏 ${owner.name} 弃掉牌库顶的「${cardName(code)}」。`)
      }
      return discarded
    },
    // 本回合有效的帷幕修正（调查员侧字段 turnShroudMod；战役侧见 campaignState）。
    tempShroudMod: (location, amount) => {
      if (!location) return 0
      location.turnShroudMod = { amount, round: state.round, turnSeat: state.currentSeat }
      return amount
    },
    // Phase 6：战役层的「本回合帷幕」由 campaignState 读写（数据面见 campaign-state.js）。
    tempCampaignShroudMod: (location, amount) => campaignState.setTurnShroudModifier(location, state, amount),
    // Phase 5（5c）：把玩家卡作为「地点附属」放到场上（隐藏处 / 伏击 / 陷阱 / 捷径）。
    // 数据形状与引擎的读点一致（state.playerLocationAttachments），内容层不碰 state 内部结构。
    attachToLocation: (locationId, fields = {}) => {
      if (!locationId) return null
      state.playerLocationAttachments ||= []
      const attachment = {
        code: fields.code, location: locationId,
        ownerSeat: fields.ownerSeat ?? state.currentSeat ?? 0, exhausted: false,
        ...(fields.extra || {}),
      }
      state.playerLocationAttachments.push(attachment)
      info(state, events, `📌 「${cardName(fields.code)}」附属到「${locName(state, locationId)}」。`)
      return attachment
    },
    // Phase 5（5c）：按打出规则直接打出另一张牌（折扣 / 免行动由选项决定）。
    playCard: (seat, code, options = {}) => {
      const owner = state.investigators[seat]
      if (!owner || !(owner.hand.includes(code) || options.fromDiscard === true)) return false
      if (options.discount) campaignState.setPlayDiscount(owner, options.discount)
      doPlay(state, seat, code, events, options.fromDiscard === true, options.noAction === true)
      return true
    },
    // Phase 5（5c）：调查与躲避的主体流程（与行动入口共用同一份规则与日志）。
    // options 直接透传：{ locationId, shroudMod, addSkill, clueBonus, lockpicksAssetId, ancientStone } /
    // { enemyId, skill, addSkill, moveAfterEvade, skipReadyRounds, evadeModifier }。
    investigate: (seat, options = {}) => doInvestigate(state, seat, { ...options }, events, true),
    evade: (seat, options = {}) => doEvade(state, seat, { ...options }, events, true),
    // Phase 5（5c）：读取敌人的当前战斗值（含修正），供「攻击战斗值最高的交战敌人」这类卡使用。
    enemyFight: (enemy, seat = state.currentSeat) => enemyFightValue(state, enemy, state.investigators[seat]),
    // Phase 5（5c）：敌人的当前躲避值（含修正），躲避类检定（「伏击」等）要用。
    enemyEvade: (enemy, seat = state.currentSeat) => enemyEvadeValue(state, enemy, state.investigators[seat]),
    // Phase 5（5c）：调查员当前的伤害上限（含被动与修正），「最多额外承受 N 点伤害」这类卡要用。
    maxHealth: (seat = state.currentSeat) => getMaxHealth(state.investigators[seat]),
    // Phase 5（5c）：把一张支援弃掉（离场 + 进弃牌堆）。
    discardAsset: (seat, card) => {
      const owner = state.investigators[seat]
      if (!owner || !card) return false
      leaveAsset(state, owner, card, events)
      if (!card.removedFromGame && !card.returnedToHand) owner.discard.push(card.code)
      return true
    },
    // Phase 5（5c）：击败敌人（恐惧/战斗之外的效果，如「与你们同归于尽」）。
    defeatEnemy: (enemy, seat = state.currentSeat) => {
      if (!enemy || !state.enemies.includes(enemy)) return false
      enemy.defeatedBy = seat
      defeatEnemy(state, enemy, events)
      return true
    },
    moveClueToLocation: (fromId, toId, amount = 1) => {
      const from = state.locations.find(location => location.id === fromId)
      const to = state.locations.find(location => location.id === toId)
      if (!from || !to) return 0
      const moved = Math.min(amount, from.clues || 0)
      if (!moved) return 0
      from.clues -= moved
      to.clues = (to.clues || 0) + moved
      syncClues(state)
      return moved
    },
  }
}
