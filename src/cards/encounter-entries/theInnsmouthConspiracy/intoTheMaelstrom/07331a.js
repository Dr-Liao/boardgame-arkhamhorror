// 07331a 海德拉（深入沉睡）· 暗潮之下
//
// 印刷（中文）：
//   海德拉正在沉睡。她不能攻击，不能与调查员交战，免疫调查员行动和玩家卡牌效果。
//   强制 - 调查阶段结束时，如果一名调查员在海德拉巢穴且海德拉未横置：在海德拉上放置1个毁灭。
//   [action]：检定意志(4)。如果成功，要么横置海德拉，要么从海德拉上移除1个毁灭。如果失败至少3点，
//            在海德拉上放置1个毁灭。
//
// 与 07330a 同句规则，共用 _shared.js 的沉睡面工厂；差异只有名字与巢穴地点。

import { slumberingAncientOneEntry } from '../../_shared.js'

export default slumberingAncientOneEntry({
  code: '07331a',
  name: '海德拉',
  lairCode: '07329',
  lairName: '海德拉巢穴',
})
