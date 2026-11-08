// 08029 提尔斯哈之牙
// 卡面：攻击。选择任何已揭示地点的一个敌人作为本次攻击的目标。在结算本次攻击前，
//       你可以移动到该敌人的地点。本次攻击你的[combat]加上你的[agility]。本次攻击造成 +3 伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径与偏差：doFight 只允许攻击同地点（或声明连接地点）的敌人，因此这里按「选择任意已揭示
// 地点的敌人 → 若不同地点则移动到该地点 → addSkill:'agility'、damageBonus:3 攻击」实现。
// 卡面的「可以移动」在本实现中是强制的（不移动则无法完成远程攻击）；作为 approximation 记录。
import { attackableEnemies } from './_shared.js'

export default {
  code: '08029',
  abilities: [
    {
      kind: 'played',
      countsAs: 'fight',
      noOpportunityAttack: true,
      label: '攻击任意已揭示地点的一个敌人；攻击前可移动到其地点；加入[agility]，+3 伤害',
      resolve: ({ state, inv, api }) => {
        const targets = (state.enemies || []).filter(enemy => {
          const location = (state.locations || []).find(item => item.id === enemy.location)
          return location?.revealed === true
        })
        if (!targets.length) {
          api.info('没有已揭示地点上的敌人可攻击。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: '08029', seat: inv.seat,
          prompt: '提尔斯哈之牙：选择任何已揭示地点的一个敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${api.locName(enemy.location)}）` })),
        })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        if (enemy.location !== inv.location) {
          api.moveInvestigator(inv.seat, enemy.location)
          // api.moveInvestigator 无返回值；用移动后的实际位置确认是否到达。
          if (inv.location !== enemy.location) {
            api.info('无法移动到该敌人的地点。')
            return
          }
        }
        api.fight(inv.seat, enemy.id, {
          addSkill: 'agility', damageBonus: 3, noSpend: true,
          sourceCode: '08029', presentationCardCode: '08029',
        })
      },
    },
  ],
  modifiers: [],
}
