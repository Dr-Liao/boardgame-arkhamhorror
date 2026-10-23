// 额外遭遇牌堆（第二遭遇牌库）原语 —— 第 2 步 P2.2。
//
// 印刷规则：万象无终的幽灵界使用**第二套遭遇牌库**（Spectral Encounter Deck）：
// 建堆（把指定的幽灵牌洗成一堆）、从这堆抽牌结算（与普通遭遇牌同一套显现管线）、
// 洗回、弃牌；桌面只公开「牌堆张数」与弃牌堆内容，牌堆顺序不进入观察投影。
//
// 本模块只提供纯数据操作（不依赖引擎装配点）：
//   · 状态形状 `state.extraEncounterDecks = { spectral: { deck: string[], discard: string[] } }`
//     —— 纯 JSON，随存档往返；未知 id 在调用的第一时间抛错（注册期/结算期即失败）。
//   · 洗牌必须由调用方注入 `shuffle`（引擎只允许 `randomValue(state)` 驱动随机），
//     本模块**不自己造随机数**，因此可以确定性地单测。
//   · 抽牌结算走 `encounter.js` 的 `drawEncounter(state, inv, events, { deck })`，
//     与普通遭遇牌共用同一条显现管线（取消/重抽/涌动/敌人生成/诡计结算）。
//
// 与既有第二牌堆的关系：探索牌库（`state.explorationDeck`）是第三循环的**地点**牌库，
// 直觉牌库是调查员专属牌库；两者都不是遭遇牌库，本模块不复用它们的字段。

// 本轮允许的第二遭遇牌堆 id。新增一套牌堆 = 新增词表成员 + 测试 + 文档。
export const EXTRA_ENCOUNTER_DECKS = Object.freeze(['spectral'])

export function extraDeckId(raw) {
  const id = String(raw ?? '')
  if (!EXTRA_ENCOUNTER_DECKS.includes(id)) {
    throw new Error(`未知的额外遭遇牌堆：${JSON.stringify(raw)}（可用：${EXTRA_ENCOUNTER_DECKS.join('、')}）`)
  }
  return id
}

// 取（必要时创建）某一套牌堆的两个数组。返回的对象就是 state 上的那个对象，
// 因此对 deck/discard 的原地修改（push/pop/splice）直接生效；整体替换用 setExtraDeckPiles。
export function extraDeckPiles(state, rawId) {
  const id = extraDeckId(rawId)
  state.extraEncounterDecks ||= {}
  const piles = state.extraEncounterDecks[id] ||= { deck: [], discard: [] }
  if (!Array.isArray(piles.deck)) piles.deck = []
  if (!Array.isArray(piles.discard)) piles.discard = []
  return piles
}

export function setExtraDeckPiles(state, rawId, piles) {
  const id = extraDeckId(rawId)
  state.extraEncounterDecks ||= {}
  state.extraEncounterDecks[id] = { deck: [...(piles.deck || [])], discard: [...(piles.discard || [])] }
  return state.extraEncounterDecks[id]
}

// 建堆：去重后按注入的 shuffle 洗牌。牌堆顺序是隐藏信息。
export function setExtraEncounterDeck(state, rawId, codes, { shuffle = list => [...list] } = {}) {
  if (!Array.isArray(codes)) throw new Error(`建堆需要卡号数组（${rawId}）`)
  const id = extraDeckId(rawId)
  const unique = [...new Set(codes.map(code => String(code)))]
  return setExtraDeckPiles(state, id, { deck: shuffle(unique), discard: [] })
}

// 往牌堆加牌：默认放到牌库底（先抽到的在末尾），top=true 放到牌库顶。
export function addToExtraEncounterDeck(state, rawId, codes, { top = false } = {}) {
  const piles = extraDeckPiles(state, rawId)
  const list = (Array.isArray(codes) ? codes : [codes]).map(code => String(code))
  if (top) piles.deck.push(...list.reverse())
  else piles.deck.unshift(...list)
  return piles
}

// 洗回：把牌放进牌堆并重新洗牌（`shuffle` 必须来自引擎的随机源）。
export function shuffleIntoExtraEncounterDeck(state, rawId, codes, { shuffle = list => [...list] } = {}) {
  const piles = extraDeckPiles(state, rawId)
  const list = (Array.isArray(codes) ? codes : [codes]).map(code => String(code))
  piles.deck = shuffle([...piles.deck, ...list])
  return piles.deck.length
}

// 抽顶：牌堆空了先把弃牌堆洗回来；两堆都空时返回 null（调用方决定是否记日志）。
export function drawFromExtraEncounterDeck(state, rawId, { shuffle = list => [...list] } = {}) {
  const piles = extraDeckPiles(state, rawId)
  if (!piles.deck.length) {
    if (!piles.discard.length) return null
    piles.deck = shuffle([...piles.discard])
    piles.discard = []
  }
  return piles.deck.pop() ?? null
}

// 弃顶：把牌堆顶若干张放进弃牌堆（幽灵界的「弃掉幽灵遭遇牌库顶 N 张」）。
export function discardTopOfExtraEncounterDeck(state, rawId, count = 1) {
  const piles = extraDeckPiles(state, rawId)
  const discarded = []
  for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
    if (!piles.deck.length) break
    const code = piles.deck.pop()
    piles.discard.push(code)
    discarded.push(code)
  }
  return discarded
}

