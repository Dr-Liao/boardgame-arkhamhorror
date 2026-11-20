import { skillModifier } from './_shared.js'

export default {
  code: '11117',
  uses: 4,
  usesType: 'secrets',
  modifiers: [skillModifier('intellect', 1)],
  assetRule: {
    playCostUses: { cardType: 'event', trait: 'Insight', scope: 'self', usesFrom: 'controlled' },
  },
}
