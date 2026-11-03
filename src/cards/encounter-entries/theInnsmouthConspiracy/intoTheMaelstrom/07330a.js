// 07330a 达贡（深入沉睡）· 暗潮之下
//
// 印刷（中文）：
//   达贡正在沉睡。他不能攻击，不能与调查员交战，免疫调查员行动和玩家卡牌效果。
//   强制 - 调查阶段结束时，如果一名调查员在达贡巢穴且达贡未横置：在达贡上放置1个毁灭。
//   [action]：检定意志(4)。如果成功，要么横置达贡，要么从达贡上移除1个毁灭。如果失败至少3点，
//            在达贡上放置1个毁灭。
//
// 沉睡的免疫/不能攻击/不能交战由 enemyRule.slumbering 在引擎侧统一执行（见
// src/engine/effect-provenance.js）；本文件只写这张卡自己的印刷能力，共用工厂在 _shared.js。

import { slumberingAncientOneEntry } from '../../_shared.js'

export default slumberingAncientOneEntry({
  code: '07330a',
  name: '达贡',
  lairCode: '07328',
  lairName: '达贡巢穴',
})
