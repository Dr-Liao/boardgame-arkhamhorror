// 掩藏地点（批次 2 原语 `location.veiled`）。
//
// 规则口径（P2 机制扫描：23 个地点）：
//   1. Veiled 地点在**揭示前不能被调查/进入**（B3 的「漆黑之海」例外：翻面后才可进）；
//   2. 翻面会翻开背面故事卡（A2 的 15 张 b 面）；
//   3. B3 的 8 张翻面后要**洗回遭遇牌堆**（与「翻面」是两个动作，分开表达）。
//
// 状态形状（只写在带 veiled 的地点/剧本声明上）：
//   location.veiled = true            —— 该地点有 Veiled 关键字
//   location.veiledRevealed = true    —— 已翻面（不再限制调查）
// 纯数据：不 import engine；未使用 Veiled 的战役不产生字段。

/** 卡/地点是否带 Veiled（字段或卡文首行关键字）。 */
export function isVeiledLocation(card) {
  if (!card || typeof card !== 'object') return false
  if (card.veiled === true) return true
  if (Array.isArray(card.keywords) && card.keywords.includes('Veiled')) return true
  return /^\s*Veiled\b/i.test(String(card.text || '').replace(/^.*\n/, match => match))
    || /\bVeiled\./.test(String(card.text || ''))
}

/** 未翻面的 Veiled 地点禁止调查（已揭示但未翻面的地点仍可调查——A2 的规则是「翻面前不可调查」）。 */
export function veiledBlocksInvestigation(location) {
  return isVeiledLocation(location) && location.revealed !== true && location.veiledRevealed !== true
}

/** 地点是否已翻面。 */
export function isVeiledRevealed(location) {
  return Boolean(location?.veiledRevealed)
}

/** 剧本里所有 Veiled 地点（观察投影与校验用）。 */
export function veiledLocationsOf(state) {
  return (state?.locations || []).filter(location => location.veiled === true || isVeiledLocation(location))
}

/**
 * 翻面：把地点标记为已翻面，返回背面故事卡卡号（`backCode`/`linkedToCode`/`linkedCardCode`）。
 * 不移动地点、不洗牌——「洗回」用 `shuffleVeiledIntoDeck`。
 */
export function revealVeiledLocation(state, locationId) {
  const location = (state?.locations || []).find(item => String(item.id) === String(locationId))
  if (!location) throw new Error(`地点不存在：${String(locationId)}`)
  if (!isVeiledLocation(location)) return { changed: false, storyCode: null }
  if (location.veiledRevealed) return { changed: false, storyCode: location.storyCode || null }
  location.veiledRevealed = true
  location.revealed = true
  const storyCode = location.backCode || location.linkedToCode || location.linkedCardCode || null
  if (storyCode) location.storyCode = storyCode
  return { changed: true, storyCode }
}

const DECK_KEYS = Object.freeze({
  encounter: state => { state.encounterDeck ||= []; return state.encounterDeck },
  encounterDiscard: state => { state.encounterDiscard ||= []; return state.encounterDiscard },
  exploration: state => { state.explorationDeck ||= []; return state.explorationDeck },
})

/**
 * 把已翻面的 Veiled 地点洗回指定牌堆（默认遭遇牌堆），地点本体移出 `state.locations`。
 * 返回 `{ moved, code, deck }`；未翻面时拒绝（先翻面再洗回）。
 */
export function shuffleVeiledIntoDeck(state, locationId, deckKey = 'encounter') {
  const pick = DECK_KEYS[deckKey]
  if (!pick) throw new Error(`未知牌堆：${String(deckKey)}`)
  const index = (state?.locations || []).findIndex(item => String(item.id) === String(locationId))
  if (index < 0) throw new Error(`地点不存在：${String(locationId)}`)
  const location = state.locations[index]
  if (!location.veiledRevealed) throw new Error(`地点未翻面，不能洗回：${String(locationId)}`)
  const code = location.originalCode || location.code
  const deck = pick(state)
  deck.push(code)
  state.locations.splice(index, 1)
  return { moved: true, code, deck: deckKey }
}

/**
 * 注册期校验：剧本声明的 Veiled 地点必须带背面故事卡或明确标 `shuffleBack`。
 * 返回 `{ total, withStory, shuffleBack, missing }`；missing 非空时由内容注册期拒绝。
 */
export function normalizeVeiledScenario(scenario) {
  const locations = (scenario?.locations || []).filter(location => isVeiledLocation(location))
  const missing = []
  for (const location of locations) {
    const hasStory = Boolean(location.backCode || location.linkedToCode || location.linkedCardCode || location.storyCode)
    const shuffleBack = location.shuffleBack === true
    if (!hasStory && !shuffleBack) missing.push(location.code || location.id || '(unknown)')
  }
  return {
    total: locations.length,
    withStory: locations.filter(location => location.backCode || location.linkedToCode || location.linkedCardCode).length,
    shuffleBack: locations.filter(location => location.shuffleBack === true).length,
    missing,
  }
}
