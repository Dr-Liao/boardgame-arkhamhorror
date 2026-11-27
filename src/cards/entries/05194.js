// 05194 恐怖图腾：投入后增加一个已有图标。检定成功时由执行者抽牌。
import { addChosenCommitmentIcon } from './_shared.js'

export default {
  code: '05194',
  abilities: [
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '横置：投入的卡牌再获得 1 个技能图标；检定成功则执行者抽 1 张',
      cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api }) => {
        if (!addChosenCommitmentIcon(state, inv, api, '05194')) return
        api.addExtraOnSuccess({ type: 'draw', amount: 1 })
        api.info('本次检定成功时，执行检定的调查员抽取 1 张牌。')
      },
    },
  ],
}
