// 05033 恐怖灵感
// 卡面：快速。在你将结算一张[Mystic]卡牌上的效果，且该卡牌有以下触发条件时打出：
//   在[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号揭示时；
//   如果揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号；
//   在[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号揭示后。
//   取消该效果，或额外结算一次该效果。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：symbolRevealed 窗口（含 auto_fail）内打出。识别「Mystic 卡牌的符号效果」的两条通道：
//   1) 本次检定的 source.code 是 Mystic 卡；2) 场上存在 Mystic 卡写下的本次检定标记效果
//      （sourceCode=卡号，如 05157/05158 在发起检定时添加，duration endOfTest）。
// 选择「取消」→ api.setSymbolEffect({cancelCard})，ability-exec 在窗口内跳过该卡本次结算；
// 选择「再结算一次」→ {repeatCard}，ability-exec 免费再执行一次。真正的清空由被作用的
// Mystic 卡在自己的符号能力结算后调 api.setSymbolEffect(null)（窗口结束口径）。

import { ALL_CARDS } from '../../cards/cards-data.js'

const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing', 'autofail']

function isMysticCode(code) {
  const card = code ? ALL_CARDS[code] : null
  return Boolean(card) && String(card.klass || '').toLowerCase() === 'mystic'
}

export default {
  code: '05033',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'symbolRevealed',
      criteria: [({ state, inv, context }) => {
        const test = state.skillTest
        if (!test || test.seat !== inv.seat) return false
        if (!context || !SYMBOLS.includes(context.token)) return false
        if (isMysticCode(test.source?.code)) return true
        // 标记效果通道：05157/05158 等 Mystic 卡在发起检定时写下的标记。
        return (state.effects || []).some(effect => isMysticCode(effect.sourceCode))
      }],
      label: '恐怖灵感：取消或额外结算该 Mystic 卡牌的符号效果',
      resolve: ({ state, inv, api }) => {
        const testCode = state.skillTest?.source?.code
        const markerCode = (state.effects || []).find(effect => isMysticCode(effect.sourceCode))?.sourceCode
        const cardCode = isMysticCode(testCode) ? testCode : markerCode
        if (!cardCode) { api.info('恐怖灵感：没有可作用的 Mystic 卡牌效果。'); return }
        const answer = api.choice({
          kind: 'effect', source: '05033', seat: inv.seat,
          prompt: '恐怖灵感：如何结算这张 Mystic 卡牌的符号效果？',
          options: [
            { id: 'cancel', label: '取消该效果' },
            { id: 'repeat', label: '额外结算一次该效果' },
          ],
        })
        if (answer === 'repeat') {
          api.setSymbolEffect({ repeatCard: cardCode })
          api.info(`📖 「恐怖灵感」：${api.cardName(cardCode)} 的符号效果将额外结算一次。`)
        } else {
          api.setSymbolEffect({ cancelCard: cardCode })
          api.info(`📖 「恐怖灵感」：取消了 ${api.cardName(cardCode)} 的符号效果。`)
        }
      },
    },
  ],
  modifiers: [],
}
