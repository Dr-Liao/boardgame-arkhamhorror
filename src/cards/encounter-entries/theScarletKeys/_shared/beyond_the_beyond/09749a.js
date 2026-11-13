// 09749a 拟像旷野（Weald of Effigies）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面：强制 - 在你揭示拟像旷野后：查看你牌库顶的卡牌。如果不是弱点，将其放在一边作为空洞。
//   [fast] 如果拟像旷野没有线索：交换 2 张相邻地点的隐匿迷你卡位置，或交换阴影中 2 个地点的位置。
//   (团队每场游戏仅限一次。)
// 背面：隐匿 1。强制 - 揭露此地点：左边失去 2 资源；中间失去 1 行动。
// 读点：locationRevealed 窗口（locations.js 揭示后 triggerReaction）；空洞 api.tsk.hollow；
//   [fast] 是实体 free 行动；交换位置没有原语 → 用 api.tsk.concealed.reshuffle 近似。
import { isWeaknessCode } from '../../../_shared.js'

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
  }, {
    kind: 'free',
    actionKind: 'activate',
    label: '[fast] 此地无线索时：交换 2 张隐匿迷你卡或 2 个阴影地点的位置（团队每场游戏一次）',
    criteria: ({ source }) => Boolean(source) && Number(source.clues || 0) === 0,
    resolve: ({ state, inv, api }) => {
      if (api.scenarioFlag?.('wealdSwapUsed') === true) return false
      const cards = state?.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
      if (cards.length < 2) {
        api.info?.('「拟像旷野」：场上的隐匿迷你卡不足 2 张，无法交换位置。')
        return false
      }
      const picked = String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择要交换位置的两张隐匿迷你卡（或阴影中的两个地点）。',
        options: cards.map(card => ({ id: card.id, label: '隐匿迷你卡（' + card.locationId + '）' })),
      }))
      if (!cards.some(card => card.id === picked)) return false
      // 交换位置没有原语：用轮末同款重排（不增删，只重排当前地点/位置）近似。
      api.tsk.concealed.reshuffle()
      api.setScenarioFlag?.('wealdSwapUsed', true)
      api.info?.('「拟像旷野」：重排了场上隐匿迷你卡的位置。')
      return true
    },
  }, {
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
  note: 'approximation: 「交换 2 张迷你卡/2 个阴影地点」没有交换原语，用 tsk-concealed 的重排近似'
    + '（随机而不是玩家指定）；牌库顶由 api.takeDeckCard 取出（primitive-requests/09749a.json）。',
}
