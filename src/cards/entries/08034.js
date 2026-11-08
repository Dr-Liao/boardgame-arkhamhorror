// 08034 繁星密语
// 卡面：快速。只可在你的回合期间打出。
//       弃掉你牌库顶的 1 张卡牌。如果该卡牌是一张弱点，将它重新洗回你的牌库。否则在你回合剩余
//       时间内，该卡牌在你的弃牌堆时，将它投入到你执行的每个符合条件的技能检定中。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：引擎没有「弃牌堆中的牌可投入每个检定」的枚举（请求 m2-1-08034.json）。这里等价
// 折算为：非弱点时给本回合的每次技能检定按其图标总数加值（相当于把该牌投入每个检定）；卡面要求在
// 弃牌堆持续存在、每次投入只影响一次检定——加值效果不会产生逐次投入的卡牌移动/触发。
import { ownTurn } from '../../engine/matcher.js'
import { ALL_CARDS } from '../../cards/cards-data.js'

const iconTotal = code => Object.values(ALL_CARDS[code]?.icons || {})
  .reduce((sum, value) => sum + (Number(value) || 0), 0)
const isWeakness = code => ALL_CARDS[code]?.subtype === 'weakness'
  || ALL_CARDS[code]?.subtype === 'basicweakness'

export default {
  code: '08034',
  playCondition: [ownTurn()],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '弃牌库顶 1 张：弱点洗回；否则本回合每个技能检定获得其图标',
      resolve: ({ inv, api }) => {
        if (!(inv.deck || []).length) {
          api.info('繁星密语：牌库是空的。')
          return
        }
        const code = inv.deck[inv.deck.length - 1]
        api.discardTopOfDeck(inv.seat, 1)
        if (isWeakness(code)) {
          api.moveCard({ code, from: 'discard', to: 'deckTop' })
          api.shuffleDeck(inv.seat)
          api.info(`繁星密语：弃到弱点「${api.cardName(code)}」，将它洗回牌库。`)
          return
        }
        const icons = iconTotal(code)
        if (icons > 0) {
          api.addEffect({
            duration: 'endOfTurn',
            sourceCode: '08034',
            label: `繁星密语：本回合每次技能检定获得「${api.cardName(code)}」的 ${icons} 个图标`,
            modifiers: [{ target: 'skill:*', amount: icons }],
          })
        }
        api.info(`繁星密语：弃掉「${api.cardName(code)}」；本回合你执行的每个技能检定获得其图标（${icons}）。`)
      },
    },
  ],
  modifiers: [],
}
