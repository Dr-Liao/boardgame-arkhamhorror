// 10048 刨根问底（Thorough Inquiry）· 探寻者事件 · 2 资源 · [[洞见]]/[[双重]]
// 卡面：
//   作为打出刨根问底的额外费用，花费一个行动。
//   你所在地点的调查员抽取总计 5 张卡牌（由你决定每位调查员各抽取几张卡牌）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「[[双重]] 额外花费 1 行动」= played 描述子 cost { action: 1 }（P6 统一读点
//     ability.js#playedActionCost：legalMoves 候选 / validateMove 拦截 / doPlay 扣减三处同源）。
//   · 「你所在地点的调查员」= api.investigatorsAt(inv.location)（aliveInvestigators 的唯一内容层入口，
//     已排除被击败/撤退者）。
//   · 「总计 5 张，由你分配」= 逐位用 api.choice 询问 0..剩余 张数（最后一位直接拿剩余），
//     再 api.drawCards（drawCards 的唯一内容层入口，含弱点/牌库不足等全部结算）。
const CODE = '10048'
const TOTAL = 5

export default {
  code: CODE,
  name: '刨根问底',
  abilities: [
    {
      kind: 'played',
      id: 'thoroughInquiryDraw',
      label: '你所在地点的调查员共抽 5 张卡牌（由你分配）',
      cost: { action: 1 },
      resolve: ({ inv, api }) => {
        const here = api.investigatorsAt(inv.location)
        if (!here.length) {
          api.info('📚 「刨根问底」：所在地点没有调查员。')
          return
        }
        let remaining = TOTAL
        for (let index = 0; index < here.length && remaining > 0; index++) {
          const target = here[index]
          const last = index === here.length - 1
          let amount = remaining
          if (!last) {
            const options = Array.from({ length: remaining + 1 }, (_, count) => ({
              id: String(count),
              label: count === 0 ? `${target.name} 不抽牌` : `${target.name} 抽 ${count} 张（剩余 ${remaining} 张）`,
            }))
            const picked = Number(api.choice({
              kind: 'effect', source: CODE, seat: inv.seat,
              prompt: `「刨根问底」：决定 ${target.name} 抽几张牌（总计 ${remaining} 张待分配）。`,
              options,
            }))
            amount = Number.isFinite(picked) ? Math.min(remaining, Math.max(0, picked)) : 0
          }
          if (amount > 0) {
            api.drawCards(target.seat, amount)
            api.info(`📚 「刨根问底」：${target.name} 抽取 ${amount} 张卡牌。`)
          }
          remaining -= amount
        }
      },
    },
  ],
  modifiers: [],
}
