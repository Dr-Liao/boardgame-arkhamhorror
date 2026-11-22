// 90079 寻找真相（Search for the Truth）· 中立 · 事件 · 费用 1 · 洞见 · 进阶（雷克斯·墨菲）。
// 卡面（cards-data 90079）：
//   雷克斯·墨菲牌库专用。进阶。
//   雷克斯·墨菲每有 1 个线索（最多 5 个），你可以选择一项：
//   - 抽 1 张牌。
//   - 将该线索放置在你所在地点，并从你的弃牌堆将任意 1 张牌返回手牌。
//
// 引擎读点：
//   · 每个线索二选一 = 循环 inv.clues（数据读点）+ api.choice 询问；
//   · 「把你自己的线索放到所在地点」= api.spendClues(seat,1)（调查员线索的唯一扣减入口）
//     + api.placeClues(seat,1)（locations.js#placeCluesOnLocation，从供应堆放到所在地点）；
//   · 「从弃牌堆返回任意 1 张牌到手牌」= api.moveCard({ code, from:'discard', to:'hand' })（zones 唯一写点）。
// 说明：印刷「该线索」是从雷克斯身上移出的那 1 个；引擎用「扣 1 + 从供应堆补 1」等价实现。
const code = '90079'

export default {
  code,
  abilities: [{
    kind: 'played',
    label: '每个线索（最多 5）选择：抽 1 张牌，或把该线索放在所在地点并返回 1 张弃牌',
    resolve: ({ inv, api }) => {
      const clues = Math.min(5, Number(inv.clues) || 0)
      for (let index = 0; index < clues; index += 1) {
        if ((inv.clues || 0) <= 0) break
        const options = [{ id: 'draw', label: '抽 1 张牌' }]
        if ((inv.discard || []).length) options.push({ id: 'clue', label: '将该线索放在你所在地点，并从弃牌堆返回 1 张牌' })
        const choice = api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: `寻找真相：第 ${index + 1} 个线索（共 ${clues} 个）。选择一项。`,
          options,
        })
        if (choice === 'clue') {
          if (api.spendClues(inv.seat, 1) < 1) continue
          api.placeClues(inv.seat, 1)
          const codes = [...new Set(inv.discard)]
          if (!codes.length) continue
          const picked = codes.length === 1 ? codes[0] : api.choice({
            kind: 'card', source: code, seat: inv.seat,
            prompt: '寻找真相：从弃牌堆选择 1 张牌返回手牌。',
            options: codes.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
          })
          if (picked && codes.includes(picked)) api.moveCard({ code: picked, from: 'discard', to: 'hand' })
        } else {
          api.drawCards(inv.seat, 1)
        }
      }
      api.info('寻找真相：按线索数完成结算。')
    },
  }],
  modifiers: [],
}
