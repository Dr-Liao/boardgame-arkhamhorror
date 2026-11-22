// 60465 镜像形态（Mirror Form，Marie Lambeau）
// 卡面：快速。只能在你的回合打出。
//       选择你手牌中的一张[[法术]]或[[守护]]支援，将其放置入场，位于你的控制之下。
//       在一轮结束时，如果该支援依然在场上，将其洗回你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「放置入场」= api.putIntoPlay（api-card.js 的唯一「从手牌放置入场」写入口；返回资产实例）；
//   · 「一轮结束时洗回牌库」= 实例级标记 shuffleIntoDeckAtRoundEnd（api.markAssetRoundEndReturn(asset,'deck')
//     + turn.js#runMythos 轮末段读点）。引擎时点是「新一轮开始时」结算轮末效果（与 discardAtRoundEnd 同层），
//     规则上就是上一轮的轮末，所以与卡面「一轮结束时」等价。
import { ownTurn } from '../../engine/matcher.js'
import { ALL_CARDS } from '../cards-data.js'

const matches = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => ['spell', 'charm'].includes(String(trait).toLowerCase()))

export default {
  code: '60465',
  playCondition: [{ when: ownTurn(), message: '只能在你的回合打出' }],
  abilities: [{
    kind: 'played',
    fast: true,
    label: '选择手牌法术/守护支援放置入场；轮末洗回牌库',
    resolve: ({ inv, api }) => {
      const cards = [...new Set((inv.hand || []).filter(code => ALL_CARDS[code]
        && ALL_CARDS[code].type === 'asset' && matches(code)))]
      if (!cards.length) {
        api.info('手牌里没有法术或守护支援。')
        return
      }
      const options = cards.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))
      const chosen = cards.length === 1 ? cards[0] : api.choice({
        kind: 'card', source: '60465', seat: inv.seat,
        prompt: '选择要放置入场的法术/守护支援。', options,
      })
      const code = cards.includes(chosen) ? chosen : cards[0]
      const placed = api.putIntoPlay(inv.seat, code)
      if (!placed) {
        api.info(`「${api.cardName(code)}」无法放置入场。`)
        return
      }
      // 轮末把这张支援洗回牌库（实例级读点：turn.js#runMythos 的轮末段）。
      api.markAssetRoundEndReturn(placed, 'deck')
      api.info(`「镜像形态」：将「${api.cardName(code)}」放置入场；轮末若仍在场则洗回牌库。`)
    },
  }],
}