// 弃置指定牌（结算完的遭遇卡进弃牌堆）。
export function discardFromExtraEncounterDeck(state, rawId, codes) {
  const piles = extraDeckPiles(state, rawId)
  const list = (Array.isArray(codes) ? codes : [codes]).map(code => String(code))
  piles.discard.push(...list)
  return piles.discard.length
}

// 公开投影用的读数：只给张数与弃牌堆内容（牌堆顺序永不外泄）。
export function extraEncounterDeckInfo(state, rawId) {
  const id = extraDeckId(rawId)
  const piles = state.extraEncounterDecks?.[id]
  return {
    deck: Array.isArray(piles?.deck) ? piles.deck.length : 0,
    discard: [...(piles?.discard || [])],
  }
}

export function extraEncounterDecksInfo(state) {
  return Object.fromEntries(EXTRA_ENCOUNTER_DECKS.map(id => [id, extraEncounterDeckInfo(state, id)]))
}

// 新关卡开始：清空所有额外牌堆（脚本在 setup 里重建）。
export function resetExtraEncounterDecks(state) {
  state.extraEncounterDecks = {}
  return state.extraEncounterDecks
}

// ---------------------------------------------------------------------------
// 地点牌库（Cosmos / 未知地点）—— 第 2 步 P2.13。
//
// 《黑色王座》的 Cosmos 与《隐秘之名》的未知地点都是**面朝下的地点牌库**：抽 X 张选 1 张
// 放置入场，没被选的放回牌库底；Void/虚空地点可以洗回；放置时把原地点上的调查员与敌人
// 一起搬过去（调用方用 relocate 完成，本模块只管牌库状态）。
//
// 状态：state.extraLocationDecks = { cosmos: { deck: [地点定义 id], discard: [] } }
// 牌库顺序是隐藏信息；公开投影只给张数（地点一旦放置，就是桌上的公开信息）。
// ---------------------------------------------------------------------------
export const EXTRA_LOCATION_DECKS = Object.freeze(['cosmos', 'unknownPlaces'])

export function extraLocationDeckId(raw) {
  const id = String(raw ?? '')
  if (!EXTRA_LOCATION_DECKS.includes(id)) {
    throw new Error(`未知的地点牌库：${JSON.stringify(raw)}（可用：${EXTRA_LOCATION_DECKS.join('、')}）`)
  }
  return id
}

export function extraLocationPiles(state, rawId) {
  const id = extraLocationDeckId(rawId)
  state.extraLocationDecks ||= {}
  const piles = state.extraLocationDecks[id] ||= { deck: [], discard: [] }
  if (!Array.isArray(piles.deck)) piles.deck = []
  if (!Array.isArray(piles.discard)) piles.discard = []
  return piles
}

export function buildScenarioLocationDeck(state, rawId, ids, { shuffle = list => [...list] } = {}) {
  if (!Array.isArray(ids)) throw new Error(`建地点牌库需要地点 id 数组（${rawId}）`)
  const id = extraLocationDeckId(rawId)
  const unique = [...new Set(ids.map(String))]
  const piles = extraLocationPiles(state, id)
  piles.deck = shuffle(unique)
  piles.discard = []
  return piles
}

export function drawScenarioLocationDeck(state, rawId, count = 1, { shuffle = list => [...list] } = {}) {
  const piles = extraLocationPiles(state, rawId)
  const drawn = []
  for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
    if (!piles.deck.length) {
      if (!piles.discard.length) break
      piles.deck = shuffle([...piles.discard])
      piles.discard = []
    }
    drawn.push(piles.deck.pop())
  }
  return drawn
}

// 抽 N 选 1：没被选的放回牌库底（保持抽牌顺序），返回选中的地点 id。
export function chooseScenarioLocationDeck(state, rawId, count, { requestChoice, seat, source = 'cosmos', prompt } = {}) {
  if (typeof requestChoice !== 'function') throw new Error('选择地点需要注入 requestChoice')
  const drawn = drawScenarioLocationDeck(state, rawId, count)
  if (!drawn.length) return null
  if (drawn.length === 1) return drawn[0]
  const piles = extraLocationPiles(state, rawId)
  const chosen = String(requestChoice(state, {
    kind: 'location', source, seat,
    prompt: prompt || `选择一张要放置入场的地点（共 ${drawn.length} 张）。`,
    options: drawn.map(id => ({ id, label: id })),
  }))
  const picked = drawn.includes(chosen) ? chosen : drawn[0]
  const rejected = drawn.filter(id => id !== picked)
  piles.deck.unshift(...rejected)
  return picked
}

export function shuffleScenarioLocationIntoDeck(state, rawId, ids, { shuffle = list => [...list] } = {}) {
  const piles = extraLocationPiles(state, rawId)
  const list = (Array.isArray(ids) ? ids : [ids]).map(String)
  piles.deck = shuffle([...piles.deck, ...list])
  return piles.deck.length
}

export function discardScenarioLocation(state, rawId, ids) {
  const piles = extraLocationPiles(state, rawId)
  const list = (Array.isArray(ids) ? ids : [ids]).map(String)
  piles.discard.push(...list)
  return piles.discard.length
}

export function scenarioLocationDeckInfo(state, rawId) {
  const id = extraLocationDeckId(rawId)
  const piles = state.extraLocationDecks?.[id]
  return {
    deck: Array.isArray(piles?.deck) ? piles.deck.length : 0,
    discard: [...(piles?.discard || [])],
  }
}

export function resetExtraLocationDecks(state) {
  state.extraLocationDecks = {}
  return state.extraLocationDecks
}
