export default {
  code: '90019',
  weaknessStaysInHand: true,
  playableWeakness: true,
  endTurnInHandHorror: 2,
  abilities: [{
    kind: 'played', label: '在密谋上放置 1 个毁灭并检查推进',
    effect: { type: 'addDoom', amount: 1 },
  }],
}
