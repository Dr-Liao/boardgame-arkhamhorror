import { attackableEnemies } from './_shared.js'
import { registeredEntry } from '../../engine/ability.js'
import { availableUseCost } from '../../engine/use-transfer.js'

const code = '11064'

export default {
  code, uses: 12, usesType: 'ammo',
  abilities: [
    {
      kind: 'action', countsAs: 'fight', cost: { action: true },
      label: '花费 1–6 弹药攻击：战斗 +X，以同地点敌人战斗总值为难度，成功分配 X 点伤害',
      criteria: ({ state, source }) => source != null && availableUseCost(state, source, registeredEntry) > 0,
      target: { kind: 'enemy', query: ({ state, inv, entity }) => attackableEnemies(state, inv).includes(entity) },
      resolve: ({ inv, source, targetId, api }) => {
        const available = Math.min(6, api.availableUses(source))
        if (!available) return
        const amount = available === 1 ? 1 : Number(api.choice({
          kind: 'amount', source: code, seat: inv.seat, prompt: '为这次攻击花费多少弹药？',
          options: Array.from({ length: available }, (_, index) => ({
            id: String(index + 1), label: `花费 ${index + 1} 弹药`,
          })),
        }))
        if (!api.spendUses(source, amount, { allowSubstitution: true })) return
        api.fight(inv.seat, targetId, {
          assetId: source.id, sourceCode: code, combatBonus: amount,
          difficultyMode: 'sumAtLocation', distributedDamage: amount, noSpend: true, trackAssetSource: true,
        })
      },
    },
  ],
}
