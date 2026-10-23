// 05048 瓦伦蒂诺·里瓦斯（序章故事调查员）
// 卡面：[free]在你执行的技能检定期间，花费2资源：本次检定难度降低1点。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+1。获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 这是「检定期间」的触发能力：挂在引擎的 testBegins 反应窗口上（检定开始、投入之前），
// 读点是 openAbilityWindow 的 reaction 通道；降低难度的 api 是 reduceTestDifficulty。
// （调查员卡自己的 free 能力目前没有枚举点——legalMoves/playerWindow 只枚举场上支援，
//   因此这里用同一时机的反应通道，行为等价且不新增引擎分支。）

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05048')

export default {
  code: '05048',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '05048-eldersign',
    label: '旧印：+1，获得 2 资源',
    resolve: ({ inv, api }) => {
      api.gainResources(inv.seat, 2)
      return { delta: Number(sign.bonus ?? 1) }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testBegins',
      label: '花 2 资源：本次检定难度 -1',
      cost: { resources: 2 },
      limit: 'oncePerRound',
      criteria: [({ inv, context }) => context?.seat === inv.seat && Number.isFinite(context?.difficulty)],
      resolve: ({ inv, api }) => {
        api.reduceTestDifficulty(1)
        api.info(`${inv.name} 花费 2 资源，本次检定难度 -1。`)
      },
    },
  ],
  modifiers: [],
}
