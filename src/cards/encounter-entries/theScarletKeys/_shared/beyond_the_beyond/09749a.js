// 09749a 拟像旷野（Weald of Effigies）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面：强制 - 在你揭示拟像旷野后：查看你牌库顶的卡牌。如果不是弱点，将其放在一边作为空洞。
//   [fast] 如果拟像旷野没有线索：交换 2 张相邻地点的隐匿迷你卡位置，或交换阴影中 2 个地点的位置。
//   (团队每场游戏仅限一次。)
// 背面：隐匿 1。强制 - 揭露此地点：左边失去 2 资源；中间失去 1 行动。
// 读点：locationRevealed 窗口（locations.js 揭示后 triggerReaction）；空洞 api.tsk.hollow；
import { isWeaknessCode } from '../../../_shared.js'

import { wealdSwap } from './_shared.js'

const CODE = '09749a'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { otherworld: true, shadowLocation: true, concealed: 1, wealdOfEffigies: true },
  abilities: [{
    kind: 'forced',
    trigger: 'locationRevealed',
    label: '揭示拟像旷野后：牌库顶非弱点卡放一边作为空洞',
    criteria: ({ source, context }) => Boolean(source) && String(context?.location) === String(source.id)
      && Number.isSafeInteger(context?.seat),
    resolve: ({ state, context, api }) => {
      const inv = state.investigators?.[context.seat]
      const deck = inv?.deck || []
      const top = deck[deck.length - 1]
      if (!top) return
      if (isWeaknessCode(top)) {
        api.info?.('「拟像旷野」：牌库顶是弱点，不成为空洞。')
        return
      }
      if (api.tsk.hollow.isHollowed(top)) {
        api.info?.('「拟像旷野」：牌库顶已有同名空洞，本次不重复登记。')
      } else {
        api.tsk.hollow.hollow({ code: top, source: 'deck', scope: 'investigator', seat: context.seat })
      }
      api.takeDeckCard(context.seat, top)
      api.info?.('「拟像旷野」：牌库顶一张非弱点卡成为空洞。')
    },
  }, wealdSwap(CODE), {
    kind: 'forced',
    trigger: 'tskExposed',
    label: '揭露此地点：左边失去 2 资源，中间失去 1 行动',
    criteria: ({ source, context }) => Boolean(source) && context?.decoy !== true
      && String(context?.code ?? context?.kind) === String(source.code),
    resolve: ({ context, api }) => {
      const seat = context?.seat
      if (!Number.isSafeInteger(seat)) return
      if (context.position === 'left') {
        api.loseResources(seat, 2)
        api.info?.('「残骸之城（B）」：阴影左边揭露，失去 2 资源。')
      } else if (context.position === 'middle') {
        api.loseActions(seat, 1)
        api.info?.('「残骸之城（B）」：阴影中间揭露，失去 1 行动。')
      }
    },
  }],
}
