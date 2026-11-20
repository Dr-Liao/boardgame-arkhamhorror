import { attackableEnemies } from './_shared.js'

const code = '11082'
const fight = {
  kind: 'action',
  countsAs: 'fight',
  label: '攻击（战斗 +1）；成功时可弃 1 手牌，使这次攻击伤害 +1',
  target: { kind: 'enemy', query: ({ state, inv, entity }) => attackableEnemies(state, inv).includes(entity) },
  resolve: ({ inv, source, target, api }) => api.fight(inv.seat, target.id, {
    noSpend: true,
    assetId: source.handAbilityIndex == null ? source.id : undefined,
    sourceCode: code,
    combatBonus: 1,
    onSuccess: ({ opts }) => {
      if (api.chooseOptionalHandDiscard(inv.seat, code)) opts.damageBonus = (opts.damageBonus || 0) + 1
    },
  }),
}

export default {
  code,
  abilities: [
    { ...fight, cost: { action: true, exhaust: true } },
    { ...fight, fromHand: true, cost: { action: true, discardSelf: true } },
  ],
}
