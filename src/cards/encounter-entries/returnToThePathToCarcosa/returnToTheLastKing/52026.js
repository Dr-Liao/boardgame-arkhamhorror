// 52026 宴会宾客（重返最后的王者）
// 归属：关卡专用 · returnToTheLastKing（重返卡尔克萨之路 · 最后的王者）
// 遭遇组：return_to_the_last_king
// 卡面：显现 - 找出线索最多的[[旁人]]支援，将宴会宾客放到该支援所在地点。
//       位于宴会宾客所在地点的调查员不能与[[旁人]]支援谈判。
//       [action] 花费 2 资源：谈判。将宴会宾客移动到一个连接地点。
//
// 行为读点：assetRule.blocksParleyHere（本章 behavior.parleyBlocked）+
//           assetRule.moveToConnectedOnParley（本章 behavior.performAction 的谈判结算）。
export default {
  code: '52026',
  name: '宴会宾客',
  scope: 'storyAsset',
  assetRule: {
    blocksParleyHere: true,
    moveToConnectedOnParley: 'spendTwoResources',
    parleyActionLabel: '谈判：花费 2 资源，将宴会宾客移动到一个连接地点',
  },
}
