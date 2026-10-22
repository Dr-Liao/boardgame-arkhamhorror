// 04228 无路可退
// 归属：关卡专用 · heartOfTheEldersPart2（久远腹地（下））
// 遭遇组：knyan
// 卡面：显现 - 将无路可退附属到你所在地点或一个连接地点。每个地点仅限1张。
// 卡面：调查员不能进入或离开被附属地点。
// 卡面：[action]：检定[combat](3)或检查你的补给品。如果你检定成功，或你带有鹤嘴锄，弃掉无路可退。位于连接地点的任何调查员均可以激活此能力。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04228', scope: 'treachery', implemented: true, flags: { noTurningBack: true } }
