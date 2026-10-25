// 05319 “你欠我一次”
// 卡面：查看另一位调查员的手牌。你可以打出该调查员手牌中的一张非弱点卡牌，置于你的控制之下。
//       如果你这么做，你和该调查员都抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05319 “你欠我一次”：选另一位调查员 → 查看其手牌 → 选一张付得起的非弱点击牌 →
// api.playCardFromOtherHand(fromSeat, code)：把对方手牌真实打进本调查员控制区（费用由本调查员支付、
// 走 doPlay 的入场/结算与去向规则；打不出去时引擎把牌放回对方手牌）→ 双方各抽 1。
// 「查看手牌」走 api.privateInfo 私密投影（只给查看者座位，不进公开日志）。

export default {
  code: '05319',
  abilities: [
    {
      kind: 'played',
      label: '查看另一位调查员手牌，打出其中一张并双方抽 1',
      resolve: ({ state, inv, api }) => {
        const others = state.investigators.filter(other => other.seat !== inv.seat && !other.defeated && !other.resigned)
        if (!others.length) { api.info('「你欠我一次」：没有其他调查员。'); return }
        const who = others.length === 1 ? String(others[0].seat) : api.choice({ kind: 'target', source: '05319', seat: inv.seat,
          prompt: '选择要查看手牌的调查员。', options: others.map(other => ({ id: String(other.seat), label: other.name })) })
        const other = state.investigators[Number(who)] || others[0]
        // 私密投影：卡名只对查看者可见；公开日志只写对象与张数。
        api.privateInfo(inv.seat, `${other.name} 的手牌：${other.hand.map(code => api.cardName(code)).join('、') || '（空）'}`)
        api.info(`${inv.name} 查看了 ${other.name} 的手牌（共 ${other.hand.length} 张）。`)
        const playable = [...new Set(other.hand)].filter(code => {
          if (api.cardType(code) === 'skill' || api.cardType(code) === null) return false
          if (!api.isNonWeakness(code)) return false
          return inv.resources >= api.playCost(inv.seat, code)
        })
        if (!playable.length) { api.info('「你欠我一次」：对方手里没有你能打出的非弱点卡牌。'); return }
        const answer = api.choice({ kind: 'card', source: '05319', seat: inv.seat, canSkip: true,
          prompt: '选择要打出的卡牌（或放弃）。',
          options: [{ id: 'done', label: '不打出' }, ...playable.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))] })
        if (answer === 'done' || answer === undefined || !playable.includes(answer)) return
        const played = api.playCardFromOtherHand(other.seat, answer)
        if (!played) {
          api.info(`「${api.cardName(answer)}」没能打出，放回 ${other.name} 的手牌。`)
          return
        }
        api.drawCards(inv.seat, 1)
        api.drawCards(other.seat, 1)
        api.info(`${inv.name} 打出了 ${other.name} 的「${api.cardName(answer)}」，双方各抽 1 张。`)
      },
    },
  ],
  modifiers: [

  ],
}
