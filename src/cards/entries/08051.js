// 08051 不当交易（Untimely Transaction）· 游荡者事件 · 1 经验。
//
// 卡面：揭示你手中的一张 [[道具]] 支援。你所在地点的另一位调查员可以打出该支援，如同其是自己手牌。
//       如果该调查员选择打出，你抽取一张卡牌并获得该支援印刷费用的资源。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 由受邀调查员选择并按自己的正常费用打出，卡牌所有权保持不变。
import { ALL_CARDS } from '../../cards/cards-data.js'

const isItemAsset = code => {
  const def = ALL_CARDS[code]
  return Boolean(def) && def.type === 'asset' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')
}

export default {
  code: '08051',
  abilities: [
    {
      kind: 'played',
      label: '揭示一张手牌[[道具]]支援：另一位调查员可以打出它；若打出，你抽 1 张并获得其印刷费用资源',
      resolve: ({ state, inv, api }) => {
        const items = [...new Set(inv.hand || [])].filter(isItemAsset)
        if (!items.length) {
          api.info('「不当交易」：你手中没有可以揭示的[[道具]]支援。')
          return
        }
        const picked = items.length === 1 ? items[0]
          : api.choice({ kind: 'card', source: '08051', seat: inv.seat,
            prompt: '选择要揭示的手牌[[道具]]支援。',
            options: items.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
        if (!items.includes(picked)) return
        api.info(`🤝 「不当交易」：${inv.name} 揭示了手牌中的「${api.cardName(picked)}」。`)
        const others = state.investigators.filter(other => other.seat !== inv.seat
          && !other.defeated && !other.resigned && other.location === inv.location)
        if (!others.length) {
          api.info('「不当交易」：同地点没有其他调查员可以打出这张支援。')
          return
        }
        const otherSeat = others.length === 1 ? others[0].seat
          : Number(api.choice({ kind: 'investigator', source: '08051', seat: inv.seat,
            prompt: '由同地点的哪位调查员决定是否打出？',
            options: others.map(other => ({ id: String(other.seat), label: other.name })) }))
        const other = state.investigators[otherSeat]
        if (!other) return
        const answer = api.choice({ kind: 'effect', source: '08051', seat: otherSeat, canSkip: true,
          prompt: `是否打出 ${inv.name} 展示的「${api.cardName(picked)}」？`,
          options: [{ id: 'play', cardCode: picked, label: '支付费用打出' }, { id: 'skip', label: '不打出' }] })
        if (answer !== 'play' || !api.playerTools.playCardForSeat(otherSeat, inv.seat, picked, { noAction: true })) return
        api.drawCards(inv.seat, 1)
        const printedCost = Number(ALL_CARDS[picked]?.cost) || 0
        if (printedCost) api.gainResources(inv.seat, printedCost)
        api.info(`🤝 「不当交易」：${other.name} 打出了「${api.cardName(picked)}」；${inv.name} 抽取 1 张并获得 ${printedCost} 资源。`)
      },
    },
  ],
  modifiers: [],
}
