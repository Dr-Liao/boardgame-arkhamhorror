// 09039 时刻警惕（Ever Vigilant）· 守卫者事件（4 级）· 0 费。
// 卡面：你所在地点的调查员可以依次共同从手牌打出总计最多 4 张支援，每张费用 -1。
//
// approximation：只实现「本调查员最多以 -1 费打出 4 张手牌支援」；其他玩家座位的手牌打出现在
// 没有统一多人入口，不模拟。
export default {
  code: '09039',
  abilities: [{
    kind: 'played',
    label: '至多以 -1 费打出 4 张手牌支援',
    resolve: ({ inv, api }) => {
      for (let played = 0; played < 4; played += 1) {
        const candidates = [...new Set((inv.hand || []).filter(code => api.cardType(code) === 'asset'))]
        if (!candidates.length) return
        const pick = api.choice({ kind: 'card', source: '09039', seat: inv.seat, canSkip: true,
          prompt: `时刻警惕：选择要以 -1 费打出的支援（已打 ${played}/4）。`,
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
        if (pick == null || pick === 'skip') return
        api.playCard(inv.seat, pick, { discount: 1, noAction: true })
      }
    },
  }],
  modifiers: [],
}
