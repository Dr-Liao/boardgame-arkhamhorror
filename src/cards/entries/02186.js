// 02186 荒唐的素描像
// 卡面：你的地点有线索才能打出。
// 卡面：抽取3张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02186 荒唐的素描像：所在地点有线索才能打出；抽取 3 张卡牌。
// 「有线索才能打出」不再是顶层散字段，而是条目上的 playCondition（唯一读点）。

import { clueAtLocation } from '../../engine/matcher.js'

export default {
  code: '02186',
  playCondition: [{ when: clueAtLocation(), message: '当前地点没有线索' }],
  abilities: [
    { kind: 'played', label: '抽取 3 张卡牌', effect: { type: 'draw', amount: 3 } },
  ],
  modifiers: [

  ],
}
