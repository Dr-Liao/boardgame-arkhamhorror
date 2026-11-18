// 铁杉谷盛宴（The Feast of Hemlock Vale）· 剧本卡面数据入口（P7）。
//
// 职责与 TIC/TDE/TSK 的 `card-data.js` 相同：各章 `definition.js` 只从这里取**印刷数据**
// （卡名/卡文/属性/背面字段），不把卡文抄成第二事实源；卡牌行为在
// `src/cards/encounter-entries/theFeastOfHemlockVale/**` 的单卡文件里。
// 事实源：`src/cards/cards-data.js`（10 号段唯一印刷事实源）。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

// 铁杉谷盛宴商品包：fhvc 为战役包（10501–10743）。
export const FHV_PACKS = new Set(['fhvc'])

// 遭遇组别名：卡表 encounterCode 与章节 gatherSets 命名不一致时在此登记（当前全部为 snake_case 直接对应）。
export const GROUP_ALIASES = Object.freeze({})
export const camelToSnake = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .toLowerCase()
export function encounterGroupCode(group) {
  return GROUP_ALIASES[group] || camelToSnake(group)
}

// 遭遇组 → 卡表 encounterCode 集合（章节声明 gatherSets 时唯一需要的转换）。
export function encounterGroupEncounterCodes(groups) {
  return new Set((Array.isArray(groups) ? groups : [groups]).map(encounterGroupCode))
}

// 遭遇组展开：返回该组内全部「可进遭遇牌库」的卡号（敌人/诡计），按卡号排序。
// 不含地点/幕/议程/剧情资产/密钥（这些由章节单独布置）。
export function encounterGroupCards(groups, { types = ['enemy', 'treachery'], exclude = [] } = {}) {
  const codes = encounterGroupEncounterCodes(groups)
  const excluded = new Set(exclude)
  return Object.keys(ALL_CARDS)
    .filter(code => !excluded.has(code))
    .filter(code => codes.has(ALL_CARDS[code].encounterCode))
    .filter(code => types.includes(ALL_CARDS[code].type))
    .sort()
}

// 遭遇牌库（含印刷份数）：把 encounters 组展开成物理张数数组。
export function encounterGroupDeck(groups, options = {}) {
  return encounterGroupCards(groups, options)
    .flatMap(code => Array(Math.max(1, Number(ALL_CARDS[code].quantity) || 1)).fill(code))
}

// 印刷事实（卡名/卡文/属性）。`text` 取中文（缺失回退英文），另带 textEn/backText。
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Feast of Hemlock Vale card: ${code}`)
  return { code, originalCode: code, name: c.nameZh || c.name, nameEn: c.name,
    subname: c.subnameZh || c.subname || '', text: c.textZh || c.text || '', textEn: c.text || '',
    type: c.type, traits: [...(c.traits || [])], ...(c.backText ? { backText: c.backTextZh || c.backText } : {}) }
}

// 地点：印刷字段 + definition 传入的连接/线索/胜利点/符号等。
// shroud 直接复制印刷值到运行期地点，否则引擎 `loc.shroud + …` 得到 undefined→NaN。
export function location(data) {
  const { id, code, cluesFixed, hasVictory, victory, clues, ...rest } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Feast of Hemlock Vale location: ${code}`)
  return { ...printed(code), id, shroud: c.shroud, connections: [], ...rest,
    ...(cluesFixed ? { cluesFixed: clues } : { cluesPerInvestigator: clues }),
    ...(hasVictory ? { victory: victory ?? 0 } : {}),
    unrevealedName: c.backNameZh || c.backName || c.nameZh || c.name,
    unrevealedNameEn: c.backName || c.name }
}

// 幕/议程阶段：code 为印刷卡号，number 为第几幕/第几议程（可传 a/b 面）。
export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Feast of Hemlock Vale stage: ${code}`)
  const { doom, stage: number, ...rest } = extra
  return { ...printed(code), id: `${c.type}${code}`, type: c.type, stage: `${number ?? c.stage}a`,
    reveal: { type: 'campaignRule' }, ...rest,
    ...(c.type === 'agenda' ? { doomThreshold: doom ?? c.doom } : {}) }
}

// 遭遇牌定义：enemy/treachery/story asset，数值与关键词直接取印刷字段/卡文。
export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const c = ALL_CARDS[code]
    if (!c) throw new RangeError(`Unknown encounter definition: ${code}`)
    const base = printed(code)
    if (c.type === 'enemy') {
      const keywords = String(c.text || '').split('\n').filter(line => !/\b(?:gains?|loses?|while|if|forced|reaction)\b/i.test(line)).join('\n')
      const prey = /Prey - ([^.]+)/.exec(c.text || '')?.[1]
      const preyRules = { 'Fewest cards in hand': 'fewestCardsInHand', 'Lowest [agility]': 'lowestAgility',
        'Lowest [willpower]': 'lowestWillpower', 'Most cards in hand': 'mostCardsInHand', 'Highest [agility]': 'highestAgility' }
      enemies[code] = { ...base, surge: /^Surge\./m.test(c.text || ''), fight: c.fight ?? null, evade: c.evade ?? null,
        health: c.health ?? null, ...(preyRules[prey] ? { prey: preyRules[prey] } : {}),
        ...(c.healthPerInvestigator ? { healthPerInvestigator: c.health } : {}),
        damage: c.damage || 0, horror: c.horror || 0,
        ...(Object.hasOwn(c, 'victory') ? { victory: c.victory } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert', 'Swarming'].filter(k => new RegExp(`\\b${k}\\.`).test(keywords)).map(k => [k.toLowerCase(), true])),
        elite: c.traits?.includes('Elite') || false }
    } else if (c.type === 'treachery') {
      treacheries[code] = { ...base, entryRevelation: true, surge: /^Surge\./m.test(c.text || ''),
        peril: /(?:^|\n|\. )Peril\./.test(c.text || '') }
    } else if (c.type === 'story') storyAssets[code] = { ...base, global: true }
    else if (c.type === 'asset') storyAssets[code] = { ...base,
      slots: [...(c.slots || [])], ...(c.health != null ? { health: c.health } : {}),
      ...(c.sanity != null ? { sanity: c.sanity } : {}) }
  }
  return { enemies, treacheries, storyAssets }
}

// 每个实体的身份（原卡号/美术卡号）：遭遇记录 → 卡表身份反查。
export function identitiesFor(scenario) {
  const identity = value => ({ originalCode: value.originalCode || value.code, artCode: value.originalCode || value.code })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas'].map(category => [category,
    Object.fromEntries(Object.values(scenario[category] || {}).map(value => [value.id || value.code, identity(value)]))]))
}

// 连接符号：地点左下角的符号 → 章节 definition 用 `symbol` 字段声明，这里只做透传/校验用表。
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
