const treacheryThemes = ['spectral', 'omen', 'magic', 'hazard', 'fear', 'scheme', 'power', 'discovery', 'object', 'tekeli']
const variants = new Set(['magic', 'hazard', 'fear'])
const revealIds = [
  'private-reveal', 'encounter-enemy', 'encounter-enemy_location', 'encounter-location',
  'encounter-asset', 'encounter-event', 'weakness-enemy', 'weakness-asset', 'weakness-event', 'weakness-skill',
  ...treacheryThemes.flatMap(theme => [
    `treachery-${theme}`, `weakness-treachery-${theme}`,
    ...(variants.has(theme) ? [`treachery-${theme}-alt`, `weakness-treachery-${theme}-alt`] : []),
  ]),
]

export const CARD_OUTCOME_SOUNDS = Object.freeze({
  hybridReveal: 'encounter-enemy_location',
  injury: 'card-injury',
  fright: 'card-fright',
  injuryAndFear: 'card-injury-and-fear',
  doom: 'card-doom',
  loseResource: 'card-lose-resource',
  loseClue: 'card-lose-clue',
  loseCard: 'card-lose-card',
  loseAction: 'card-lose-action',
  attach: 'card-attach',
  spawn: 'card-spawn',
  move: 'move',
})

export const CARD_AUDIO_FILES = Object.freeze(Object.fromEntries([
  ...revealIds, 'card-surge', ...Object.values(CARD_OUTCOME_SOUNDS).filter(sound => sound !== 'move'),
].map(id => [id, `card-cues/${id}.wav`])))

export function revealSound(step, weakness = false) {
  if (!step.code) return 'private-reveal'
  const kind = step.revealAudio
  if (typeof kind !== 'string') return 'encounter'
  const treachery = kind.startsWith('treachery-')
  const theme = treachery ? kind.slice('treachery-'.length) : null
  let id = treachery && (weakness || step.weaknessAudio) ? `weakness-${kind}` : kind
  // Both seats hear the same variant. Successive copies still have distinct
  // event sequences, including into and out of a paused rule choice.
  if (variants.has(theme) && step.eventSeq % 2 === 1) id += '-alt'
  return Object.hasOwn(CARD_AUDIO_FILES, id) ? id : 'encounter'
}
