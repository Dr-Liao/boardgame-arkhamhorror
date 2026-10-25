// 05048 瓦伦蒂诺·里瓦斯（序章故事调查员）
// 卡面：[free]在你执行的技能检定期间，花费2资源：本次检定难度降低1点。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+1。获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// [free]「检定期间」：引擎现在把调查员自身的 free 描述子也送进玩家窗口
// （encounter.playerWindow 的 player-window-fast-actions 原语；执行入口 doFreeDescriptor），
// 技能检定内的两个玩家窗口时机是 test.beforeCommit（投入前）与 test.afterCommit（投入后、判定前），
// 两处都在 ST.6 统一扣减难度之前，因此 reduceTestDifficulty 都能生效。
// duringOwnSkillTest: true 保证只在本人执行的检定期间可选。

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
      kind: 'free',
      // 技能检定期间的玩家窗口（tests.js:182/347 的 playerWindow 调用点）。
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '花 2 资源：本次检定难度 -1',
      cost: { resources: 2 },
      limit: 'oncePerRound',
      resolve: ({ inv, api }) => {
        api.reduceTestDifficulty(1)
        api.info(`${inv.name} 花费 2 资源，本次检定难度 -1。`)
      },
    },
  ],
  modifiers: [],
}
