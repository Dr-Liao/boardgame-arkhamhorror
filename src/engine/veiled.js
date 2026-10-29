// 掩藏地点（批次 2 原语 `location.veiled`）。
//
// 规则口径（官方规则书；P4 已按 en 剧本来源逐句核对（关键词手册 §2.3））：
//   1. 掩藏地点**没有未揭示面**：它们以已揭示面入场，并按线索值正常放置线索
//      （《寻觅卡达斯》rules.locations / 《无归之地》rules.locations 同文）；
//   2. 「掩藏」的规则是：位于该地点、且该地点上**没有线索**的调查员，可以作为一个
//      [fast] 能力把它翻面，结算背面的故事卡（rules.veiled）；
//   3. 一旦翻面并读过故事文本，本局剩余时间不能再翻回（除非另有说明）；
//   4. B3《无归之地》的 8 张翻面后要**洗回遭遇牌堆**——「翻面」与「洗回」是两件事，
//      分开表达（shuffleVeiledIntoDeck 只接受已翻面的地点）。
//
// P4 更正：P3 曾把「未揭示限制」写成关键词规则（`veiledBlocksInvestigation`），
// 与官方 `rules.veiled` 冲突；已改为按官方口径的 `canFlipVeiledLocation` /
// `veiledFlipBlockedReason`，见关键词手册 §4。
//
// 状态形状（只写在带 veiled 的地点/剧本声明上）：
//   location.veiled = true            —— 该地点有 Veiled 关键字
//   location.veiledRevealed = true    —— 已翻面（故事文本已读，不能再翻）
// 纯数据：不 import engine；未使用 Veiled 的战役不产生字段。

/** 卡/地点是否带 Veiled（字段或卡文首行关键字）。 */
export function isVeiledLocation(card) {
  if (!card || typeof card !== 'object') return false
  if (card.veiled === true) return true
  if (Array.isArray(card.keywords) && card.keywords.includes('Veiled')) return true
  return /^\s*Veiled\b/i.test(String(card.text || '').replace(/^.*\n/, match => match))
    || /\bVeiled\./.test(String(card.text || ''))
}

/** 地点是否已翻面（故事文本已读）。 */
export function isVeiledRevealed(location) {
  return Boolean(location?.veiledRevealed)
}

/** 翻面时地点上的线索数：优先用调用方给的读数，否则读地点实例的 `clues`。 */
function cluesOf(location, clues) {
  if (Number.isInteger(clues) && clues >= 0) return clues
  const value = location?.clues
  return Number.isInteger(value) && value > 0 ? value : 0
}

/**
 * 翻面被阻止的原因；可以翻面时返回 `null`。
 * 判据（官方 `rules.veiled`）：必须是掩藏地点、尚未翻面、且地点上没有线索。
 */
export function veiledFlipBlockedReason(location, clues = null) {
  if (!isVeiledLocation(location)) return '不是掩藏地点'
  if (isVeiledRevealed(location)) return '已经翻面'
  if (cluesOf(location, clues) > 0) return '地点上还有线索'
  return null
}

/** 是否可以把该掩藏地点翻面（与 `veiledFlipBlockedReason` 同一判据）。 */
export function canFlipVeiledLocation(location, clues = null) {
  return veiledFlipBlockedReason(location, clues) === null
}

/** 剧本里所有 Veiled 地点（观察投影与校验用）。 */
export function veiledLocationsOf(state) {
  return (state?.locations || []).filter(location => location.veiled === true || isVeiledLocation(location))
}

/**
 * 翻面：把地点标记为已翻面，返回背面故事卡卡号（`backCode`/`linkedToCode`/`linkedCardCode`）。
 * 不移动地点、不洗牌——「洗回」用 `shuffleVeiledIntoDeck`。
 * 被规则拒绝时返回 `{ changed: false, storyCode, reason }`，不抛错（[fast] 能力必须能给出不可用原因）。
 */
export function flipVeiledLocation(state, locationId, { clues = null } = {}) {
  const location = (state?.locations || []).find(item => String(item.id) === String(locationId))
  if (!location) throw new Error(`地点不存在：${String(locationId)}`)
  const reason = veiledFlipBlockedReason(location, clues)
  const storyCode = location.backCode || location.linkedToCode || location.linkedCardCode || location.storyCode || null
  if (reason) return { changed: false, storyCode, reason }
  location.veiledRevealed = true
  // 掩藏地点按规则本就以已揭示面入场；这里显式置位只为兼容内容层漏写 revealed 的情况。
  location.revealed = true
  if (storyCode) location.storyCode = storyCode
  return { changed: true, storyCode, reason: null }
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
