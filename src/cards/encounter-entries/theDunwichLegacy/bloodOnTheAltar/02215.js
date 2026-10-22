// 02215 密室的钥匙
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：显现 - 控制密室的钥匙。
// 卡面：[free]如果隐藏密室与你所在地点连接：将密室的钥匙附属到隐藏密室。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02215', scope: 'storyAsset',
  assetRule: { chamberKey: true },
  onFound(state, inv, api) { api.giveAsset(inv.seat, '02215') },
}
