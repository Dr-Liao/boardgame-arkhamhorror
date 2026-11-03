export default { code: '07013', weaknessStaysInHand: true, playableWeakness: true, investigator: { cannotPlayAction: true },
  modifiers: [{ target: 'skill:willpower', amount: -1, condition: { when: ({ controller, source }) => controller.assets.includes(source) } },
    { target: 'skill:willpower', amount: -2, condition: { sourceInHand: true } }] }
