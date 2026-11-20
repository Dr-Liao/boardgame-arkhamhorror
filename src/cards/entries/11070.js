import { ownSeat } from '../../engine/matcher.js'

const CODE = '11070'

export default {
  code: CODE,
  sealOnEnterChoice: 'symbol',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'forced', trigger: 'turnBegins', label: '你的回合开始时花费 1 充能，否则弃掉此牌',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [ownSeat()],
      resolve: ({ inv, source, api }) => {
        if (!api.spendUses(source, 1)) api.discardAsset(inv.seat, source)
      },
    },
    {
      kind: 'free', label: '弃掉手中一份同名牌：将此牌的充能补至 3',
      criteria: [({ inv, source }) => source.uses < 3 && inv.hand.includes(CODE)],
      resolve: ({ inv, source, api }) => {
        if (api.discardFromHand(inv.seat, CODE)) api.setAssetUses(source, 3)
      },
    },
  ],
}
