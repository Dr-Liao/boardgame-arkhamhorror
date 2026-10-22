// 03112 大卫·伦费尔德
// 卡面：大卫·伦费尔德身上有至少1个毁灭标记时，你得到+1[willpower]。
// 卡面：[free]横置大卫伦费尔德：你可以在大卫·伦费尔德身上放置1个毁灭标记。大卫·伦费尔德身上每有一个毁灭标记，获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03112 大卫·伦菲尔德：+1 意志（本卡有毁灭时）；横置：在本卡放 1 毁灭并获得等量资源。

import { skillModifier } from './_shared.js'

export default {
  code: '03112',
  modifiers: [
    skillModifier('willpower', 1, { sourceDoomAtLeast: 1 }),
  ],
  abilities: [
    {
      kind: 'free', label: '放置 1 毁灭并获得等量资源', cost: { action: false, exhaust: true },
      resolve: ({ source, inv, api }) => {
        if (!source) return
        // 「你可以」：可以选择不放毁灭，仍然按现有毁灭数获得资源。
        const answer = api.choice({ kind: 'effect', source: '03112', seat: inv.seat,
          prompt: '是否在大卫·伦费尔德身上放置 1 个毁灭标记？',
          options: [{ id: 'yes', label: '放置 1 毁灭' }, { id: 'no', label: '不放置' }] })
        if (answer === 'yes') api.placeDoomOnCard(source, 1)
        api.gainResources(inv.seat, source.doom || 0)
      },
    },
  ],
}
