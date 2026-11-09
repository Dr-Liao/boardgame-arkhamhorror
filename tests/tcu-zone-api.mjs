// 章节/玩家卡钩子级测试共用的「区域 API」替身。
//
// 引擎 scenario-runtime 的遭遇区/玩家区/密谋牌库旁 API 在 2026-11-09 P1-14 收口后，
// 条目改成只调用这些 API；钩子级测试的窄 api 桩需要同样形状的替身，否则测试只验证旧直写路径。
// 实现语义与 src/engine/scenario-runtime.js 对应方法一致（顺序/默认参数相同），只面向纯 JSON state。

export function zoneApi (state) {
  const inv = seat => (state.investigators || [])[seat]
  const api = {
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setScenarioFlag: (key, value = true) => {
      state.scenarioFlags ||= {}
      if (value === undefined || value === null) delete state.scenarioFlags[key]
      else state.scenarioFlags[key] = value
    },
    // ---- 遭遇牌库 / 弃牌堆 ----
    encounterDeckCards: () => [...(state.encounterDeck || [])],
    encounterDiscardCards: () => [...(state.encounterDiscard || [])],
    discardEncounterTop: (count = 1, options = {}) => {
      state.encounterDeck ||= []
      state.encounterDiscard ||= []
      const discarded = []
      for (let index = 0; index < Math.max(0, Number(count) || 0); index++) {
        if (!state.encounterDeck.length && options.reshuffle !== false && state.encounterDiscard.length) {
          state.encounterDeck = [...state.encounterDiscard]
          state.encounterDiscard = []
        }
        if (!state.encounterDeck.length) break
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        discarded.push(code)
      }
      return discarded
    },
    discardEncounterCards: codes => {
      state.encounterDiscard ||= []
      const list = (Array.isArray(codes) ? codes : [codes]).filter(Boolean)
      state.encounterDiscard.push(...list)
      return list.length
    },
    putOnEncounterDeck: (codes, options = {}) => {
      state.encounterDeck ||= []
      const list = (Array.isArray(codes) ? codes : [codes]).filter(Boolean)
      if (options.bottom === true) state.encounterDeck.unshift(...list)
      else state.encounterDeck.push(...list)
      return list.length
    },
    takeEncounterDeckCard: code => {
      const index = (state.encounterDeck || []).lastIndexOf(String(code))
      if (index < 0) return null
      return state.encounterDeck.splice(index, 1)[0]
    },
    takeEncounterDiscard: (code, options = {}) => {
      state.encounterDeck ||= []
      state.encounterDiscard ||= []
      const index = state.encounterDiscard.lastIndexOf(String(code))
      if (index < 0) return false
      state.encounterDiscard.splice(index, 1)
      if (options.toDeck === true) state.encounterDeck.push(String(code))
      return true
    },
    takeEncounterCard: code => {
      for (const pile of ['encounterDeck', 'encounterDiscard']) {
        const list = state[pile] || []
        const index = list.lastIndexOf(String(code))
        if (index >= 0) { list.splice(index, 1); return { pile } }
      }
      return null
    },
    takeEncounterDeckBottom: () => {
      state.encounterDeck ||= []
      return state.encounterDeck.length ? state.encounterDeck.shift() : null
    },
    // ---- 额外遭遇牌堆（幽灵界）----
    extraDeckInfo: id => {
      const piles = state.extraEncounterDecks?.[id]
      return { deck: Array.isArray(piles?.deck) ? piles.deck.length : 0, discard: [...(piles?.discard || [])] }
    },
    discardExtra: (id, count = 1) => {
      const piles = (state.extraEncounterDecks ||= {})[id] ||= { deck: [], discard: [] }
      piles.deck ||= []
      piles.discard ||= []
      const discarded = []
      for (let index = 0; index < Math.max(0, count); index++) {
        if (!piles.deck.length) break
        const code = piles.deck.pop()
        piles.discard.push(code)
        discarded.push(code)
      }
      return discarded
    },
    discardExtraCards: (id, codes) => {
      const piles = (state.extraEncounterDecks ||= {})[id] ||= { deck: [], discard: [] }
      piles.discard ||= []
      const list = (Array.isArray(codes) ? codes : [codes]).filter(Boolean)
      piles.discard.push(...list)
      return piles.discard.length
    },
    takeExtraDiscard: (id, code) => {
      const piles = state.extraEncounterDecks?.[id]
      const index = (piles?.discard || []).lastIndexOf(String(code))
      if (index < 0) return null
      return piles.discard.splice(index, 1)[0]
    },
    addExtra: (id, codes, options = {}) => {
      const piles = (state.extraEncounterDecks ||= {})[id] ||= { deck: [], discard: [] }
      piles.deck ||= []
      const list = (Array.isArray(codes) ? codes : [codes]).filter(Boolean)
      if (options.top === true) piles.deck.push(...list.reverse())
      else piles.deck.unshift(...list)
      return piles
    },
    drawExtra: (seat, id) => {
      const piles = state.extraEncounterDecks?.[id]
      if (!piles) return null
      if (!piles.deck?.length && piles.discard?.length) { piles.deck = [...piles.discard]; piles.discard = [] }
      if (!piles.deck?.length) return null
      return piles.deck.pop()
    },
    // ---- 密谋牌库旁（agendaAside）----
    putNextToAgenda: (code, extra = {}) => {
      state.agendaAside ||= []
      const card = { id: `aside-${state.agendaAside.length + 1}-${code}`, code, originalCode: code, ...extra }
      state.agendaAside.push(card)
      return card
    },
    agendaAsideCards: () => (state.agendaAside || []).map(card => card.originalCode || card.code),
    discardAgendaAside: id => {
      const list = state.agendaAside || []
      const index = list.findIndex(card => card.id === id)
      if (index < 0) return null
      const [card] = list.splice(index, 1)
      return card.originalCode || card.code
    },
    removeAgendaAside: id => {
      const list = state.agendaAside || []
      const index = list.findIndex(card => card.id === id)
      if (index < 0) return false
      const [card] = list.splice(index, 1)
      state.removedFromGame ||= []
      state.removedFromGame.push(card.originalCode || card.code)
      return true
    },
    // ---- 玩家区域 ----
    gainResources: (seat, amount) => {
      const owner = inv(seat)
      if (!owner) return 0
      owner.resources = (owner.resources || 0) + Number(amount || 0)
      return owner.resources
    },
    loseResources: (seat, amount) => {
      const owner = inv(seat)
      if (!owner) return 0
      const lost = Math.min(owner.resources || 0, Math.max(0, Number(amount) || 0))
      owner.resources -= lost
      return lost
    },
    gainClues: (seat, amount) => {
      const owner = inv(seat)
      if (!owner) return 0
      owner.clues = (owner.clues || 0) + Number(amount || 0)
      return owner.clues
    },
    loseClues: (seat, amount) => {
      const owner = inv(seat)
      if (!owner) return 0
      const lost = Math.min(owner.clues || 0, Math.max(0, Number(amount) || 0))
      owner.clues -= lost
      return lost
    },
    spendClues: (seat, amount) => {
      const owner = inv(seat)
      if (!owner) return 0
      owner.clues = Math.max(0, (owner.clues || 0) - Math.max(0, Number(amount) || 0))
      return owner.clues
    },
    addCluesToLocation: (locationId, amount = 1) => {
      const target = (state.locations || []).find(location => location.id === locationId)
      if (!target) return 0
      target.clues = (target.clues || 0) + Math.max(0, Number(amount) || 0)
      return target.clues
    },
    removeLocationClues: (locationId, amount = 1) => {
      const target = (state.locations || []).find(location => location.id === locationId)
      if (!target) return 0
      const removed = Math.min(target.clues || 0, Math.max(0, Number(amount) || 0))
      target.clues -= removed
      return removed
    },
    putInHand: (seat, code) => {
      const owner = inv(seat)
      if (!owner) return null
      owner.hand ||= []
      owner.hand.push(code)
      return code
    },
    putInDiscard: (seat, code, options = {}) => {
      const owner = inv(seat)
      if (!owner) return false
      if (options.fromHand === true) {
        const index = (owner.hand || []).lastIndexOf(code)
        if (index >= 0) owner.hand.splice(index, 1)
      }
      owner.discard ||= []
      owner.discard.push(code)
      return true
    },
    takeDiscardCard: (seat, code) => {
      const owner = inv(seat)
      const index = (owner?.discard || []).lastIndexOf(String(code))
      if (index < 0) return null
      return owner.discard.splice(index, 1)[0]
    },
    putOnTopOfDeck: (seat, code) => {
      const owner = inv(seat)
      if (!owner) return false
      owner.deck ||= []
      owner.deck.push(code)
      return true
    },
    putOnDeckBottom: (seat, code) => {
      const owner = inv(seat)
      if (!owner) return false
      owner.deck ||= []
      owner.deck.unshift(code)
      return true
    },
    takeDeckBottom: seat => {
      const owner = inv(seat)
      return (owner?.deck || []).length ? owner.deck.shift() : null
    },
    takeDeckCard: (seat, code) => {
      const owner = inv(seat)
      const index = (owner?.deck || []).lastIndexOf(String(code))
      if (index < 0) return null
      return owner.deck.splice(index, 1)[0]
    },
    removeFromGameCards: codes => {
      state.removedFromGame ||= []
      const list = (Array.isArray(codes) ? codes : [codes]).filter(Boolean)
      for (const code of list) if (!state.removedFromGame.includes(code)) state.removedFromGame.push(code)
      return list.length
    },
    // ---- 敌人实例字段 ----
    damageEnemy: (enemy, amount) => {
      if (!enemy) return 0
      enemy.damageTaken = (Number(enemy.damageTaken) || 0) + Math.max(0, Number(amount) || 0)
      return enemy.damageTaken
    },
    setEnemyDamageTaken: (enemy, amount = 0) => {
      if (!enemy) return null
      enemy.damageTaken = Math.max(0, Number(amount) || 0)
      return enemy.damageTaken
    },
    putEnemyInPlay: enemy => {
      if (!enemy) return false
      if (!(state.enemies || []).includes(enemy)) state.enemies.push(enemy)
      return state.enemies.includes(enemy)
    },
    readyEnemy: enemy => { if (enemy) enemy.exhausted = false; return true },
    exhaustEnemy: enemy => { if (enemy) enemy.exhausted = true; return true },
    preventEnemyReady: (enemy, rounds = 1) => {
      if (!enemy) return false
      enemy.preventReady = { from: state.round, rounds }
      return true
    },
    disengageEnemy: enemy => {
      if (!enemy) return false
      const holder = (state.investigators || []).find(owner => (owner.engaged || []).includes(enemy.id))
      if (holder) holder.engaged = holder.engaged.filter(id => id !== enemy.id)
      enemy.engagedSeat = null
      return true
    },
    setEnemyRoundFightEvadeBonus: (enemy, amount = 2, options = {}) => {
      if (!enemy) return null
      enemy.roundFightEvadeBonus = { round: options.round ?? state.round, amount: Number(amount) || 2 }
      return enemy.roundFightEvadeBonus
    },
    setEnemyAside: enemy => {
      if (!enemy || !(state.enemies || []).includes(enemy)) return null
      state.enemies.splice(state.enemies.indexOf(enemy), 1)
      state.setAsideEnemies ||= []
      state.setAsideEnemies.push(enemy)
      return enemy.id
    },
    restoreEnemyFromAside: (id, locationId) => {
      const index = (state.setAsideEnemies || []).findIndex(enemy => enemy.id === id)
      if (index < 0) return null
      const [enemy] = state.setAsideEnemies.splice(index, 1)
      enemy.location = locationId
      state.enemies.push(enemy)
      return enemy
    },
    removeEnemyFromGame: enemy => {
      if (!enemy || !(state.enemies || []).includes(enemy)) return false
      state.enemies.splice(state.enemies.indexOf(enemy), 1)
      state.removedFromGame ||= []
      state.removedFromGame.push(enemy.originalCode || enemy.code)
      return true
    },
    doomOn: (card, amount = 1) => {
      if (!card) return 0
      if (typeof state.canPlaceDoom === 'function' && state.canPlaceDoom(card) === false) return 0
      card.doom = (Number(card.doom) || 0) + Math.max(0, Number(amount) || 0)
      return Math.max(0, Number(amount) || 0)
    },
    removeDoomFromCard: (card, amount = 1) => {
      if (!card) return 0
      const removed = Math.min(Number(card.doom) || 0, Math.max(0, Number(amount) || 0))
      card.doom = (Number(card.doom) || 0) - removed
      if (!card.doom) delete card.doom
      return removed
    },
    clearDoomOnCard: card => {
      if (!card) return 0
      const removed = Number(card.doom || 0)
      delete card.doom
      return removed
    },
    removeDoom: (amount = 1) => {
      const removed = Math.min(Number(state.doom) || 0, Math.max(0, Number(amount) || 0))
      state.doom = (Number(state.doom) || 0) - removed
      return removed
    },
    addDoom: (amount = 1) => { state.doom = (Number(state.doom) || 0) + Number(amount) },
    // ---- 地点 / 连接 / 场景标记 / 放逐 ----
    connectLocations: (aId, bId) => {
      const a = (state.locations || []).find(location => location.id === aId)
      const b = (state.locations || []).find(location => location.id === bId)
      if (!a || !b) return false
      a.connections ||= []
      b.connections ||= []
      if (!a.connections.includes(bId)) a.connections.push(bId)
      if (!b.connections.includes(aId)) b.connections.push(aId)
      return true
    },
    locationAttachments: locationId => {
      const location = (state.locations || []).find(item => item.id === locationId)
      return [...(location?.attachments || [])]
    },
    attachEncounterToLocation: (code, locationId, extra = {}) => {
      const location = (state.locations || []).find(item => item.id === locationId)
      if (!location) return null
      location.attachments ||= []
      const attachment = { id: `locatt-${locationId}-${location.attachments.length + 1}-${code}`, code, ...extra }
      location.attachments.push(attachment)
      return attachment
    },
    takeFromSetAside: code => {
      const list = state.scenarioZones?.setAside
      if (!Array.isArray(list)) return false
      const index = list.indexOf(String(code))
      if (index < 0) return false
      list.splice(index, 1)
      return true
    },
    exileCard: (code, options = {}) => {
      const owner = (state.investigators || [])[options.seat ?? 0]
      if (!owner) return false
      state.exiled ||= []
      state.exiled.push(String(code))
      state.exiledBySeat ||= []
      state.exiledBySeat.push({ seat: owner.seat, code: String(code) })
      return true
    },
    addCommittedExtraIcons: (icon, options = {}) => {
      const committed = (state.skillTest?.committed || [])
        .find(item => options.committedId == null || item.id === options.committedId)
        || (state.skillTest?.committed || [])[state.skillTest?.committed?.length - 1]
      if (!committed) return false
      committed.extraIcons = [...(committed.extraIcons || []), icon]
      return true
    },
    setEnemyPreySeat: (enemy, seat) => {
      if (!enemy) return null
      if (seat == null) delete enemy.preySeat
      else enemy.preySeat = seat
      return enemy.preySeat ?? null
    },
  }
  return api
}
