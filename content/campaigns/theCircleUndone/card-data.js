// 万象无终（The Circle Undone）的卡面数据入口。
//
// 与失落的时代（TFA）的 `card-data.js` 同一职责：所有剧本的 definition.js 只从这里取
// **印刷数据**（卡名、卡文、属性、帷幕、胜利点……），避免把卡文抄成第二份事实来源。
// P8 各章只写「关卡怎么用这些卡」，不重新录入卡面。
//
// 与 TFA 的差异（TCU 机制带来）：
//   · 幽灵地点：`spectral` / `back` 字段由 P2.3 原语注册期校验；本文件提供 spectralLocation()；
//   · 双面地点：卡片数据的 linkedCardCode 是背面卡号；`backFace()` 统一取背面印刷字段；
//   · Witching Hour 的「未揭示地点」用 `unrevealed` 数据（同一张卡的正/背面名不同，没有独立卡号）；
//   · 剧情资产与塔罗牌组不进遭遇定义，分别由 storyCards() 与 tarot.js 负责。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { enemyRuleFor, treacheryRuleFor } from '../../../src/cards/card-rules.js'

// TCU 商品包（7 个）：tcu 为战役基础包，其余 6 个神话包各含一章。
export const TCU_PACKS = new Set(['tcu', 'wos', 'tsn', 'fgg', 'icc', 'uad', 'bbt'])

// 遭遇组 id：卡包清单与章节 manifest 用 camelCase，目录 encounterCode 用 snake_case。
// TCU 的 21 个组都能由 camelCase 直接转 snake_case；保留显式表以便个别包名例外时覆盖。
export const GROUP_ALIASES = Object.freeze({})

export const camelToSnake = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .toLowerCase()

export function encounterGroupCode(group) {
  return GROUP_ALIASES[group] || camelToSnake(group)
}

// 印刷地点左下角的符号。与 TFA 共用同一套符号字形。
export const SYMBOLS = Object.freeze({
  circle: { id: 'circle', label: '圆形', glyph: '●' },
  square: { id: 'square', label: '方形', glyph: '■' },
  diamond: { id: 'diamond', label: '菱形', glyph: '◆' },
  moon: { id: 'moon', label: '月牙', glyph: '☾' },
  heart: { id: 'heart', label: '心形', glyph: '♥' },
  triangle: { id: 'triangle', label: '三角', glyph: '▲' },
  squiggle: { id: 'squiggle', label: '波浪', glyph: '∿' },
  hourglass: { id: 'hourglass', label: '沙漏', glyph: '⧗' },
  t: { id: 't', label: 'T 字', glyph: '⊥' },
  plus: { id: 'plus', label: '十字', glyph: '✚' },
  equals: { id: 'equals', label: '等号', glyph: '＝' },
  star: { id: 'star', label: '星形', glyph: '★' },
  droplet: { id: 'droplet', label: '水滴', glyph: '◈' },
})

export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`万象无终原卡不存在：${code}`)
  return {
    code,
    originalCode: code,
    name: card.nameZh || card.name,
    text: card.textZh || card.text || '',
    textEn: card.text || '',
    traits: [...(card.traits || [])],
    traitsZh: [...(card.traitsZh || [])],
    subname: card.subnameZh || card.subname || '',
    flavor: card.flavorZh || card.flavor || '',
    ...(card.backTextZh || card.backText ? { backText: card.backTextZh || card.backText } : {}),
  }
}

// 背面印刷字段：优先用显式 backCode 的卡面数据（Wages of Sin 的幽灵面、遗迹背面），
// 否则用卡片数据声明的 linkedCardCode。
export function backFace(code, explicitBackCode = null) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`万象无终原卡不存在：${code}`)
  const backCode = explicitBackCode || card.linkedCardCode || null
  if (!backCode) return null
  const back = ALL_CARDS[backCode]
  if (!back) throw new Error(`万象无终背面卡不存在：${backCode}`)
  return {
    code: backCode,
    name: back.nameZh || back.name,
    subname: back.subnameZh || back.subname || '',
    traits: [...(back.traits || [])],
    ...(back.type === 'location' ? {
      shroud: back.shroud,
      clues: back.clues ?? 0,
      ...(back.cluesFixed ? { cluesFixed: back.clues } : {}),
      victory: back.victory || 0,
    } : {}),
    text: back.textZh || back.text || '',
  }
}

