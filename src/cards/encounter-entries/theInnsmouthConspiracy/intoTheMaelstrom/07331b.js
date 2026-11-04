// 07331b 海德拉（苏醒狂怒面）· 进入漩涡
//
// 印刷（中文）：
//   猎手。庞大。反击。
//   每有一个[[圣堂]]地点上有钥匙，海德拉得到-1攻击。
//   强制 - 躲避海德拉或对海德拉造成伤害后：对场上一张海德拉之子也执行相同的操作。
//
// 与 07330b 达贡逐字同文：规则写在 _shared.js 的 awakenedAncientOneEntry 里，这里只换归属数据。

import { awakenedAncientOneEntry } from '../../_shared.js'

export default awakenedAncientOneEntry({
  code: '07331b',
  broodCode: '07334', // 海德拉之子
  mirrorLabel: '躲避海德拉或对海德拉造成伤害后：对场上一张海德拉之子也执行相同的操作',
})
