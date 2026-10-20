// 诡镇奇谈：卡牌版 · 区域与牌的去向（缺口 B6，Phase 2）
//
// 此前的症状：`attach` / `beneath` / `setAside` / `removeFromGame` / `bonded` 各自为政，
// 每张"把牌挪到别处"的卡都要在引擎里手写一遍 splice/push，且没人统一回答三件事：
//   1. 这张牌现在在哪（哪个区域、属于谁）；
//   2. 目标区域合不合法（手牌只收卡号、场上的支援是实例、附属必须有宿主）；
//   3. 移动后要不要洗牌、是否明置、是否要触发离场/入场钩子。
//
// 本模块提供区域词表与移动规格的校验（纯函数）；真正的搬动在 engine.js 的 moveCardTo()
// （要用 nextInstanceId、leaveAsset、attachCardTo 这些引擎装配点）。
//
// 目标区域（to）：
//   hand          进手牌（卡号）
//   deckTop       牌库顶        deckBottom  牌库底
//   discard       弃牌堆（卡号）
//   play          放置入场（建一个支援实例）
//   threat        威胁区域（建一个威胁实例）
//   attached      附属到 attachTo 指定的宿主（支援/地点/敌人）
//   beneath       压在某张卡下面（beneath: 'assetId' | 'locationId'）
//   setAside      放到一边
//   removedFromGame 移出游戏
//   victoryDisplay 放入胜利区
//
// 规格：
//   { code | id, to, from?, attachTo?, beneath?, facedown?, ownerSeat?, shuffle? }

export const CARD_DESTINATIONS = Object.freeze([
  'hand', 'deckTop', 'deckBottom', 'discard', 'play', 'threat', 'attached', 'beneath',
  'setAside', 'removedFromGame', 'victoryDisplay',
])

// 允许"从哪拿"的写法；不写 from 时引擎按 code/id 自动定位（手牌 → 牌库 → 弃牌堆 → 场上 → 一边）。
export const CARD_SOURCES = Object.freeze([
  'auto', 'hand', 'deck', 'discard', 'play', 'threat', 'attached', 'beneath',
  'setAside', 'removedFromGame', 'victoryDisplay', 'encounterDeck', 'encounterDiscard',
])

const DESTINATION_ALIASES = Object.freeze({
  deck: 'deckTop', top: 'deckTop', bottom: 'deckBottom', assets: 'play', inPlay: 'play',
  remove: 'removedFromGame', exile: 'removedFromGame', victory: 'victoryDisplay', underneath: 'beneath',
})

const MOVE_KEYS = new Set(['code', 'id', 'to', 'from', 'attachTo', 'beneath', 'facedown', 'ownerSeat', 'shuffle', 'label'])

export function normalizeDestination(raw, origin = 'moveCard') {
  const value = DESTINATION_ALIASES[raw] || raw
  if (!CARD_DESTINATIONS.includes(value)) {
    throw new Error(`${origin}: 未知目标区域 ${JSON.stringify(raw)}（可选：${CARD_DESTINATIONS.join(' / ')}）`)
  }
  return value
}

export function normalizeSource(raw, origin = 'moveCard') {
  if (raw == null) return 'auto'
  if (!CARD_SOURCES.includes(raw)) {
    throw new Error(`${origin}: 未知来源区域 ${JSON.stringify(raw)}（可选：${CARD_SOURCES.join(' / ')}）`)
  }
  return raw
}

export function normalizeCardMove(raw, origin = 'moveCard') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${origin}: 规格必须是对象`)
  for (const key of Object.keys(raw)) {
    if (!MOVE_KEYS.has(key)) throw new Error(`${origin}: 未知字段 ${key}`)
  }
  if (!raw.code && !raw.id) throw new Error(`${origin}: 需要 code 或 id`)
  const to = normalizeDestination(raw.to, origin)
  const from = normalizeSource(raw.from, origin)
  if (to === 'attached' && !raw.attachTo) throw new Error(`${origin}: to:'attached' 必须声明 attachTo`)
  if (to === 'beneath' && !raw.beneath) throw new Error(`${origin}: to:'beneath' 必须声明 beneath`)
  if (to === 'attached' && raw.attachTo === raw.id) throw new Error(`${origin}: 不能把卡附属到它自己`)
  return Object.freeze({
    code: raw.code ? String(raw.code) : null,
    id: raw.id ? String(raw.id) : null,
    to,
    from,
    attachTo: raw.attachTo ? String(raw.attachTo) : null,
    beneath: raw.beneath ? String(raw.beneath) : null,
    facedown: raw.facedown === true,
    ownerSeat: Number.isInteger(raw.ownerSeat) ? raw.ownerSeat : null,
    shuffle: raw.shuffle !== false,
    label: raw.label ? String(raw.label) : null,
  })
}

const DESTINATION_LABELS = Object.freeze({
  hand: '手牌', deckTop: '牌库顶', deckBottom: '牌库底', discard: '弃牌堆', play: '场上',
  threat: '威胁区域', attached: '附属', beneath: '卡牌下方', setAside: '放到一边',
  removedFromGame: '移出游戏', victoryDisplay: '胜利区',
})

export function describeCardMove(spec) {
  const move = spec?.to ? spec : normalizeCardMove(spec)
  const to = DESTINATION_LABELS[move.to] || move.to
  const suffix = move.attachTo ? `（宿主 ${move.attachTo}）` : move.beneath ? `（压在 ${move.beneath} 下）` : ''
  return `移动到${to}${suffix}`
}
