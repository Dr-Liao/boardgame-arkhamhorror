// 04073 曲折小道
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：作为你在曲折小道调查或探索的额外费用，检查你们的补给品。如果你所在地点没有调查员带有指南针，你必须花费3资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
export default {
  code: '04073', scope: 'location',
  locationRule: {
    supplyActionCost: { actions: ['investigate', 'explore'], unlessSupply: 'compass', resources: 3 },
  },
}
