import { ALL_CARDS } from '../cards/cards-data.js'
import { TREACHERY_AUDIO_OVERRIDES } from '../../presentation/card-audio-overrides.js'
import { emitCardAudio, emitPresentation } from './presentation-events.js'

// Ordered from specific themes to broad ones. Use the printed identifiers so
// localization and printed trait order cannot change a card's sound.
const treacheryTraits = [
  ['spectral', ['Spectral', 'Geist', 'Abyss', 'Eldritch', 'Otherworld', 'Extradimensional', 'Dreamlands']],
  ['omen', ['Omen', 'Endtimes', 'Paradox']],
  ['magic', ['Hex', 'Curse', 'Pact', 'Glyph', 'Spell', 'Corruption', 'Bane']],
  ['hazard', ['Hazard', 'Trap', 'Obstacle', 'Poison', 'Injury', 'Attack']],
  ['fear', ['Terror', 'Madness']],
  ['scheme', ['Scheme', 'Blunder', 'Illicit', 'Tactic', 'Rival', 'Flaw', 'Task', 'Hardship', 'Misfortune', 'Syndicate']],
  ['power', ['Power', 'Mutation', 'Blight', 'Colour', 'Flora', 'Ooze']],
  ['discovery', ['Evidence', 'Mystery', 'Insight', 'Ancient', 'Science', "R'lyeh"]],
  ['object', ['Item', 'Mask', 'Clothing']],
]

const encounterTypes = new Set(['enemy', 'enemy_location', 'location', 'asset', 'event'])
const weaknessTypes = new Set(['enemy', 'asset', 'event', 'skill'])

export function cardRevealAudio(definition, { weakness = false, fallbackType, tekeli = false } = {}) {
  const printedCode = definition?.originalCode || definition?.code
  const printed = ALL_CARDS[printedCode]
  const canonicalCode = printed?.duplicateOfCode || printedCode
  const type = printed?.type || definition?.type || fallbackType
  if (type === 'treachery') {
    const traits = printed?.traits || definition?.traits || []
    const theme = tekeli ? 'tekeli' : TREACHERY_AUDIO_OVERRIDES[printedCode] || TREACHERY_AUDIO_OVERRIDES[canonicalCode]
      || treacheryTraits.find(([, values]) => values.some(trait => traits.includes(trait)))?.[0]
    return theme && `treachery-${theme}`
  }
  if (weakness && weaknessTypes.has(type)) return `weakness-${type}`
  if (encounterTypes.has(type)) return `encounter-${type}`
  return undefined
}

export function presentWeaknessDraw(state, inv, def, events, { hidden, tekeli, tableState, name, fromTekeliDeck = false }) {
  const text = hidden ? `${inv.name} 秘密将一张牌加入手牌。`
    : `⚠️ ${inv.name} 抽到了弱点「${name}」：${def.textZh || def.text || ''}`
  const audio = hidden ? undefined : cardRevealAudio(def, { weakness: true, tekeli })
  const emit = fromTekeliDeck ? emitCardAudio : emitPresentation
  emit(state, events, {
    type: 'presentation', kind: 'weakness', phase: state.phase, round: state.round, seat: inv.seat,
    ...(hidden ? {} : { code: def.originalCode || def.code, name }),
    ...(audio ? { revealAudio: audio } : {}), text, tableState,
  })
  return text
}
