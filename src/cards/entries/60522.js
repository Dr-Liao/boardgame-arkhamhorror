import { attackableEnemies } from './_shared.js'

export default {
  code: '60522',
  uses: 3,
  usesType: 'ammo',
  abilities: [{
    kind: 'action',
    countsAs: 'fight',
    label: '花费 1 弹药攻击：战斗 +2、伤害 +1。若失败，补回 1 弹药，本轮内下次使用时战斗 +3',
    cost: { action: true, uses: 1 },
    criteria: ({ helpers }) => !helpers.capabilityBlocked('fight'),
    target: { kind: 'enemy', query: ({ state, inv, entity, helpers }) =>
      !helpers.entityRuleActive(entity, 'cannot:beAttacked') && attackableEnemies(state, inv).includes(entity) },
    resolve: ({ api, inv, source, target }) => {
      const bonus = api.effects().find(effect => effect.sourceInstanceId === source.id && effect.sourceCode === source.code)
      if (bonus) api.consumeEffect(bonus.id)
      const result = api.fight(inv.seat, target.id, {
        assetId: source.id,
        combatBonus: bonus ? 3 : 2,
        damageBonus: 1,
        noSpend: true,
      })
      if (result?.success === false && !result.failureEffectsCancelled && inv.assets.includes(source)) {
        api.addUses(source, 1)
        api.addEffect({
          sourceCode: source.code,
          sourceInstanceId: source.id,
          controllerSeat: inv.seat,
          duration: 'endOfRound',
          label: '本轮下次使用这件支援攻击时，额外获得 +1 战斗',
        })
      }
    },
  }],
}
