// 07330b 达贡（苏醒狂怒）· 暗潮之下
//
// 印刷（中文）：
//   猎手。庞大。反击。
//   每有一个[[圣堂]]地点上有钥匙，达贡得到 -1 攻击。
//   强制 - 躲避达贡或对达贡造成伤害后：对场上一张达贡的子嗣也执行相同的操作。
//
// 猎手/庞大/反击由印刷文本在遭遇定义阶段解析（见 content/.../card-data.js）；
// 攻击值修正与「对子嗣做同样的事」共用 _shared.js 的苏醒面工厂。

import { awakenedAncientOneEntry } from '../../_shared.js'

export default awakenedAncientOneEntry({
  code: '07330b',
  name: '达贡',
  broodCode: '07333',
  broodName: '达贡的子嗣',
})
