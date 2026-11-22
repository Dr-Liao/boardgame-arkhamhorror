// 60167 适应与克服（Adapt and Overcome）
// 卡面：只能投入到攻击或躲避期间的技能检定。执行检定的调查员本次检定期间忽略警戒和反击关键词。
// 读点：commit 描述子 commitCondition（limit 攻击/躲避检定）+ reaction trigger committedCard（tests.js 窗口）；
// 忽略关键词用 api.addEffect duration:endOfTest + ignore:alert/ignore:retaliate（modifiers.js capability 读点）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60167'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '只能投入攻击/躲避检定；本次检定忽略警戒与反击',
      skill: {
        commitCondition: ({ state }) => ['fight', 'evade'].includes(state.skillTest?.actionKind),
      },
    },
    {
      kind: 'reaction',
      trigger: 'committedCard',
      label: '投入后：本次检定忽略警戒与反击',
      criteria: [({ inv, context }) => context?.cardCode === CODE && context?.seat === inv.seat],
      resolve: ({ inv, api }) => api.addEffect({
        duration: 'endOfTest',
        sourceCode: CODE,
        controllerSeat: inv.seat,
        label: '适应与克服：忽略警戒与反击',
        modifiers: [{ target: 'ignore:alert' }, { target: 'ignore:retaliate' }],
      }),
    },
  ],
  modifiers: [],
}