// 普通地点。`extra` 支持：
//   symbol + links → 印刷符号地图（由 linkSymbolLocations 解析成邻接表）；
//   connections → 固定邻接（老式地图，与符号互斥时可并存，linkSymbolLocations 会合并）；
//   back: { code, name, subname, clues } → 双面/幽灵面（P2.3 原语的数据形状）；
//   spectral: true → 单面幽灵地点（只在幽灵界出现，翻面只改标志）；
//   unrevealed: { name, subname, traits, symbol, links } → WitchingHour 的未揭示背面。
export function location(id, code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`万象无终地点不存在：${code}`)
  const { symbol = null, links = [], connections = [], back = null, spectral, unrevealed, ...rest } = extra
  return {
    ...printed(code),
    id,
    type: 'location',
    shroud: card.shroud,
    cluesPerInvestigator: card.clues || 0,
    ...(card.cluesFixed ? { cluesFixed: card.clues } : {}),
    victory: card.victory || 0,
    connections: [...connections],
    // linkSymbolLocations 只认 explicitConnections；手写邻接通过 connections 传入时自动折算，
    // 避免「写了 connections 但被符号连线覆盖」的坑（TFA 的 card-data 是显式写 explicitConnections）。
    ...(connections.length ? { explicitConnections: [...connections] } : {}),
    ...(symbol ? {
      symbols: {
        front: { symbol, links: [...links], label: SYMBOLS[symbol]?.label || symbol },
        back: { symbol: SYMBOLS[symbol]?.id || symbol, links: [...links] },
      },
    } : {}),
    ...(spectral === undefined ? {} : { spectral }),
    ...(back ? { back: { ...back } } : {}),
    ...(unrevealed ? { unrevealed: { ...unrevealed } } : {}),
    ...rest,
  }
}

// 双面/幽灵地点：正面用 frontCode 的印刷数据，幽灵面用 backCode。
// 若 backCode 是独立卡号（Wages of Sin 的 05168/05168b），clues 取背面卡面；否则沿用正面。
export function spectralLocation(id, frontCode, backCode, extra = {}) {
  const face = backFace(frontCode, backCode) || {}
  const entries = Object.values(ALL_CARDS).filter(card => card.linkedCardCode === frontCode)
  return location(id, frontCode, {
    ...extra,
    back: {
      code: face.code || backCode,
      name: face.name || ALL_CARDS[backCode]?.nameZh || '',
      subname: face.subname || '',
      ...(Number.isInteger(face.clues) ? { clues: face.clues } : {}),
    },
    ...(entries.length ? {} : {}),
  })
}

// 解析符号地图：把「符号 → 相连符号」解析成地点 id 邻接表（双向包含任一即可）。
export function linkSymbolLocations(locations) {
  const entries = Object.values(locations).filter(entry => entry.symbols?.front)
  const linked = (from, to) => from.symbols.front.links.includes(to.symbols.front.symbol)
    || to.symbols.front.links.includes(from.symbols.front.symbol)
  for (const entry of Object.values(locations)) {
    const explicit = entry.explicitConnections || []
    if (!entry.symbols?.front) {
      entry.connections = [...explicit]
      continue
    }
    entry.connections = [...new Set([
      ...explicit,
      ...entries.filter(other => other.id !== entry.id && linked(entry, other)).map(other => other.id),
    ])]
  }
  return locations
}

// 运行时同一条规则：进入游戏的地点按已印刷符号重新连线。
export function symbolConnections(locations) {
  const placed = locations.filter(entry => entry?.symbols?.front)
  const result = {}
  for (const entry of locations) {
    const from = entry?.symbols?.front
    result[entry.id] = from
      ? placed.filter(other => other.id !== entry.id && (
        from.links.includes(other.symbols.front.symbol)
        || other.symbols.front.links.includes(from.symbol)))
        .map(other => other.id)
      : [...(entry.connections || [])]
  }
  return result
}

export function syncSymbolConnections(state) {
  const wanted = symbolConnections(state.locations)
  for (const entry of state.locations) {
    const existing = new Set(entry.connections || [])
    for (const id of wanted[entry.id] || []) existing.add(id)
    entry.connections = [...existing]
  }
  return wanted
}

// 幕/议程：印刷卡号顺序即阶段顺序。doomThreshold 取议程的 doom 字段。
export function stages(codes, type) {
  return codes.map((code, index) => {
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`万象无终${type === 'act' ? '幕' : '议程'}不存在：${code}`)
    const label = type === 'act' ? 'act' : 'agenda'
    return {
      ...printed(code),
      type: label,
      id: `${label}${index + 1}`,
      stage: `${index + 1}a`,
      ...(type === 'agenda' ? { doomThreshold: card.doom || 0 } : {}),
      ...(type === 'agenda' && card.doomPerInvestigator ? { doomThresholdPerInvestigator: card.doom } : {}),
      backText: card.backTextZh || card.backText || '',
      advanceText: card.backTextZh || card.backText || '',
    }
  })
}

