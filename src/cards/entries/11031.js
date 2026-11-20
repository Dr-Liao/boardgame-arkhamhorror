import { ownSeat, ownTurn } from '../../engine/matcher.js'
import { enumerateTargets } from '../../engine/targets.js'

const code = '11031'
const target = {
  kind: 'enemy',
  query: ({ entity, canDamageEnemy }) => canDamageEnemy(entity, code),
}
const availableTargets = (state, inv) => enumerateTargets(state, inv, target, { source: { code } })

export default {
  code,
  playCondition: [ownTurn(), ({ state, inv }) => availableTargets(state, inv).length > 0],
  abilities: [
    {
      kind: 'played', fast: true, label: '对同地点的一个敌人造成 1 伤害',
      resolve: ({ state, inv, api }) => {
        const targets = availableTargets(state, inv)
        if (!targets.length) return
        const id = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'enemy', source: code, seat: inv.seat, prompt: '选择要造成 1 点伤害的敌人。',
          options: targets.map(({ id, label }) => ({ id, label })),
        })
        const enemy = targets.find(item => item.id === id)?.entity
        if (enemy) api.damageEnemy(enemy, 1, inv.seat, code)
      },
    },
    {
      kind: 'reaction', trigger: 'cardDrawn', fromHand: true, noPlayCost: true,
      label: '刚抽到此牌：少花费 2 资源打出',
      limit: { scope: 'perWindow', owner: 'investigator' },
      criteria: [ownSeat(), ownTurn(), ({ state, inv, context, helpers }) => context.cardCode === code
        && availableTargets(state, inv).length > 0
        && (context.handIndex == null || inv.hand[context.handIndex] === code)
        && helpers.availablePlayResources(helpers.cardDef(code)) >= Math.max(0, helpers.playCost(code) - 2)],
      resolve: ({ inv, context, api }) => api.playAsEffect(inv.seat, code, {
        discount: 2, grantedEvent: true, handIndex: context.handIndex,
      }),
    },
  ],
}
