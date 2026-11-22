// 12048 妙手空空（Sticky Fingers）· 资产 · 游荡者 0 经验 · 费用 1
// 卡面：每位调查员仅限 1 张。
// 卡面：[reaction]你成功躲避敌人后，横置妙手空空：获得 1 资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Asset/Assets/StickyFingers.hs
//   （controlled a 1 (youExist can.gain.resources) (triggered (EnemyEvadedSuccessfully #after You ...) (exhaust a))）。
// 读点：reaction + trigger 'evadeSuccess'（reactionWindow 派发），criteria ownSeat 保证只响应本人躲避成功；
//   费用 exhaust 由描述子 cost 统一扣除；resolve 走 ctx.api.gainResources。
// 「每位调查员仅限 1 张」是构筑限制，读点是 limitPerInvestigator（play-condition.js#playAccess）。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '12048',
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
