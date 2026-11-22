// 52025 黛安娜·迪瓦恩（支援面 · 重返最后的王者）
// 归属：关卡专用 · returnToTheLastKing（重返卡尔克萨之路 · 最后的王者）
// 遭遇组：return_to_the_last_king
// 卡面：位于黛安娜所在地点的调查员不能发现或取得线索。
//       强制 - 敌军阶段开始时：移动到线索最少的[[旁人]]支援所在地点（如可能）。
//
// 行为读点：assetRule.blocksCluesHere / movesToFewestClueBystander，
// 由本章 behavior.canDiscoverClues / enemyPhaseStart 读取。
export default {
  code: '52025',
  name: '黛安娜·迪瓦恩',
  scope: 'storyAsset',
  assetRule: {
    blocksCluesHere: true,
    movesToFewestClueBystander: true,
  },
}
