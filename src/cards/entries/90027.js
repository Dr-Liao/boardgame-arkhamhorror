import { assetTextBlanked, assetTextBlankedExceptForced } from '../../engine/card-text.js'

export default {
  code: '90027',
  assetRule: { voluntaryHarmForbiddenForTraits: ['Ally'] },
  modifiers: [{
    target: 'slot:ally', amount: 1,
    condition: { when: ({ inv, source }) => !assetTextBlanked(source, inv) && !assetTextBlankedExceptForced(source) },
  }],
}
