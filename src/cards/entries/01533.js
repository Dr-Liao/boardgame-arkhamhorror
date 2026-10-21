// 01533 米兰·克里斯托弗博士
// 卡面：你得到+1[intellect]。
// 卡面：[reaction]在你成功调查后：获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01533 米兰·克里斯托弗博士：+1 智识；[反应]成功调查后获得 1 资源。

import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

export default {
  code: '01533',
  modifiers: [
    skillModifier('intellect', 1),
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'investigateSuccess', label: '获得 1 资源',
      criteria: [ownSeat()],
      resolve: ({ inv, api }) => api.gainResources(inv.seat, 1),
    },
  ],
}
