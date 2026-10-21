// 04307 纳克特手稿
// 卡面：使用(3秘密)。
// 卡面：[reaction]在你所在地点的一位调查员将要在显现效果期间执行一次技能检定时，花费1秘密：本次检定不揭示混乱标记。
// 卡面：[action]花费1秘密：选择你所在地点的一位调查员。该调查员在本轮下次执行技能检定时不揭示混乱标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04307 潘诺蒂克启示录：主动能力（花 1 秘密）+ 显现检定前的强制跳过（消耗秘密）。

export default {
  code: '04307',
  uses: 3,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action', label: '花费 1 秘密：本回合该调查员下次检定不揭示标记',
      cost: { action: false, uses: 1 },
      // Phase 5（5c-12）：不再走 tfaPlayer 逃生原语。
      resolve: ({ inv, api }) => { api.skipNextTestTokens(inv.seat) },
    },
    {
      kind: 'reaction', trigger: 'revelationTest', id: 'pnakoticRevelation', legacyReaction: true,
      label: '显现检定前跳过', cost: { uses: 1 },
      resolve: ({ api }) => { api.skipTestTokens() },
    },
  ],
  modifiers: [

  ],
}
