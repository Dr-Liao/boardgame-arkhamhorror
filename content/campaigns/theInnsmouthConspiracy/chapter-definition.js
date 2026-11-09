import DATA from './chapter-data.json' with { type: 'json' }
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { chapters, CAMPAIGN_ID } from './shared.js'
import { printed, location, stage, encounterDefinitions, identitiesFor } from './card-data.js'
import { bindScenarioIdentities } from '../../identities.js'
import { STORY_TEXT } from './story-text.js'

export const physicalLocationId = id => `location${id.replace(/[:#]/g, 'copy')}`
export const chapterData = DATA

// 参考 zh locale 里的 i18next ICU 转义（{'{'}bless{'}'}）还原为 {bless}，再统一转成卡面图标记号
// [bless]（渲染层 renderRulesText 只认方括号）；Markdown 强调符（*…* / _…_）在正文里不应展示。
const ICON_ALIASES = Object.freeze({ elderThing: 'elder_thing', elderSign: 'elder_sign', autoFail: 'auto_fail', fast: 'free' })
const STORY_LABELS = Object.freeze({ intro: '引言', resolution: '结局', 'no resolution': '无结局' })
export function restoreInlineText(text) {
  return String(text)
    // i18next 转义：{'{'}cultist{'}'} → {cultist}
    .replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, (_, name) => `{${name}}`)
    .replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, name) => `[${ICON_ALIASES[name] || name}]`)
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '$1')
    .replace(/(^|[\s（(])_([^_\n]+)_(?=[\s，。！？；：、）)]|$)/g, '$1$2')
    .replace(/(^|[\n>])(Intro|Resolution|No Resolution)\s*([0-9]+)?\s*[:：]\s*/g,
      (match, prefix, label, number) => `${prefix}${STORY_LABELS[label.toLowerCase()]}${number ? ` ${number}` : ''}：`)
}

/** HTML/富文本 → 纯文本块数组（一段一个元素；<li> 转成「• 」段落）。 */
export function textBlocks(value) {
  if (typeof value === 'string') {
    return restoreInlineText(value)
      .replace(/<img\b[^>]*>/gi, '')
      .replace(/<li\b[^>]*>/gi, '\n\n• ')
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n\n')
      .replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
      // 遭遇组图标清单：图标 <img> 已在展示层剥掉，留下「这些遭遇组以下列图标标示：」的悬空句；
      // 遭遇组名称已在前句列出，这里连同冒号一起删掉（guides-0004 / setup-0002 同口径）。
      .replace(/(?:这些|上述|以下)?遭遇(?:组|牌)[^。.：:\n；;]*(?:图标|圖標)[^。.：:\n；;]*[：:]\s*/g, '')
      .split(/\n{2,}/)
      .map(part => part.trim())
      .filter(Boolean)
  }
  return Object.entries(value || {}).filter(([key]) => key !== 'title').flatMap(([, child]) => textBlocks(child))
}

export function buildChapterDefinition(id) {
  const chapter = chapters.find(c => c.id === id), spec = DATA[id]
  if (!chapter || !spec) throw new RangeError(`Unknown Innsmouth chapter: ${id}`)
  const groupCodes = Object.values(ALL_CARDS).filter(c => spec.gatherSets.includes(c.encounterCode)
    || c.encounterCode === chapter.encounterCode).map(c => c.code)
  const definitions = encounterDefinitions([...groupCodes, ...spec.encounterDeck, ...spec.reservedEncounter])
  const locations = Object.fromEntries(spec.locations.map(data => {
    const id = physicalLocationId(data.id), result = location({ ...data, id })
    const symbols = spec.symbolGraph?.[data.code]
    if (symbols) result.symbols = { front: structuredClone(symbols), back: structuredClone(symbols) }
    if (result.symbols) result.symbols.dynamic = true
    return [id, result]
  }))
  // Front/back alternatives remain available as printed definitions, never extra physical cards.
  const stageCards = Object.fromEntries(groupCodes.filter(code => ['act', 'agenda'].includes(ALL_CARDS[code].type))
    .map(code => [code, stage(code)]))
  const story = STORY_TEXT.zh.scenarios[id]
  // 结局正文段首「结局 N：」由结局面板标题层承载，正文不重复（story-0009）。
  const resolutionText = value => {
    const blocks = textBlocks(value)
    if (blocks.length) blocks[0] = blocks[0].replace(/^(?:结局|尾声|无结局)\s*\d*\s*[:：]\s*/, '').trim()
    return blocks.join('\n\n')
  }
  const scenario = { id, campaignId: CAMPAIGN_ID, eventWindowInstances: true, ...printed(chapter.code), referenceCode: chapter.code,
    name: chapter.name, nameEn: chapter.nameEn, textLanguage: 'zh-CN', textStatus: 'translated (self-translated)',
    intro: textBlocks(story.intro?.body || story.intro || story.introduction || '').join('\n\n') || chapter.name,
    setup: textBlocks(story.setup).join('\n\n'), rules: textBlocks(story.specialRules).join('\n\n'),
    startLocation: spec.startLocation ? physicalLocationId(spec.startLocation) : physicalLocationId('07203'),
    locations, setAsideLocations: Object.keys(locations), stageCards,
    acts: spec.acts.map(a => stage(a.originalCode, { ...a, id: `act${a.originalCode}` })),
    agendas: spec.agendas.map(a => stage(a.originalCode, { ...a, id: `agenda${a.originalCode}` })),
    encounterDeck: [...spec.encounterDeck], ...definitions, mechanics: structuredClone(spec.mechanics),
    resolutions: { noResolution: '', ...Object.fromEntries(Object.entries(story.resolutions || {}).map(([key, value]) => [key, resolutionText(value)])) },
  }
  const identities = identitiesFor(scenario)
  bindScenarioIdentities(scenario, identities)
  return { scenario, identities, spec }
}
