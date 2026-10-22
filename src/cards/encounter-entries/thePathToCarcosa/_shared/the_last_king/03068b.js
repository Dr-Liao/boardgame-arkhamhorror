// 03068b 塞巴斯蒂安·莫罗（附身）
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：the_last_king
// 卡面：猎手。反击。
// 卡面：塞巴斯蒂安·莫罗的攻击不能被取消。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 塞巴斯蒂安·莫罗（附身，03068b）：该敌人的攻击不能被取消。

export default {
  code: '03068b', scope: 'enemy', implemented: true,
  name: '塞巴斯蒂安·莫罗（附身）',
  text: '该敌人的攻击不能被取消。',
  enemyRule: { attacksCannotBeCancelled: true },
}
