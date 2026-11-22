export default {
  code: '90031',
  explicitReactionPrompt: true,
  mentalTraumaIfCounters: true,
  abilities: [{
    kind: 'weakness', label: '带着 4 个线索进入威胁区',
    weakness: { type: 'threat', clues: 4, redirectClues: true },
  }],
}
