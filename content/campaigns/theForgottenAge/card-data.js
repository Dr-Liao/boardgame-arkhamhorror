import { ALL_CARDS } from '../../../src/cards/cards-data.js'

// 失落的时代（三循环）的卡面数据入口。所有剧本的 definition.js 只从这里取印刷
// 数据，避免把卡文抄成第二份事实来源。目录 encounterCode 用 snake_case，
// 卡包清单里的 encounterGroupIds 用 camelCase，两者只在 requiredEncounterGroupIds
// 层面各自成立，这里保留转换表。
const TFA_PACKS = new Set(['tfa', 'tof', 'tbb', 'hote', 'tcoa', 'tdoy', 'sha'])

export const GROUP_ALIASES = Object.freeze({
  theUntamedWilds: 'wilds',
  theDoomOfEztli: 'eztli',
  threadsOfFate: 'threads_of_fate',
  theBoundaryBeyond: 'the_boundary_beyond',
  heartOfTheElders: 'heart_of_the_elders',
  sharedHeartOfTheElders: 'heart_of_the_elders',
  theCityOfArchives: 'the_city_of_archives',
  theDepthsOfYoth: 'the_depths_of_yoth',
  shatteredAeons: 'shattered_aeons',
  turnBackTime: 'turn_back_time',
  pillarsOfJudgment: 'pillars_of_judgment',
  agentsOfYig: 'agents_of_yig',
  guardiansOfTime: 'guardians_of_time',
  pnakoticBrotherhood: 'pnakotic_brotherhood',
  ancientEvils: 'ancient_evils',
  chillingCold: 'chilling_cold',
  strikingFear: 'striking_fear',
  lockedDoors: 'locked_doors',
})

// 印刷地点左下角的符号。Haskell 的 location 定义给出「本地点符号 → 相连符号」，
// 连接关系由符号互相包含推导，不写死成邻接表。
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
  droplet: { id: 'droplet', label: '水滴', glyph: '◆' },
})

export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`失落的时代原卡不存在：${code}`)
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
  }
}

// extra.connections 用于固定邻接的老式地图；extra.symbol/links 用于符号地图。
export function location(id, code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`失落的时代地点不存在：${code}`)
  const { symbol = null, links = [], connections = [], ...rest } = extra
  return {
    ...printed(code),
    id,
    type: 'location',
    shroud: card.shroud,
    cluesPerInvestigator: card.clues || 0,
    ...(card.cluesFixed ? { cluesFixed: card.clues } : {}),
    victory: card.victory || 0,
    connections: [...connections],
    ...(symbol ? {
      symbols: {
        front: { symbol, links: [...links], label: SYMBOLS[symbol]?.label || symbol },
        back: { symbol: SYMBOLS[symbol]?.id || symbol, links: [...links] },
      },
    } : {}),
    ...rest,
  }
}

// 符号地图：把「符号 → 相连符号」解析成地点 id 邻接表（双向包含任一即可）。
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

