import { enemyBody } from '../../engine/enemy-parts.js'

const code = '52013'

export default {
  code,
  hiddenRule: { playerWeakness: true, scenarioXpModifier: -2 },
  abilities: [
    {
      kind: 'weakness',
      label: '将弱点秘密加入手牌',
      weakness: { type: 'hidden' },
      resolve: ({ inv, api }) => api.placeHiddenWeakness(inv.seat, code),
    },
    {
      kind: 'action',
      fromHand: true,
      noPlayCost: true,
      countsAs: 'evade',
      label: '躲避一个已横置且未交战的敌人，成功后弃置',
      criteria: [({ inv }) => inv.hiddenCards?.includes(code)],
      target: { kind: 'enemy', query: ({ state, entity, enemyEvade }) => {
        const body = enemyBody(state, entity)
        return body.exhausted === true && body.engagedSeat == null && enemyEvade(entity) != null
      } },
      resolve: ({ inv, target, api }) => {
        const result = api.evade(inv.seat, { enemyId: target.id, ignoreEngagement: true })
        if (result?.success) api.discardHiddenWeakness(inv.seat, code)
      },
    },
  ],
}
