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
const SYMBOLS = {
  action:['action','行动'], reaction:['star','反应'], free:['action','免费触发'], fast:['action','快速'],
  combat:['sword','战斗'], willpower:['star','意志'], intellect:['book','智识'], agility:['leaf','敏捷'], wild:['star','任意技能'],
  guardian:['shield','守卫者'], seeker:['book','探求者'], rogue:['sword','流浪者'], mystic:['star','潜修者'], survivor:['leaf','求生者'], neutral:['star','中立'],
  health:['health','生命'], sanity:['sanity','理智'], resource:['resource','资源'], clue:['clue','线索'],
  per_investigator:['ally','每位调查员'], investigator:['ally','调查员'],
  skull:['doom','骷髅'], cultist:['eye','异教徒'], tablet:['tarot','石板'], elder_thing:['eye','古神'], elder_sign:['star','旧印'], auto_fail:['doom','自动失败'],
  bless:['star','祝福'], curse:['doom','诅咒'], frost:['star','冰霜'], blood:['health','鲜血'],
  seal_a:['star','封印 A'], seal_b:['star','封印 B'], seal_c:['star','封印 C'], seal_d:['star','封印 D'], seal_e:['star','封印 E'],
  day:['star','白昼'], night:['star','黑夜'], codex:['book','规则集'],
  ...Object.fromEntries(TDC_RUNES.map((name, index) => [name, ['star', `溺水之城符文 ${String.fromCharCode(65 + index)}`]])),
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
  return h('span', { className: 'ah-rule-symbol', 'data-card-symbol': name, title: symbol[1], 'aria-label': symbol[1], role: 'img' },
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
  const count = objective.perInvestigator ? `${objective.perInvestigator} × 调查员人数` : String(objective.amount ?? 0)
  const location = id => state.locations?.find(l => l.id === id)?.name || ({hallway:'走廊',ritualSite:'仪式地点'})[id] || '指定地点'
  if (objective.type === 'clues') return `${objective.atLocation ? '在「'+location(objective.atLocation)+'」' : '团队'}花费 ${count} 个线索，推进当前场景。`
  if (objective.type === 'actClues') return `在当前场景放置 ${count} 个线索。`
  if (objective.type === 'uniqueCultists') return `找出 ${count} 名不同的独特异教徒。`
  if (objective.type === 'defeatEnemy') return `击败「${state.enemies?.find(e => e.id === objective.enemy || e.code === objective.enemy)?.name || ({ghoulPriest:'食尸鬼祭司'})[objective.enemy] || '目标敌人'}」。`
  if (objective.type === 'enterLocation') return `进入「${location(objective.location)}」。`
  return '达成卡面所述目标后推进。'
}
