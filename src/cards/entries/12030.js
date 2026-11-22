// 12030 多萝西·西蒙斯
// 卡面：你得到+1[intellect]。
// 卡面：[reaction]你成功调查，且超过难度正好1点或3点后，横置[多萝西·西蒙斯]：获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · +1[intellect] = modifiers 的 skill:intellect（statPipeline 统一叠加）；
//   · 「调查成功后」= investigateSuccess 窗口（src/engine/actions.js#runInvestigate 派发，
//     context 带 seat/location/successBy；与 08086/08104 同一读点）；
//   · 「超过难度正好 1 点或 3 点」= context.successBy；ownSeat() 限定本人；
//   · 横置费用 = cost.exhaust；获益走 api.gainResources。

import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

export default {
  code: '12030',
  modifiers: [
    skillModifier('intellect', 1),
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'investigateSuccess',
      label: '成功调查且超过难度正好 1 或 3 点后，横置本牌：获得 1 资源',
      criteria: [
        ownSeat(),
        ({ context }) => [1, 3].includes(context?.successBy),
      ],
      cost: { exhaust: true },
      resolve: ({ inv, context, api }) => {
        api.gainResources(inv.seat, 1)
        api.info(`${inv.name} 成功调查（超过难度 ${context?.successBy} 点），横置「多萝西·西蒙斯」获得 1 资源。`)
      },
    },
  ],
}
