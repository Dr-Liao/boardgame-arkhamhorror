// 食梦者（The Dream Eaters）的卡面数据入口。
//
// 与万象无终（TCU）的 `card-data.js` 同一职责：所有剧本的 definition.js 只从这里取
// **印刷数据**（卡名、卡文、属性、帷幕、胜利点、双面/掩藏/蜂拥字段……），避免把卡文抄成第二份事实来源；
// P8 各章只写「关卡怎么用这些卡」，不重新录入卡面。
//
// 本循环在 TCU 形状之上的差异（均由 P2/P3 机制与 P4 关键词带来）：
//   · 掩藏地点（Veiled）：正面地点 + `linkedCardCode` 指向背面故事卡；翻面读故事卡（`veiled`/`storyCode`），
//     B3《无归之地》另有「翻面后洗回遭遇牌库」的 `shuffleBack` 口径（见 src/engine/veiled.js）；
//   · 双面敌人/地点：`linkedCardCode` 是背面卡号（06057/06058 纳什特/卡曼塔、06169a/b、06214b…），
//     `backFace()` 统一取背面印刷字段；
//   · 蜂拥敌人（Swarming X）：X 有四口径（固定 / per_investigator / 警报等级 / 参考卡伤害），
//     用 `swarmingSpec(text)` 解析成数据，运行时由 `api.swarming` 求值（不在内容层写分支）；
//   · 隐藏（Hidden）敌人/诡计：`hidden` 标记由印刷卡文识别；「在手牌中的敌人」是单卡条目字段
//     `hiddenEnemyInHand`（引擎读点），不在 definition 里；
//   · 地点上毁灭（大网）：卡面 doom 打印值由 `location()` 透传，运行时读 `location.doom`；
//   · 剧情卡：TDE 的 33 张 `type: 'story'` 记录都是背面故事卡（卡池 `hidden: true`），
//     用 `storyFace()` / `storyCards()` 取，不进遭遇牌库。
//
// 事实源：`src/cards/cards-data.js`（06 号段唯一印刷事实源）。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { enemyRuleFor, hiddenRuleFor, treacheryRuleFor } from '../../../src/cards/card-rules.js'
import { swarmingSpec } from '../../../src/engine/swarming.js'

// 食梦者商品包（7 个）：tde 为战役基础包，其余 6 个神话包各含一章（sfk 含 A2 等）。
export const TDE_PACKS = new Set(['tde', 'sfk', 'tsh', 'dsm', 'pnr', 'wgd', 'woc'])

// 遭遇组 id：卡包清单/章节 manifest 用 camelCase，目录 encounterCode 用 snake_case。
// TDE 的 20 个组都能由 camelCase 直接转 snake_case；保留显式表以便例外时覆盖。
export const GROUP_ALIASES = Object.freeze({})

export const camelToSnake = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .toLowerCase()

export function encounterGroupCode(group) {
  return GROUP_ALIASES[group] || camelToSnake(group)
}

// 印刷地点左下角的符号。与 TFA/TCU 共用同一套符号字形。
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

// 卡面隐藏关键字识别（印刷文本解析）。`printedKeywordText` 只保留「关键字段」，
// 避免卡面正文里提到 Hunter/Alert 等词被误判（TCU 的同一口径）。
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

function printedNumber(text, keyword) {
  const match = new RegExp(`${keyword}\\s+(\\d+)`, 'i').exec(String(text || ''))
  return match ? Number(match[1]) : null
}

function printedPrey(text = '') {
  const match = /Prey\s*-\s*([^\n.]+)/i.exec(text)
  return match ? match[1].trim() : null
}

export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`食梦者原卡不存在：${code}`)
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
    ...(card.hidden ? { hiddenFace: true } : {}),
    ...(card.backTextZh || card.backText ? { backText: card.backTextZh || card.backText } : {}),
  }
}

// 背面印刷字段：优先显式 backCode，否则用卡片数据声明的 linkedCardCode。
export function backFace(code, explicitBackCode = null) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`食梦者原卡不存在：${code}`)
  const backCode = explicitBackCode || card.linkedCardCode || null
  if (!backCode) return null
  const back = ALL_CARDS[backCode]
  if (!back) throw new Error(`食梦者背面卡不存在：${backCode}`)
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
    textEn: back.text || '',
  }
}

// 印刷地点是否存在「背面故事卡」：TDE 的 33 张剧情背面卡都是 linkedCardCode 指向的 `hidden:true` 卡。
function linkedFace(code, card = ALL_CARDS[code]) {
  return card?.linkedCardCode ? ALL_CARDS[card.linkedCardCode] : null
}

