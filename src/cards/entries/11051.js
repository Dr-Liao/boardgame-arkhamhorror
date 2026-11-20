import { skillModifier } from './_shared.js'

const code = '11051'
const fight = { ignoreCosts: true, countsAs: 'fight' }
const oneHandedFirearm = card => card?.type === 'asset'
  && card.traits?.some(trait => trait.toLowerCase() === 'firearm')
  && (card.slots || []).reduce((total, slot) => total + (slot === 'Hand' ? 1 : slot === 'Hand x2' ? 2 : 0), 0) <= 1

export default {
  code,
  modifiers: [skillModifier('combat', 1)],
  abilities: [
    {
      kind: 'action', noOpportunityAttack: true, cost: { action: true, exhaust: true },
      label: '横置并弃掉手中一把最多占一只手的枪械：忽略所有费用发动其攻击能力',
      criteria: ({ inv, helpers }) => inv.hand.some(card => oneHandedFirearm(helpers.cardDef(card))
        && helpers.cardAbilityOptions(card, fight).length > 0),
      resolve: ({ inv, api }) => {
        const candidates = [...new Set(inv.hand)].filter(card => oneHandedFirearm(api.cardDef(card))
          && api.cardAbilityOptions(inv.seat, card, fight).length > 0)
        if (!candidates.length) return
        const firearm = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: code, seat: inv.seat, prompt: '选择要弃掉的枪械。',
          options: candidates.map(id => ({ id, label: api.cardName(id), cardCode: id })),
        })
        if (!candidates.includes(firearm) || !api.discardFromHand(inv.seat, firearm)) return
        const abilities = api.cardAbilityOptions(inv.seat, firearm, fight)
        if (!abilities.length) return
        const id = abilities.length === 1 ? String(abilities[0].index) : api.choice({
          kind: 'effect', source: code, seat: inv.seat, prompt: '选择这把枪械上要发动的攻击能力。',
          options: abilities.map(({ index, label }) => ({ id: String(index), label })),
        })
        if (abilities.some(item => String(item.index) === id)) {
          api.resolveCardAbility(inv.seat, firearm, { ...fight, abilityIndex: Number(id) })
        }
      },
    },
  ],
}
