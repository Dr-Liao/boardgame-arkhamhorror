// 01121b 假面猎手
// 归属：关卡专用 · theMidnightMasks（夜之狂热 · 第二幕：午夜假面）
// 遭遇组：arkham
// 卡面：生成 - 与猎物交战。
// 卡面：猎物 - 线索最多。
// 卡面：猎手。
// 卡面：每有一位调查员，假面猎手得到+2生命。
// 卡面：你与假面猎手交战时，不能发现或花费线索。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 假面猎手（01121b）：交战时不能发现或花费线索。

export default {
  code: '01121b',
  name: '假面猎手',
  scope: 'enemy',
  text: '你与假面猎手交战时，不能发现或花费线索。',
  enemyRule: { blocksCluesWhileEngaged: true, blocksCluesMessage: '蒙面猎手' },
}
