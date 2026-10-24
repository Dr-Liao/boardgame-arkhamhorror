import { t } from './i18n.js'
import { tableIcon } from './table-components.js'
import { RULES, ruleLink } from './rulebook-data.js'
const aliases = RULES.flatMap(r=>r.aliases.filter(a=>!a.startsWith('[')).map(a=>[a,r.id])).sort((a,b)=>b[0].length-a[0].length)
const keywordPattern = new RegExp('(' + aliases.map(([a])=>/^[a-z ]+$/i.test(a)?'\\b'+a+'\\b':a).join('|') + ')','gi')
const TDC_RUNES = Array.from({ length: 26 }, (_, index) => `tdc_rune_${String.fromCharCode(97 + index)}`)
function linkedText(h,text) {
  return text.split(keywordPattern).map(part=>{
    const match=aliases.find(([alias])=>alias.toLowerCase()===part.toLowerCase())
    return match?ruleLink(h,match[1],part):part
  })
}
// 模块顶层只存 icon 与词典 key（渲染期再 t()），避免导入时求值把默认语言固化下来。
// 第三项是插值参数（目前只有 TDC 符文用 letter）。
const SYMBOLS = {
  action:['action','symbol.action'], reaction:['star','symbol.reaction'], free:['action','symbol.free'], fast:['action','symbol.fast'],
  combat:['sword','symbol.combat'], willpower:['star','symbol.willpower'], intellect:['book','symbol.intellect'], agility:['leaf','symbol.agility'], wild:['star','symbol.wild'],
  guardian:['shield','symbol.guardian'], seeker:['book','symbol.seeker'], rogue:['sword','symbol.rogue'], mystic:['star','symbol.mystic'], survivor:['leaf','symbol.survivor'], neutral:['star','symbol.neutral'],
  health:['health','symbol.health'], sanity:['sanity','symbol.sanity'], resource:['resource','symbol.resource'], clue:['clue','symbol.clue'],
  per_investigator:['ally','symbol.per_investigator'], investigator:['ally','symbol.investigator'],
  skull:['doom','symbol.skull'], cultist:['eye','symbol.cultist'], tablet:['tarot','symbol.tablet'], elder_thing:['eye','symbol.elder_thing'], elder_sign:['star','symbol.elder_sign'], auto_fail:['doom','symbol.auto_fail'],
  bless:['star','symbol.bless'], curse:['doom','symbol.curse'], frost:['star','symbol.frost'], blood:['health','symbol.blood'],
  seal_a:['star','symbol.seal_a'], seal_b:['star','symbol.seal_b'], seal_c:['star','symbol.seal_c'], seal_d:['star','symbol.seal_d'], seal_e:['star','symbol.seal_e'],
  day:['star','symbol.day'], night:['star','symbol.night'], codex:['book','symbol.codex'],
  ...Object.fromEntries(TDC_RUNES.map((name, index) => [name, ['star', 'symbol.tdcRune', { letter: String.fromCharCode(65 + index) }]])),
}
// Source: the bundled reference's styles/icons.css and matching symbol fonts.
const CARD_GLYPHS = {
  action: 'I', reaction: 'y', free: 'u', fast: 'u',
  willpower: 'A', intellect: 'F', combat: 'D', agility: 'S', wild: 'G',
  guardian: 'Q', seeker: 'E', rogue: 'T', mystic: 'W', survivor: 'R', neutral: 'F',
  elder_sign: 'X', auto_fail: 'Z',
  skull: '\ue910', cultist: '\ue911', tablet: '\ue912', elder_thing: '\ue913',
  curse: '\ue929', bless: '\ue92a', per_investigator: '\ue915',
  frost: 'b', seal_a: 'g', seal_b: 'f', seal_c: 'e', seal_d: 'c', seal_e: 'd',
  codex: 'h', day: 'i', night: 'j',
  ...Object.fromEntries(TDC_RUNES.map((name, index) => [name, String.fromCharCode(0xe900 + index)])),
}
const ICON_GLYPHS = new Set(['skull','cultist','tablet','elder_thing','curse','bless','per_investigator'])
const SLIM_GLYPHS = new Set(['neutral','frost','seal_a','seal_b','seal_c','seal_d','seal_e','codex','day','night',...TDC_RUNES])
const SYMBOL_ALIASES = { eldersign: 'elder_sign', elderthing: 'elder_thing', autofail: 'auto_fail', knowledge: 'intellect' }
export function symbolToken(name) {
  const key = String(name).toLowerCase(), canonical = SYMBOL_ALIASES[key] || key
  return Object.hasOwn(SYMBOLS, canonical) ? `[${canonical}]` : String(name)
}
export function cardSymbol(h, name) {
  name = SYMBOL_ALIASES[name] || name
  const symbol = SYMBOLS[name]
  if (!symbol) return `[${name}]`
  const glyph = CARD_GLYPHS[name]
  const label = symbol[2] ? t(symbol[1], symbol[2]) : t(symbol[1])
  return h('span', { className: 'ah-rule-symbol', 'data-card-symbol': name, title: label, 'aria-label': label, role: 'img' },
    glyph ? h('span', {
      className: 'ah-card-glyph' + (ICON_GLYPHS.has(name) ? ' ah-card-glyph-icons' : SLIM_GLYPHS.has(name) ? ' ah-card-glyph-slim' : ''),
      'aria-hidden': 'true',
    }, glyph) : tableIcon(symbol[0]))
}
export function renderRulesText(h, text, { links = true } = {}) {
  if (typeof text !== 'string') return ''
  return text.replace(/<[^>]*>/g, '').split(/(\[\[[^\]]+\]\]|\[[a-z_]+\])/gi).map(part => {
    // Double brackets mark traits, not chaos tokens (e.g. [[Cultist]]).
    if (part.startsWith('[[') && part.endsWith(']]')) return h('strong', { className: 'ah-rule-trait' }, part.slice(2,-2))
    const key = part.slice(1,-1).toLowerCase(), name = SYMBOL_ALIASES[key] || key
    if (/^\[/.test(part) && Object.hasOwn(SYMBOLS, name)) {
      const rule=links && RULES.find(r=>r.aliases.includes(`[${name}]`))
      const icon = cardSymbol(h, name)
      return rule ? ruleLink(h,rule.id,icon) : icon
    }
    return links ? linkedText(h,part) : part
  })
}
// Cinematics create DOM directly; keep the same symbol renderer without adding
// interactive rule buttons to a modal's reading/focus flow.
export function setRulesText(element, text) {
  const h = (tag, attrs, ...children) => {
    const node = element.ownerDocument.createElement(tag)
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key === 'className' ? 'class' : key, value)
    node.append(...children.flat(Infinity))
    return node
  }
  element.replaceChildren(...[renderRulesText(h, text, { links: false })].flat(Infinity))
}
export function objectiveText(objective, state = {}) {
  if (typeof objective === 'string') return objective
  if (!objective || typeof objective !== 'object') return ''
  const count = objective.perInvestigator ? t('objective.perInvestigator', { count: objective.perInvestigator }) : String(objective.amount ?? 0)
  // 地点/敌人名属于内容数据（不翻译）：优先取观察投影里的名字，只有缺失时才用本文件的兜底名。
  const location = id => state.locations?.find(l => l.id === id)?.name || ({hallway:'走廊',ritualSite:'仪式地点'})[id] || t('objective.location.generic')
  if (objective.type === 'clues') return objective.atLocation
    ? t('objective.clues', { location: location(objective.atLocation), count })
    : t('objective.clues.team', { count })
  if (objective.type === 'actClues') return t('objective.actClues', { count })
  if (objective.type === 'uniqueCultists') return t('objective.uniqueCultists', { count })
  if (objective.type === 'defeatEnemy') return t('objective.defeatEnemy', { name: state.enemies?.find(e => e.id === objective.enemy || e.code === objective.enemy)?.name || ({ghoulPriest:'食尸鬼祭司'})[objective.enemy] || t('objective.enemy.generic') })
  if (objective.type === 'enterLocation') return t('objective.enterLocation', { location: location(objective.location) })
  return t('objective.generic')
}
