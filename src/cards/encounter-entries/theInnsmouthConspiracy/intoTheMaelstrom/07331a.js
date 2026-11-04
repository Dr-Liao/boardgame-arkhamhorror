// 07331a 海德拉（沉睡面）· 进入漩涡
//
// 印刷（中文）：
//   海德拉正在沉睡。她不能攻击，不能与调查员交战，免疫调查员行动和玩家卡牌效果。
//   强制 - 当调查阶段结束时，如果有调查员在海德拉巢穴，且海德拉处于重整状态：在海德拉上放置1个毁灭标记。
//   [action]：检定[willpower](4)。如果你检定成功，横置海德拉或移除她的1个毁灭标记。
//             如果你检定失败且低于难度至少3点，在海德拉上放置1个毁灭标记。
//
// 与 07330a 达贡逐字同文：规则写在 _shared.js 的 slumberingAncientOneEntry 里，这里只换归属数据。

import { slumberingAncientOneEntry } from '../../_shared.js'

export default slumberingAncientOneEntry({
  code: '07331a',
  lairCode: '07329', // 海德拉巢穴
  actionLabel: '检定意志(4)：成功则横置海德拉或移除其1个毁灭标记；失败至少3点则放置1个毁灭标记',
})
