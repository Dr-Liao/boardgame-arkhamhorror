// 09127 恐怖异灵（Ectoplasmic Horror）· 基础弱点 · 敌人
// 卡面：[mystic] 调查员专用。
//       猎手。
//       你攻击或尝试躲避恐怖异灵，第一次揭示混乱标记时，你每有一个法术槽位无支援，
//       额外揭示一个混乱标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 敌人型弱点：scope:'enemy'，由 resolveWeakness 的 enemy 分支在本地点生成并交战；
//     关键词来自条目级 enemyWeakness（card-lookup.js#enemyDef）；
//   · 额外揭示：testBegins 窗口登记额外揭示，由检定的揭示管线处理，
//     所有额外标记都参与本次检定。
const code = '09127'

export default {
  code,
  scope: 'enemy',
  enemyWeakness: { hunter: true },
  abilities: [
    {
      kind: 'forced',
      trigger: 'testBegins',
      silent: true,
      label: '攻击/躲避恐怖异灵首次揭示标记时：每个空法术槽额外揭示 1 个标记',
      criteria: [({ state, inv, source }) => {
        const test = state.skillTest
        if (!test || test.seat !== inv.seat) return false
        if (!['fight', 'evade'].includes(test.actionKind)) return false
        return Boolean(source) && (test.target?.id ?? test.source?.enemyId) === source.id
      }],
      resolve: ({ inv, api }) => {
        const empty = api.emptyAssetSlots(inv.seat, 'arcane')
        if (!empty) return
        for (let i = 0; i < empty; i++) api.playerTools.revealAdditionalTestToken()
        api.info(`👻 「恐怖异灵」：${inv.name} 有 ${empty} 个空法术槽，额外揭示 ${empty} 个混乱标记。`)
      },
    },
  ],
  modifiers: [],
}
