import { ALL_CARDS } from '../cards-data.js'

const code = '90008'

export default {
  code,
  kind: 'investigator',
  elderSign: {
    resolve: ({ inv, api }) => {
      const candidates = [...new Set(inv.discard)].filter(cardCode => {
        const level = ALL_CARDS[cardCode]?.xp
        return Number.isFinite(level) && level >= 0 && level <= 2
      })
      if (candidates.length) {
        const selected = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: code, seat: inv.seat, prompt: '选择一张弃牌取回手牌。',
          options: candidates.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
        })
        if (candidates.includes(selected)) api.moveCard({ code: selected, from: 'discard', to: 'hand', ownerSeat: inv.seat })
      }
      return { delta: 1 }
    },
  },
  abilities: [{
    kind: 'free', limit: { scope: 'perRound', owner: 'investigator' }, label: '选择押注资源并检定',
    resolve: ({ inv, api }) => {
      const maximum = Math.min(3, api.availableResources(inv))
      const wager = maximum === 0 ? 0 : Number(api.choice({
        kind: 'resource', source: code, seat: inv.seat, prompt: '选择花费的资源数。',
        options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount} 资源` })),
      }))
      if (!Number.isSafeInteger(wager) || wager < 0 || wager > maximum
        || (wager > 0 && api.spendResources(inv.seat, wager) !== wager)) return
      api.test(inv.seat, null, wager, {
        baseValue: 3,
        iconWeights: { agility: 1, wild: 1, wildMinus: -1 },
        source: { type: 'effect', code, label: '资源押注' },
        resolve: result => { if (result.success && wager) api.gainResources(inv.seat, 2 * wager) },
      })
    },
  }],
}