// 地点是否是掩藏地点：印刷卡文首段/出现 `Veiled.`。
export function isVeiledCard(code) {
  const card = ALL_CARDS[code]
  if (!card) return false
  return /(?:^|\n)\s*Veiled\b/i.test(String(card.text || '')) || /\bVeiled\./.test(String(card.text || ''))
}

// 普通地点。`extra` 支持：
//   symbol + links → 印刷符号地图（由 linkSymbolLocations 解析成邻接表）；
//   connections → 固定邻接（与符号并存时 linkSymbolLocations 会合并）；
//   back: { code, name, subname, clues } → 双面/幽灵面（引擎 data 形状）；
//   veiled: true → 掩藏地点（P3 原语 `location.veiled`），自动补 backCode/storyCode；
//   shuffleBack: true → B3「翻面后洗回遭遇牌库」；
//   investigateSkill → 直接透传（卡面指定调查技能）。
export function location(id, code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`食梦者地点不存在：${code}`)
  const { symbol = null, links = [], connections = [], back = null, veiled, shuffleBack, ...rest } = extra
  const linked = linkedFace(code, card)
  const autoVeiled = veiled === undefined ? isVeiledCard(code) : veiled === true
  const backCode = rest.backCode || (autoVeiled || shuffleBack ? card.linkedCardCode || null : null)
  return {
    ...printed(code),
    id,
    type: 'location',
    shroud: card.shroud,
    cluesPerInvestigator: card.clues || 0,
    ...(card.cluesFixed ? { cluesFixed: card.clues } : {}),
    victory: card.victory || 0,
    ...(Number.isInteger(card.doom) && card.doom > 0 ? { doom: card.doom } : {}),
    connections: [...connections],
    ...(connections.length ? { explicitConnections: [...connections] } : {}),
    ...(symbol ? {
      symbols: {
        front: { symbol, links: [...links], label: SYMBOLS[symbol]?.label || symbol },
        back: { symbol: SYMBOLS[symbol]?.id || symbol, links: [...links] },
      },
    } : {}),
    ...(autoVeiled ? {
      veiled: true,
      ...(backCode ? { backCode, storyCode: backCode } : {}),
      ...(linked ? { storyText: linked.textZh || linked.text || '' } : {}),
    } : {}),
    ...(shuffleBack ? { shuffleBack: true } : {}),
    ...(back ? { back: { ...back } } : {}),
    ...rest,
  }
}

// 掩藏地点：显式声明翻面故事卡（B2/B3 大量使用）。不写 backCode 时取卡片数据的 linkedCardCode。
export function veiledLocation(id, code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`食梦者掩藏地点不存在：${code}`)
  if (!isVeiledCard(code) && extra.veiled !== true) {
    throw new Error(`${code} 印刷卡文不是 Veiled 地点（需要显式 veiled: true 才允许）`)
  }
  const backCode = extra.backCode || card.linkedCardCode || null
  return location(id, code, {
    ...extra,
    veiled: true,
    ...(backCode ? { backCode } : {}),
  })
}

// 双面地点（正面地点 / 背面地点，卡池 linkedCardCode 指向背面卡号）：
// 用 `back` 数据形状，翻面由 `api.flipSpectral` 或章节 behavior 处理。
export function doubleSidedLocation(id, frontCode, backCode, extra = {}) {
  const face = backFace(frontCode, backCode)
  if (!face) throw new Error(`食梦者双面地点 ${frontCode} 缺少背面 ${backCode}`)
  return location(id, frontCode, {
    ...extra,
    back: {
      code: face.code,
      name: face.name,
      subname: face.subname,
      ...(Number.isInteger(face.clues) ? { clues: face.clues } : {}),
    },
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
        || other.symbols.front.links.includes(from.symbols.front.symbol)))
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

// 幕/议程：印刷卡号顺序即阶段顺序。doomThreshold 取议程的 doom 字段；
// 逐调查员毁灭阈值由条目的 `doomPerInvestigator` 声明（definition 只保留印刷数值）。
export function stages(codes, type) {
  return codes.map((code, index) => {
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`食梦者${type === 'act' ? '幕' : '议程'}不存在：${code}`)
    const label = type === 'act' ? 'act' : 'agenda'
    return {
      ...printed(code),
      type: label,
      id: `${label}${index + 1}`,
      stage: `${index + 1}a`,
      ...(type === 'agenda' ? { doomThreshold: card.doom || 0 } : {}),
      backText: card.backTextZh || card.backText || '',
      advanceText: card.backTextZh || card.backText || '',
    }
  })
}

export function cardsInGroups(groups) {
  const normalized = groups.map(encounterGroupCode)
  const missing = normalized.filter(group => !Object.values(ALL_CARDS).some(card =>
    card.encounterCode === group && ['enemy', 'treachery', 'act', 'agenda', 'location', 'asset', 'story'].includes(card.type)))
  if (missing.length) throw new Error(`缺少食梦者遭遇组：${missing.join(', ')}`)
  return Object.values(ALL_CARDS).filter(card =>
    normalized.includes(card.encounterCode) && ['enemy', 'treachery'].includes(card.type))
}

