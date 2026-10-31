// 06205 清醒梦
// 卡面：选择你游戏区域的一张卡牌，或揭示你的一张手牌。查找你的牌库，找出并抽取另一张该卡牌的
//       同名卡牌。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：候选 = 自己场上支援的卡号 + 手牌卡号（同卡号去重）；从牌库取出同名另一张走
// api.moveCard（牌库→手牌，底层是统一的区域移动原语），然后 api.shuffleDeck。

export default {
  code: '06205',
  abilities: [
    {
      kind: 'played',
      label: '选择场上或手牌的一张卡，检索牌库中另一张同名卡并抽取，然后洗回',
      resolve: ({ inv, api }) => {
        const playArea = (inv.assets || []).map(item => item.code)
        const hand = [...(inv.hand || [])]
        const candidates = [...new Set([...playArea, ...hand])]
          .filter(code => code !== '06205' && (inv.deck || []).includes(code))
        if (!candidates.length) {
          api.shuffleDeck(inv.seat)
          api.info('你的场上与手牌里没有能在牌库中找到另一张同名卡的卡牌。')
          return
        }
        const answer = candidates.length === 1 ? '0' : api.choice({
          kind: 'card', source: '06205', seat: inv.seat, canSkip: true,
          prompt: '选择一张卡牌：检索牌库中另一张同名卡。',
          options: candidates.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) })),
        })
        if (answer === 'skip') { api.shuffleDeck(inv.seat); return }
        const code = candidates[Number(answer)]
        if (!code) { api.shuffleDeck(inv.seat); return }
        api.moveCard({ code, from: 'deck', to: 'hand' })
        api.shuffleDeck(inv.seat)
        api.info(`${inv.name} 用「清醒梦」找出了另一张「${api.cardName(code)}」。`)
      },
    },
  ],
  modifiers: [],
}
