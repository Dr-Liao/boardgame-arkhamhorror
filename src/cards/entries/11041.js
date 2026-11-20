import { ALL_CARDS } from '../cards-data.js'
import { aliveInvestigators } from '../../engine/matcher.js'

const CODE = '11041'

function playerOrder(state) {
  const players = aliveInvestigators(state)
  const lead = players.findIndex(player => player.seat === state.campaign?.leadSeat)
  return lead > 0 ? [...players.slice(lead), ...players.slice(0, lead)] : players
}

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    label: '选择奇数或偶数；依玩家顺序，各人可抽 1 张牌或付费打出一张符合的已揭示手牌',
    resolve: ({ state, inv, api }) => {
      const parity = Number(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择要揭示的印刷费用奇偶性。',
        options: [{ id: '0', label: '偶数' }, { id: '1', label: '奇数' }],
      }))
      const plans = playerOrder(state).map(player => ({
        player,
        revealed: player.hand.filter(code => {
          const card = ALL_CARDS[code]
          return card && !card.subtype && Number.isSafeInteger(card.cost) && card.cost >= 0 && card.cost % 2 === parity
        }),
      }))
      for (const { player, revealed } of plans) {
        const labels = revealed.map(code => api.cardName(code))
        if (labels.length) api.info(`${player.name} 揭示：${labels.join('、')}。`)
        else api.info(`${player.name} 没有符合所选费用奇偶性的手牌。`)
      }
      for (const { player, revealed } of plans) {
        if (player.defeated || player.resigned) continue
        const playable = [...new Set(revealed)].filter(code => api.canPlayAsEffect(player.seat, code))
        const options = [{ id: 'skip', label: '不执行' }]
        if (api.canDrawCards(player.seat)) options.push({ id: 'draw', label: '抽取 1 张牌' })
        options.push(...playable.map(code => ({ id: code, cardCode: code, label: `付费打出 ${api.cardName(code)}` })))
        if (options.length === 1) continue
        const picked = api.choice({
          kind: 'card', source: CODE, seat: player.seat, prompt: '选择抽牌或打出刚才揭示的一张手牌。',
          options,
        })
        if (picked === 'draw') api.drawCards(player.seat, 1)
        else if (playable.includes(picked)) api.playAsEffect(player.seat, picked)
      }
    },
  }],
}
