// 05151 爱丽丝·洛克斯雷
// 卡面：你得到+1[intellect]。
// 卡面：[reaction]在你发现线索后，横置爱丽丝·洛克斯雷：对你所在地点的一个敌人造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：+1 智识走修正管线；反应挂 clueDiscovered 窗口（02061 同一窗口），
// 目标在 resolve 里选（反应窗口没有 legalMoves 的目标预选，05005 同一写法）。

import { skillModifier } from './_shared.js'

export default {
  code: '05151',
  modifiers: [
    skillModifier('intellect', 1),
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'clueDiscovered',
      label: '横置：对同地点一个敌人造成 1 点伤害',
      criteria: [({ inv, context }) => context?.seat === inv.seat],
      cost: { exhaust: true },
      resolve: ({ state, inv, api }) => {
        const enemies = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.defeated)
        if (!enemies.length) { api.info('所在地点没有敌人。'); return }
        const chosen = enemies.length === 1 ? enemies[0].id
          : api.choice({ kind: 'target', source: '05151', seat: inv.seat,
            prompt: '爱丽丝·洛克斯雷：选择要造成 1 点伤害的敌人。',
            options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = enemies.find(item => item.id === chosen) || enemies[0]
        api.damageEnemy(enemy, 1, inv.seat, '05151')
        api.info(`爱丽丝·洛克斯雷对「${enemy.name}」造成 1 点伤害。`)
      },
    },
  ],
}
