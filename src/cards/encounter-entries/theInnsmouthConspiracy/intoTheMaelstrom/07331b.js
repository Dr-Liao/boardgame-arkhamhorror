// 07331b 海德拉（苏醒狂怒）· 暗潮之下
//
// 印刷（中文）：
//   猎手。庞大。反击。
//   每有一个[[圣堂]]地点上有钥匙，海德拉得到 -1 攻击。
//   强制 - 躲避海德拉或对海德拉造成伤害后：对场上一张海德拉的子嗣也执行相同的操作。
//
// 与 07330b 同句规则，共用 _shared.js 的苏醒面工厂；差异只有名字与子嗣卡号。

import { awakenedAncientOneEntry } from '../../_shared.js'

export default awakenedAncientOneEntry({
  code: '07331b',
  name: '海德拉',
  broodCode: '07334',
  broodName: '海德拉的子嗣',
})
