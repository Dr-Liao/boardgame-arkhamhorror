// 05159 险中求胜
// 卡面：[reaction]在你发动技能检定时，横置险中求胜：此次检定的难度提升2点。
// 获得2资源或抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：时机挂在 testBegins 窗口（05048 同一通道）。难度提升 2 点写在引擎的 difficultyReduction
// 账本上（tests.js 在判定前统一用 difficulty - difficultyReduction），因此 -2 = 难度 +2；
// 奖励二选一走 api.choice + gainResources/drawCards。

export default {
  code: '05159',
  abilities: [
    {
      kind: 'reaction', trigger: 'testBegins',
      label: '横置：本次检定难度 +2；获得 2 资源或抽 1 张牌',
      criteria: [({ inv, context }) => context?.seat === inv.seat],
      cost: { exhaust: true },
      resolve: ({ inv, api }) => {
        // 引擎只有「降低难度」的包装；同一份 difficultyReduction 账本用负数表达提高难度
        // （tests.js：difficulty = difficulty - difficultyReduction）。
        api.reduceTestDifficulty(-2)
        const answer = api.choice({ kind: 'effect', source: '05159', seat: inv.seat,
          prompt: '险中求胜：获得 2 资源，或抽 1 张牌。',
          options: [{ id: 'resources', label: '获得 2 资源' }, { id: 'draw', label: '抽 1 张牌' }] })
        if (answer === 'draw') api.drawCards(inv.seat, 1)
        else api.gainResources(inv.seat, 2)
        api.info(`险中求胜：本次检定难度 +2；${inv.name} ${answer === 'draw' ? '抽 1 张牌' : '获得 2 资源'}。`)
      },
    },
  ],
  modifiers: [],
}
