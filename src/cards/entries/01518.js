// 01518 巡警
// 卡面：你得到+1[combat]。
// 卡面：[free]弃掉巡警：对你所在地点的1个敌人造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01518 巡警：+1 战斗；[免费]弃掉：对同地点 1 个敌人造成 1 点伤害。
// Phase 1（B1）：目标枚举由描述子声明，没有敌人时这条能力不再出现在合法动作里。

import { skillModifier } from './_shared.js'

export default {
  code: '01518',
  modifiers: [
    skillModifier('combat', 1),
  ],
  abilities: [
    {
      kind: 'free', label: '弃掉：对同地点 1 个敌人造成 1 点伤害',
      cost: { discardSelf: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, target, api }) => {
        if (target) api.damageEnemy(target.entity, 1, inv.seat)
      },
    },
  ],
}
