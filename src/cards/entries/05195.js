// 05195 恐怖图腾：投入后增加一个已有图标。检定失败时将所选副本送回手牌。
import { addChosenCommitmentIcon } from './_shared.js'

export default {
  code: '05195',
  abilities: [
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '横置：投入的卡牌再获得 1 个技能图标；检定失败则该卡返回手牌',
      cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const commitment = addChosenCommitmentIcon(state, inv, api, '05195')
        if (commitment) api.returnCommitmentOnFailure(commitment)
      },
    },
  ],
}