export function cardsInGroups(groups) {
  const normalized = groups.map(encounterGroupCode)
  const missing = normalized.filter(group => !Object.values(ALL_CARDS).some(card =>
    card.encounterCode === group && ['enemy', 'treachery', 'act', 'agenda', 'location', 'asset', 'story'].includes(card.type)))
  if (missing.length) throw new Error(`缺少万象无终遭遇组：${missing.join(', ')}`)
  return Object.values(ALL_CARDS).filter(card =>
    normalized.includes(card.encounterCode) && ['enemy', 'treachery'].includes(card.type))
}

// 遭遇牌库张数：按印刷 quantity 展开。`groups` 用 camelCase 或 snake_case 均可。
export function encounterCards(groups) {
  return cardsInGroups(groups)
}

// 印刷关键词识别。TCU 的「闹鬼 - …」是地点上的能力而非关键词行；
// 敌人关键词（Hunter/Aloof/Massive/Retaliate/Alert）仍按独立成句识别。
function printedKeywordText(text = '') {
  return String(text)
    .replace(/<b>|<\/b>/gi, '')
    .split(/(?<=\.)\s+|\n+/)
    .filter(sentence => !/\bgains?\b/i.test(sentence))
    .join('\n')
}

function hasKeyword(text, keyword) {
  return new RegExp(`(?:^|[^A-Za-z])${keyword}(?:[.\\s]|$)`, 'i').test(printedKeywordText(text))
}

function printedSurge(text = '') {
  return /\bSurge\./i.test(printedKeywordText(text))
}

function printedPrey(text = '') {
  const match = /Prey\s*-\s*([^\n.]+)/i.exec(text)
  return match ? match[1].trim() : null
}

// 遭遇卡定义：印刷数值 + 已实现的单卡规则（enemyRuleFor/treacheryRuleFor）。
// `rulesPending: false` 表示「卡面已逐张落到单卡条目或共享解析器」，由审计核对；
// 真正未实现的卡不要写进 definition 的 enemies/treacheries。
export function encounterDefinitions(cards, extraRules = {}) {
  const enemies = {}
  const treacheries = {}
  for (const card of cards) {
    if (!['enemy', 'treachery'].includes(card.type)) continue
    const text = card.text || ''
    const definition = {
      ...printed(card.code),
      rulesPending: false,
      ...(card.type === 'enemy' ? {
        type: 'enemy',
        fight: card.fight ?? 0,
        evade: card.evade ?? 0,
        health: card.health ?? 1,
        damage: card.damage ?? 0,
        horror: card.horror ?? 0,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: card.health } : {}),
        hunter: hasKeyword(text, 'Hunter'),
        aloof: hasKeyword(text, 'Aloof'),
        massive: hasKeyword(text, 'Massive'),
        retaliate: hasKeyword(text, 'Retaliate'),
        alert: hasKeyword(text, 'Alert'),
        victory: card.victory || 0,
        elite: (card.traits || []).includes('Elite'),
        ...(printedPrey(text) ? { prey: printedPrey(text) } : {}),
        ...(extraRules.enemies?.[card.code] || {}),
        ...(enemyRuleFor(card.code) || {}),
      } : {
        type: 'treachery',
        surge: printedSurge(text) || hasKeyword(text, 'Surge'),
        peril: hasKeyword(text, 'Peril'),
        hidden: hasKeyword(text, 'Hidden'),
        effect: { kind: 'campaignRule' },
        ...(extraRules.treacheries?.[card.code] || {}),
        ...(treacheryRuleFor(card.code) || {}),
      }),
    }
    ;(card.type === 'enemy' ? enemies : treacheries)[definition.code] = definition
  }
  return { enemies, treacheries }
}

export function encounterDeck(cards) {
  return cards.flatMap(card => Array(card.quantity || 1).fill(card.code))
}

export function storyCards(codes) {
  return Object.fromEntries(codes.map(code => [code, {
    ...printed(code),
    type: 'asset',
    isStoryAsset: true,
  }]))
}

export function identitiesFor(scenario) {
  const categories = { scenario: { [scenario.id]: { originalCode: scenario.originalCode } } }
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    const definitions = scenario[category] || {}
    const entries = Array.isArray(definitions) ? definitions : Object.values(definitions)
    categories[category] = Object.fromEntries(entries.map(card => [card.id || card.code, {
      originalCode: card.originalCode || card.code,
      ...(ALL_CARDS[card.originalCode || card.code]?.linkedCardCode
        ? { linkedOriginalCode: ALL_CARDS[card.originalCode || card.code].linkedCardCode }
        : {}),
    }]))
  }
  return categories
}

export function tcuCards() {
  return Object.values(ALL_CARDS).filter(card => TCU_PACKS.has(card.pack))
}
