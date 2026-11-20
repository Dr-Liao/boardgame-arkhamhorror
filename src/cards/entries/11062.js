import { skillModifier } from './_shared.js'

const code = '11062'
const fight = { ignoreCosts: true, countsAs: 'fight' }
const oneHandedFirearm = card => card?.type === 'asset'
  && card.traits?.some(trait => trait.toLowerCase() === 'firearm')
  && (card.slots || []).reduce((total, slot) => total + (slot === 'Hand' ? 1 : slot === 'Hand x2' ? 2 : 0), 0) <= 1

export default {
  code,
  modifiers: [skillModifier('combat', 1)],
  abilities: [
    {
      kind: 'free', countsAs: 'fight', cost: { exhaust: true },
      label: '横置：展示手中最多占一只手的枪械，无费用发动其攻击能力，再决定是否弃掉抽牌或打出枪械',
      criteria: ({ inv, helpers }) => inv.hand.some(card => oneHandedFirearm(helpers.cardDef(card))
        && helpers.cardAbilityOptions(card, fight).length > 0),
      resolve: ({ inv, api }) => {
        const candidates = [...new Set(inv.hand)].filter(card => oneHandedFirearm(api.cardDef(card))
          && api.cardAbilityOptions(inv.seat, card, fight).length > 0)
        if (!candidates.length) return
        const firearm = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: code, seat: inv.seat, prompt: '选择要展示的枪械。',
          options: candidates.map(id => ({ id, label: api.cardName(id), cardCode: id })),
        })
        if (!candidates.includes(firearm)) return
        api.info(`${inv.name} 展示了手中的「${api.cardName(firearm)}」。`)
        const abilities = api.cardAbilityOptions(inv.seat, firearm, fight)
        if (!abilities.length) return
        const id = abilities.length === 1 ? String(abilities[0].index) : api.choice({
          kind: 'effect', source: code, seat: inv.seat, prompt: '选择这把枪械上要发动的攻击能力。',
          options: abilities.map(({ index, label }) => ({ id: String(index), label })),
        })
        if (!abilities.some(item => String(item.index) === id)
          || !api.resolveCardAbility(inv.seat, firearm, { ...fight, abilityIndex: Number(id) })
          || !inv.hand.includes(firearm)) return
        const options = [{ id: 'skip', label: '不执行' }, { id: 'discard', label: '弃掉这把枪械并抽 1 张牌' }]
        if (api.playHandCardOptions(inv.seat, { type: 'asset' }).includes(firearm)) {
          options.push({ id: 'play', label: '支付费用打出这把枪械' })
        }
        const after = api.choice({
          kind: 'effect', source: code, seat: inv.seat, canSkip: true,
          prompt: '可以弃掉这把枪械来抽牌，或支付费用打出它。', options,
        })
        if (after === 'discard' && api.discardFromHand(inv.seat, firearm)) api.drawCards(inv.seat, 1)
        if (after === 'play') api.playAsEffect(inv.seat, firearm)
      },
    },
  ],
}
