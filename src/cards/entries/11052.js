import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11052',
  abilities: [
    {
      kind: 'reaction', trigger: 'testInitiated', cost: { exhaust: true },
      label: '尝试躲避时横置：技能值 +1、敌人获得警戒；成功则抽 1 张并保持交战',
      criteria: [ownSeat(), ({ context }) => context.actionKind === 'evade' && context.testTarget?.kind === 'enemy'],
      resolve: ({ api, context }) => {
        api.addPendingTestBonus(1)
        api.configureEvadeTest({ keepEngaged: true, alert: true, drawOnSuccess: 1 }, context)
      },
    },
  ],
}
