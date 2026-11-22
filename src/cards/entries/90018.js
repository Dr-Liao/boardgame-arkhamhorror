import { assetTextBlanked, assetTextBlankedExceptForced } from '../../engine/card-text.js'

export default {
  code: '90018',
  assetRule: { onlyPlayerEffectHarm: true },
  abilities: [{
    kind: 'reaction', trigger: 'spellPlayed', legacyReaction: true,
    label: '打出法术卡后抽一张牌',
    criteria: ({ inv, source }) => !assetTextBlanked(source, inv) && !assetTextBlankedExceptForced(source),
    effect: { type: 'draw', amount: 1 },
  }],
}