export function stages(codes, type) {
  return codes.map((code, index) => {
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`失落的时代${type === 'act' ? '幕' : '议程'}不存在：${code}`)
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

export function encounterGroupCode(group) {
  return GROUP_ALIASES[group] || group
}

export function cardsInGroups(groups) {
  const normalized = groups.map(encounterGroupCode)
  const missing = normalized.filter(group => !Object.values(ALL_CARDS).some(card =>
    card.encounterCode === group && ['enemy', 'treachery'].includes(card.type)))
  if (missing.length) throw new Error(`缺少失落的时代遭遇组：${missing.join(', ')}`)
  return Object.values(ALL_CARDS).filter(card =>
    normalized.includes(card.encounterCode) && ['enemy', 'treachery'].includes(card.type))
}

export function encounterCards(groups) {
  return cardsInGroups(groups)
}

// 需要逐卡改写的敌人/诡计结构规则。胜利点与复仇点数以
// Enemy/CardDefs/TheForgottenAge/*.hs 的 cdVictoryPoints / cdVengeancePoints 为准，
// 目录里已经带值的（04187/04220/04297 等）会从这里再确认一次。
const ENEMY_RULES = Object.freeze({
  '04052': { prey: 'mostClues', parley: { skill: 'intellect', difficulty: 4 } },
  // 04062 瓦卢西亚的预示者：警戒/猎手/反击由卡面英文解析；「处于横置状态时能反击」
  // 由 retaliateWhileExhausted 交给引擎放行（P2 钩子）。
  '04062': { healthPerInvestigator: 10, vengeance: 5, retaliateWhileExhausted: true },
  '04078': { prey: 'poisoned', vengeance: 1 },
  '04079': { vengeance: 2 },
  '04084': { victory: 1 },
  '04086': { spawnAnyEmpty: true },
  // 核心盒的密会巫师（01170）：失落时代的牌堆也会引用它。
  '01170': { retaliate: true, spawnAnyEmpty: true, mythosEndDoom: 1 },
  // 伊斯学者（04259）：猎物是「手牌最多」。
  '04259': { prey: 'mostHand' },
  '04122b': { victory: 1 },
  '04130b': { victory: 1 },
  '04137b': { victory: 1 },
  '04186': { victory: 2, vengeance: 2 },
  '04187': { victory: 1, vengeance: 1 },
  '04219': { victory: 1 },
  '04220': { vengeance: 2 },
  '04296': { victory: 5 },
  // 04337 无形之子：庞大，不能移动，也不能被移动（引擎读 immobile）。
  '04337': { immobile: true },
  '04297': { vengeance: 1 },
  '04298': { victory: 2 },
})

const TREACHERY_RULES = Object.freeze({
  '04094': { sideArea: true },
  '04102': { permanent: true },
  '04089': { threatArea: true },
  '04097': { threatArea: true },
  '04099': { threatArea: true },
  '04077': { threatArea: true },
  '04085': { threatArea: true },
  '04189': { threatArea: true },
  '04190': { threatArea: true },
  '04214': { threatArea: true },
  // 残酷拷问（04261）：进威胁区域、不能进行抽取行动；卡面没有涌动（「获得涌动」是条件效果）。
  '04261': { threatArea: true, threat: { noDrawAction: true }, surge: false },
  // 核心盒的呆若木鸡 / 刺耳之声：威胁区域的限制交给引擎读取。
  '01164': { threatArea: true, threat: { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } } },
  '01165': { threatArea: true, threat: { cannotPlay: ['asset', 'event'], roundEndDiscard: true } },
})

// 印刷关键词只认「独立成句」的关键词，并且要排除 `gains retaliate.` / `gains hunter.`
// 这种由强制效果**临时获得**的写法。简单切句即可：
//   "Prey - ...\nHunter.\nForced - ..."  → "Hunter." 是关键词；Prey 行走人不影响后面的行。
//   "Serpent from Yoth gains retaliate." → 含 gains，整句跳过。
//   "Hunter. Retaliate\n[action]: ..."  → 换行断开，Retaliate 以行尾结束也能识别。
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

export function encounterDefinitions(cards, extraRules = {}) {
  const enemies = {}
  const treacheries = {}
  for (const card of cards) {
    // 剧情资产、地点与弱点由 storyAssets / locations 单独登记，不进遭遇定义。
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
        ...(ENEMY_RULES[card.code] || {}),
      } : {
        type: 'treachery',
        surge: printedSurge(text) || hasKeyword(text, 'Surge'),
        peril: hasKeyword(text, 'Peril'),
        hidden: hasKeyword(text, 'Hidden'),
        effect: { kind: 'campaignRule' },
        ...(extraRules.treacheries?.[card.code] || {}),
        ...(TREACHERY_RULES[card.code] || {}),
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

export function tfaCards() {
  return Object.values(ALL_CARDS).filter(card => TFA_PACKS.has(card.pack))
}

export { TFA_PACKS }
