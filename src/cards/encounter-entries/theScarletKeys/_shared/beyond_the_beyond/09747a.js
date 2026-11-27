// 09747a 凌乱道路（Rambling Route）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面查看能力由同一共享描述子处理；攻防难度由 concealedFightEvadeBonus 声明。
import { ramblingRouteLook } from './_shared.js'
const CODE = '09747a'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { otherworld: true, shadowLocation: true, concealed: 1, ramblingRoute: true },
  locationRule: {
    concealedFightEvadeBonus: 2,
  },
  abilities: [ramblingRouteLook(CODE), {
    kind: 'forced',
    trigger: 'tskExposed',
    label: '揭露此地点：左边受到 1 点伤害，右边受到 1 点恐惧',
    criteria: ({ source, context }) => Boolean(source) && context?.decoy !== true
      && String(context?.code ?? context?.kind) === String(source.code),
    resolve: ({ context, api }) => {
      const seat = context?.seat
      if (!Number.isSafeInteger(seat)) return
      if (context.position === 'left') {
        api.damage(seat, 1)
        api.info?.('「残骸之城（A）」：阴影左边揭露，受到 1 点伤害。')
      } else if (context.position === 'right') {
        api.horror(seat, 1)
        api.info?.('「残骸之城（A）」：阴影右边揭露，受到 1 点恐惧。')
      }
    },
  }],
}
