import { ALL_CARDS } from '../cards-data.js'
import { hasTrait } from '../../engine/matcher.js'

const code = '90001'
const tome = cardCode => ALL_CARDS[cardCode]?.type === 'asset' && hasTrait(ALL_CARDS[cardCode], 'Tome')
const tomes = inv => inv.assets.filter(asset => !asset.facedown && tome(asset.code))
const tomeCount = ({ inv }) => tomes(inv).length
const actionOptions = { actionOnly: true, ignoreActionCost: true }

export default {
  code,
  kind: 'investigator',
  investigator: { sanityBonus: tomeCount },
  modifiers: [{ target: 'skill:willpower', amount: tomeCount }],
  elderSign: {
    resolve: ({ inv, api }) => {
      const candidates = [...new Set(inv.discard.filter(tome))]
      if (candidates.length) {
        const selected = api.choice({ kind: 'card', source: code, seat: inv.seat, canSkip: true,
          prompt: '从弃牌堆取回一张书籍？', options: [
            { id: 'skip', label: '跳过' },
            ...candidates.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
          ] })
        if (candidates.includes(selected)) api.moveCard({ code: selected, from: 'discard', to: 'hand', ownerSeat: inv.seat })
      }
      return { delta: 1 }
    },
  },
  abilities: [{
    kind: 'free', limit: { scope: 'perGame', owner: 'investigator' }, label: '逐一结算场上书籍的一个行动能力',
    criteria: ({ inv, helpers }) => tomes(inv).some(asset => helpers.cardAbilityOptions(asset, actionOptions).length > 0),
    resolve: ({ inv, api }) => {
      const remaining = new Set(tomes(inv).map(asset => asset.id))
      while (remaining.size && !inv.defeated && !inv.resigned) {
        const offers = tomes(inv).filter(asset => remaining.has(asset.id))
          .flatMap(asset => api.cardAbilityOptions(inv.seat, asset, actionOptions).map(ability => ({
            id: `${asset.id}:${ability.index}`, asset, ability,
          })))
        if (!offers.length) break
        const selected = offers.length === 1 ? offers[0].id : api.choice({
          kind: 'effect', source: code, seat: inv.seat, prompt: '选择下一项书籍能力。',
          options: offers.map(({ id, asset, ability }) => ({
            id, cardCode: asset.code, label: `${api.cardName(asset.code)} · ${ability.label}`,
          })),
        })
        const picked = offers.find(offer => offer.id === selected)
        if (!picked) break
        remaining.delete(picked.asset.id)
        api.resolveAssetAction(inv.seat, { assetId: picked.asset.id, abilityIndex: picked.ability.index, waive: 'action' })
      }
    },
  }],
}
