// 12054 妙手空空（Sticky Fingers）· 资产 · 游荡者 2 经验 · 费用 1
// 卡面：快速。每位调查员仅限 1 张。
// 卡面：[reaction]你成功躲避敌人后，横置妙手空空：获得 1 资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Asset/Assets/StickyFingers2.hs（与 0 经验版同一句能力，另加 fast + 等级 2）。
// 读点：reaction + trigger 'evadeSuccess' + ownSeat 筛选 → ctx.api.gainResources；费用 exhaust 由描述子扣除。
//   fast 是条目级关键字（cardPlayFlag 读点，打出不耗行动）；limitPerInvestigator 为构筑限制读点。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '12054',
  fast: true,
  limitPerInvestigator: true,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'evadeSuccess',
      label: '躲闪成功后横置：获得 1 资源',
      criteria: [ownSeat()],
      cost: { exhaust: true },
      resolve: ({ inv, api }) => api.gainResources(inv.seat, 1),
    },
  ],
  modifiers: [],
}
