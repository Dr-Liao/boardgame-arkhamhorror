// 02140 死灵之书
// 卡面：你得到+1[intellect]。
// 卡面：[action]：获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02140 死灵之书：+1 智识；[行动]获得 2 资源。

import { skillModifier } from './_shared.js'

export default {
  code: '02140',
  modifiers: [
    skillModifier('intellect', 1),
  ],
  abilities: [
    {
      kind: 'action', label: '获得 2 资源',
      resolve: ({ inv, api }) => api.gainResources(inv.seat, 2),
    },
  ],
}