// 遭遇牌库卡（敌人/诡计）：`groups` 用 camelCase 或 snake_case 均可。按印刷 quantity 展开见 encounterDeck。
export function encounterCards(groups) {
  return cardsInGroups(groups)
}

// 遭遇卡定义：印刷数值 + 已实现的单卡规则（enemyRuleFor/treacheryRuleFor）。
// TDE 追加字段：
//   · `swarming`：Swarming X 的解析结果（纯数据；运行时 api.swarming 求值）；
//   · `alert`：Alert N 的印刷数值；
//   · `hidden`：Hidden 关键词（敌人/诡计）。
export function encounterDefinitions(cards, extraRules = {}) {
  const enemies = {}
  const treacheries = {}
  for (const card of cards) {
    if (!['enemy', 'treachery'].includes(card.type)) continue
    const text = card.text || ''
    const swarming = swarmingSpec(text)
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
        ...(card.healthPerInvestigator ? { healthPerInvestigator: true } : {}),
        hunter: hasKeyword(text, 'Hunter'),
        aloof: hasKeyword(text, 'Aloof'),
        massive: hasKeyword(text, 'Massive'),
        retaliate: hasKeyword(text, 'Retaliate'),
        alert: printedNumber(text, 'Alert') ?? (hasKeyword(text, 'Alert') ? 1 : false),
        victory: card.victory || 0,
        elite: (card.traits || []).includes('Elite'),
        ...(swarming ? { swarming } : {}),
        ...(printedPrey(text) ? { prey: printedPrey(text) } : {}),
        ...(extraRules.enemies?.[card.code] || {}),
        ...(enemyRuleFor(card.code) || {}),
        ...(hiddenRuleFor(card.code) ? { hiddenRule: hiddenRuleFor(card.code) } : {}),
      } : {
        type: 'treachery',
        surge: /\bSurge\b/i.test(printedKeywordText(text)) || hasKeyword(text, 'Surge'),
        peril: hasKeyword(text, 'Peril'),
        hidden: hasKeyword(text, 'Hidden'),
        effect: { kind: 'campaignRule' },
        ...(extraRules.treacheries?.[card.code] || {}),
        ...(treacheryRuleFor(card.code) || {}),
        // P8：隐藏遭遇牌（Hidden）的限制数据从条目并入 definition（引擎读 state.scenario.treacheries[code].hiddenRule）。
        ...(hiddenRuleFor(card.code) ? { hiddenRule: hiddenRuleFor(card.code) } : {}),
      }),
    }
    ;(card.type === 'enemy' ? enemies : treacheries)[definition.code] = definition
  }
  return { enemies, treacheries }
}

export function encounterDeck(cards) {
  return cards.flatMap(card => Array(card.quantity || 1).fill(card.code))
}

// 背面故事卡（TDE：33 张 `type: 'story'`，卡池 `hidden: true`）。
export function storyFace(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`食梦者剧情卡不存在：${code}`)
  if (card.type !== 'story') throw new Error(`${code} 不是剧情卡（type=${card.type}）`)
  return { ...printed(code), type: 'story', isStoryCard: true }
}

// 剧情支援（战役卡池里的 `type: 'asset'`，如 06064 蛛群滋生袋、06307 银钥匙）：不进遭遇牌库。
export function storyCards(codes) {
  return Object.fromEntries(codes.map(code => {
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`食梦者剧情卡不存在：${code}`)
    return [code, {
      ...printed(code),
      type: 'asset',
      isStoryAsset: true,
    }]
  }))
}

// 掩藏地点的背面故事卡映射：给章节 definition 的 `storyFaces` 用（翻面时展示）。
export function veiledStoryFaces(locations) {
  const entries = {}
  for (const entry of Object.values(locations)) {
    const code = entry.backCode || entry.storyCode
    if (!entry.veiled || !code) continue
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`掩藏地点 ${entry.id} 的背面故事卡不存在：${code}`)
    entries[code] = storyFace(code)
  }
  return entries
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
  // 掩藏地点的背面故事卡身份：definition 若把 `storyFaces` 也登记进来，按 storyAssets 口径映射。
  const storyFaces = scenario.storyFaces || {}
  if (Object.keys(storyFaces).length) {
    categories.storyFaces = Object.fromEntries(Object.values(storyFaces).map(card => [card.code, {
      originalCode: card.code,
    }]))
  }
  return categories
}

export function tdeCards() {
  return Object.values(ALL_CARDS).filter(card => TDE_PACKS.has(card.pack))
}
