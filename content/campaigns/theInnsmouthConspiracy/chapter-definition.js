import DATA from './chapter-data.json' with { type: 'json' }
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { chapters, CAMPAIGN_ID } from './shared.js'
import { printed, location, stage, encounterDefinitions, identitiesFor } from './card-data.js'
import { bindScenarioIdentities } from '../../identities.js'
import { STORY_TEXT } from './story-text.js'

export const physicalLocationId = id => `location${id.replace(/[:#]/g, 'copy')}`
export const chapterData = DATA
export function textBlocks(value) {
  if (typeof value === 'string') return [value.replace(/<img\b[^>]*>/gi, '').replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()].filter(Boolean)
  return Object.entries(value || {}).filter(([key]) => key !== 'title').flatMap(([, v]) => textBlocks(v))
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
  const scenario = { id, campaignId: CAMPAIGN_ID, eventWindowInstances: true, ...printed(chapter.code), referenceCode: chapter.code,
    name: chapter.name, nameEn: chapter.nameEn, textLanguage: 'zh-CN', textStatus: 'translated (self-translated)',
    intro: textBlocks(story.intro?.body || story.intro || story.introduction || '')[0] || chapter.name,
    setup: textBlocks(story.setup).join('\n\n'), rules: textBlocks(story.specialRules).join('\n\n'),
    startLocation: spec.startLocation ? physicalLocationId(spec.startLocation) : physicalLocationId('07203'),
    locations, setAsideLocations: Object.keys(locations), stageCards,
    acts: spec.acts.map(a => stage(a.originalCode, { ...a, id: `act${a.originalCode}` })),
    agendas: spec.agendas.map(a => stage(a.originalCode, { ...a, id: `agenda${a.originalCode}` })),
    encounterDeck: [...spec.encounterDeck], ...definitions, mechanics: structuredClone(spec.mechanics),
    resolutions: { noResolution: '', ...Object.fromEntries(Object.entries(story.resolutions || {}).map(([key, value]) => [key, textBlocks(value).join('\n\n')])) },
  }
  const identities = identitiesFor(scenario)
  bindScenarioIdentities(scenario, identities)
  return { scenario, identities, spec }
}
