// 诡镇奇谈：卡牌版 · 看牌与检索（缺口 B5，Phase 2）
//
// 此前的症状：只有 `searchTop`（牌库顶 N 张里挑 1 张进手牌）。
// 「看顶 3 张、任意排列、放回顶/底/洗回」「看弃牌堆顶 N 张」「搜索整副牌库」都写不了，
// 于是每一张这样的卡都要在引擎里加一个战役原语或卡号分支。
//
// 本模块只负责**选项的形状与校验**（纯函数，可在注册期与单测里跑）；
// 真正的读牌库/询问/写回在 engine.js 的 lookAt() / searchDeck()，
// 因为它们必须走引擎的 requestChoice 与随机源（可重放）。
//
// 选项：
// {
//   zone: 'deck' | 'discard' | 'encounterDeck' | 'explorationDeck' | 'investigatorDeck',
//   count: 3,                       // 看几张（缺省 3）
//   arrange: true,                  // 看完可以任意排列
//   returnStrategy: 'shuffle' | 'top' | 'bottom' | 'discard' | 'keep',
//   choose: 1,                      // 可以拿走几张（检索语义；缺省 0 = 只看）
//   filter: { trait, type, usesType },
//   prompt: '文案',
//   shuffleAfter: true,             // 等价于 returnStrategy: 'shuffle'
//   source: '<卡号>',                // 日志归属
// }
//
// 「看」与「检索」的区别只在于 `choose`：choose=0 不改变牌去向（只排列/放回），
// choose>0 会把选中的牌放进手牌，其余按 returnStrategy 处理。

export const LOOK_ZONES = Object.freeze(['deck', 'discard', 'encounterDeck', 'explorationDeck', 'investigatorDeck'])

export const RETURN_STRATEGIES = Object.freeze(['shuffle', 'top', 'bottom', 'discard', 'keep'])

const LOOK_KEYS = new Set(['zone', 'count', 'arrange', 'returnStrategy', 'choose', 'filter', 'prompt',
  'shuffleAfter', 'source', 'targetSeat', 'label'])

const SEARCH_KEYS = new Set(['trait', 'type', 'usesType', 'count', 'choose', 'shuffle', 'prompt', 'source',
  'targetSeat', 'label', 'optional', 'unlimited'])

function assertKeys(raw, allowed, origin) {
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) throw new Error(`${origin}: 未知选项 ${key}`)
  }
}

// 默认值集中在这里：内容层少写一个字段不应该改变"看几张、放回哪"的语义。
export function normalizeLookOptions(raw = {}, origin = 'lookAt') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${origin}: 选项必须是对象`)
  assertKeys(raw, LOOK_KEYS, origin)
  const zone = raw.zone || 'deck'
  if (!LOOK_ZONES.includes(zone)) throw new Error(`${origin}: 未知区域 ${JSON.stringify(zone)}（可选：${LOOK_ZONES.join(' / ')}）`)
  const count = raw.count ?? 3
  if (!Number.isInteger(count) || count < 1) throw new Error(`${origin}: count 必须是正整数`)
  // 默认洗回；`shuffleAfter: false` 表示「放回原顺序」，是 top/keep 的简写。
  const returnStrategy = raw.returnStrategy || (raw.shuffleAfter === false ? 'top' : 'shuffle')
  if (!RETURN_STRATEGIES.includes(returnStrategy)) {    throw new Error(`${origin}: 未知 returnStrategy ${JSON.stringify(returnStrategy)}（可选：${RETURN_STRATEGIES.join(' / ')}）`)
  }
  const choose = raw.choose ?? 0
  if (!Number.isInteger(choose) || choose < 0) throw new Error(`${origin}: choose 必须是非负整数`)
  if (raw.filter != null && (typeof raw.filter !== 'object' || Array.isArray(raw.filter))) {
    throw new Error(`${origin}: filter 必须是对象`)
  }
  return Object.freeze({
    zone,
    count,
    arrange: raw.arrange === true,
    returnStrategy,
    choose,
    filter: raw.filter ? Object.freeze({ ...raw.filter }) : null,
    prompt: raw.prompt ? String(raw.prompt) : null,
    source: raw.source || null,
    targetSeat: Number.isInteger(raw.targetSeat) ? raw.targetSeat : null,
    label: raw.label ? String(raw.label) : null,
  })
}

export function normalizeSearchOptions(raw = {}, origin = 'searchDeck') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${origin}: 选项必须是对象`)
  assertKeys(raw, SEARCH_KEYS, origin)
  if (!raw.trait && !raw.type && !raw.usesType) throw new Error(`${origin}: 至少声明 trait / type / usesType 之一`)
  const count = raw.count ?? 1
  if (!Number.isInteger(count) || count < 1) throw new Error(`${origin}: count 必须是正整数`)
  const choose = raw.choose ?? 1
  if (!Number.isInteger(choose) || choose < 1) throw new Error(`${origin}: choose 必须是正整数`)
  return Object.freeze({
    trait: raw.trait ? String(raw.trait) : null,
    type: raw.type ? String(raw.type) : null,
    usesType: raw.usesType ? String(raw.usesType) : null,
    count,
    choose,
    shuffle: raw.shuffle !== false,
    optional: raw.optional === true,
    unlimited: raw.unlimited === true,
    prompt: raw.prompt ? String(raw.prompt) : null,
    source: raw.source || null,
    targetSeat: Number.isInteger(raw.targetSeat) ? raw.targetSeat : null,
    label: raw.label ? String(raw.label) : null,
  })
}

const ZONE_LABELS = Object.freeze({
  deck: '牌库顶', discard: '弃牌堆', encounterDeck: '遭遇牌库', explorationDeck: '探索牌库', investigatorDeck: '牌库',
})

const RETURN_LABELS = Object.freeze({
  shuffle: '洗回牌库', top: '放回牌库顶', bottom: '放到牌库底', discard: '放入弃牌堆', keep: '保持原样',
})

export function describeLook(options) {
  const opt = options?.zone ? options : normalizeLookOptions(options)
  const where = ZONE_LABELS[opt.zone] || opt.zone
  const parts = [`查看${where} ${opt.count} 张`]
  if (opt.choose > 0) parts.push(`拿取 ${opt.choose} 张`)
  if (opt.arrange) parts.push('可任意排列')
  parts.push(RETURN_LABELS[opt.returnStrategy] || opt.returnStrategy)
  return parts.join('，')
}

export function describeSearch(options) {
  const opt = options?.choose ? options : normalizeSearchOptions(options)
  const wanted = [opt.trait, opt.type, opt.usesType].filter(Boolean).join('/')
  return `检索牌库中的${wanted}牌（取 ${opt.choose} 张${opt.shuffle ? '，洗回' : ''}）`
}
