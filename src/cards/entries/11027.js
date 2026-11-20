import { ownSeat } from '../../engine/matcher.js'
import { enumerateTargets } from '../../engine/targets.js'
import { skillModifier } from './_shared.js'

const code = '11027'
const enemyTarget = { kind: 'enemy', query: ({ entity, canDamageEnemy }) => canDamageEnemy(entity, code) }
const targetsAt = (state, inv) => enumerateTargets(state, inv, enemyTarget, { source: { code } })

export default {
  code,
  modifiers: [skillModifier('intellect', 1)],
  trackActionHistory: true,
  assetRule: { firstActionNoAoO: 'investigate' },
  abilities: [
    {
      kind: 'reaction', trigger: 'clueDiscovered', label: '发现线索后横置：对同地点的敌人造成 1 点伤害',
      cost: { exhaust: true },
      criteria: [ownSeat(), ({ state, inv }) => targetsAt(state, inv).length > 0],
      resolve: ({ state, inv, api }) => {
        const targets = targetsAt(state, inv)
        if (!targets.length) return
        const id = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'enemy', source: code, seat: inv.seat, prompt: '选择要造成 1 点伤害的敌人。',
          options: targets.map(({ id, label }) => ({ id, label })),
        })
        const target = targets.find(item => item.id === id)
        if (target) api.damageEnemy(target.entity, 1, inv.seat, code)
      },
    },
  ],
}
