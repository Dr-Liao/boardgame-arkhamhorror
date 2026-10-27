// 02115 照明弹
// 卡面：选择一项：
// 卡面：- 攻击。本次攻击你得到+3[combat]并造成+2伤害。放逐照明弹。
// 卡面：- 查找任意调查员牌库顶9张卡牌，找出一个[[盟友]]支援并将其放置入场，放到你的控制之下。然后，放逐照明弹。混洗查找过的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02115 照明弹：第 122 轮从 player-effects.js 的 `flare` 分派搬进本文件。
//
// 2026-10-27 修复：战斗分支需要一名可攻击的敌人。旧实现无条件提供「战斗」选项，并用
// api.chooseEnemy(inv.seat, {}) 选目标——空 effect 在 abilityTargets 里没有任何候选，
// 会直接抛「没有合法敌人目标」；即使选中冷漠敌人也会在 api.fight 被拒绝后白弃这张牌。
// 现在「战斗」选项只在 attackableEnemies 非空时出现，目标也从同一份候选里选。
import { attackableEnemies } from './_shared.js'

export default {
  code: '02115',
  abilities: [
    {
      kind: 'played',
      label: '照明弹',
      exileAfterPlay: true,
      resolve: ({ state, inv, api }) => {
        const targets = attackableEnemies(state, inv)
        const options = [
          ...(targets.length ? [{ id: 'fight', label: '战斗 +3，伤害 +2' }] : []),
          { id: 'ally', label: '搜索任意调查员牌库顶 9 张并使一名盟友入场' },
        ]
        const choice = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: '02115', seat: inv.seat, prompt: '选择照明弹的效果。', options,
        })
        if (choice === 'fight') {
          const chosen = targets.length === 1 ? targets[0].id : api.choice({
            kind: 'target', source: '02115', seat: inv.seat, prompt: '选择攻击目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
          })
          const enemy = targets.find(item => item.id === chosen) || targets[0]
          if (enemy) api.fight(inv.seat, enemy.id, { combatBonus: 3, damageBonus: 2, noSpend: true })
          return
        }
        api.searchDeckIntoPlay(inv.seat, {
          amount: 9, trait: 'ally', source: '02115',
          ownerPrompt: '选择要搜索的牌库。',
          prompt: '选择要放置入场的盟友支援。',
        })
      },
    },
  ],
  modifiers: [

  ],
}
