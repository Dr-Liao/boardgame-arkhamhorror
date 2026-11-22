import { attackableEnemies } from './_shared.js'

const cluesHere = (state, inv) => state.locations.find(location => location.id === inv.location)?.clues || 0

export default {
  code: '90030',
  uses: 4,
  usesType: 'ammo',
  abilities: [{
    kind: 'action', countsAs: 'fight',
    label: '射击：战斗 +2（有线索时 +4），伤害 +1；无线索时击败敌人补 1 子弹',
    cost: { uses: 1 },
    criteria: [({ helpers }) => !helpers.capabilityBlocked('fight')],
    target: { kind: 'enemy', query: ({ state, inv, entity, helpers }) =>
      !helpers.entityRuleActive(entity, 'cannot:beAttacked') && attackableEnemies(state, inv).includes(entity) },
    resolve: ({ state, inv, source, targetId, api }) => {
      const result = api.fight(inv.seat, targetId, {
        assetId: source.id, combatBonus: cluesHere(state, inv) ? 4 : 2, damageBonus: 1, noSpend: true,
      })
      if (result?.attackResult?.defeated && cluesHere(state, inv) === 0 && inv.assets.includes(source)) {
        api.addUses(source, 1)
      }
    },
  }],
}
