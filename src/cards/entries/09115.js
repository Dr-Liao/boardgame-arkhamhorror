// 09115 随心而动（Heed the Dream）· 幸存者事件 · 2 经验 · [[抉择]]
// 卡面：每轮最多 2 张[[抉择]]。
//       显现 - 揭示每位调查员牌库顶的卡牌，放成一堆。重复两次。在三堆中选择一堆。
//       每位调查员抽取这堆中每张自己的卡牌。将其他两堆中的每张弱点洗入其所有者牌库。
//       将揭示的其他每张卡牌从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 手牌来源强制能力 + cardDrawn 窗口（与 09106 同一「显现」实现）；
//   · 取走牌库顶 3 张：api.takeDeckCard（唯一写点）；加入手牌 api.putInHand；
//     弱点洗回 api.putOnTopOfDeck + api.shuffleDeck；其它牌移出游戏 api.exileCard；
//   · 是否弱点读 cards-data 的 subtype（与 isWeaknessCard 同口径：weakness / basicweakness）。
// approximation: 「每轮最多 2 张抉择」按本卡每轮 2 次近似；被移出游戏的牌记入 state.exiled
//   （引擎 exilePlayerCard 的记账口径，与「移出游戏」共用）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const code = '09115'

const isWeakness = cardCode => {
  const subtype = ALL_CARDS[cardCode]?.subtype
  return subtype === 'weakness' || subtype === 'basicweakness'
}

export default {
  code,
  note: 'approximation: 「每轮最多 2 张抉择」按本卡每轮 2 次近似（缺特质作用域上限）；移出游戏记入 exiled 账本。',
  playCondition: [{ when: () => false, message: '「随心而动」具有显现，只能在抽到时结算' }],
  abilities: [
    {
      kind: 'forced',
      fromHand: true,
      noPlayCost: true,
      trigger: 'cardDrawn',
      limit: { scope: 'perRound', owner: 'investigator', count: 2 },
      label: '显现：每位调查员揭示牌库顶 3 张为三堆，选一堆抽取，其余弱点洗回、其它移出游戏',
      criteria: [({ inv, context }) => context?.cardCode === code && (inv.hand || []).includes(code)],
      resolve: ({ state, inv, api }) => {
        api.discardFromHand(inv.seat, code)
        const owners = state.investigators.filter(owner => !owner.defeated && !owner.resigned && !owner.storyInvestigator)
        const piles = owners.map(owner => {
          const top = (owner.deck || []).slice(-3).reverse()
          const taken = []
          for (const cardCode of top) {
            if (api.takeDeckCard(owner.seat, cardCode) != null) taken.push(cardCode)
          }
          return { seat: owner.seat, cards: taken }
        })
        const maxPile = Math.max(0, ...piles.map(pile => pile.cards.length))
        if (!maxPile) { api.info('「随心而动」：没有可揭示的卡牌。'); return }
        api.info(`🌙 「随心而动」：揭示牌库顶，形成三堆——${piles.map(pile => `座位 ${pile.seat + 1}：${pile.cards.map(cardCode => api.cardName(cardCode)).join('、') || '（无）'}`).join('；')}。`)
        const pileIndex = api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: '「随心而动」：选择一堆，每位调查员抽取这堆中自己的卡牌。',
          options: Array.from({ length: 3 }, (_, index) => ({
            id: String(index),
            label: `第 ${index + 1} 堆：${piles.map(pile => api.cardName(pile.cards[index]) || '（无）').join('、')}`,
          })),
        })
        const chosen = Math.max(0, Math.min(2, Number(pileIndex) || 0))
        for (const pile of piles) {
          for (const [index, cardCode] of pile.cards.entries()) {
            if (index === chosen) {
              api.putInHand(pile.seat, cardCode)
              continue
            }
            if (isWeakness(cardCode)) {
              api.putOnTopOfDeck(pile.seat, cardCode)
              api.shuffleDeck(pile.seat)
            } else {
              api.exileCard(cardCode, { seat: pile.seat })
            }
          }
        }
        api.info(`🌙 「随心而动」：所有调查员抽取第 ${chosen + 1} 堆中自己的卡牌；其余弱点洗回牌库、其它牌移出游戏。`)
      },
    },
  ],
  modifiers: [],
}
