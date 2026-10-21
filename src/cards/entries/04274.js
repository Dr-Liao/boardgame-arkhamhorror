// 04274 暖水瓶
// 卡面：使用(3补给)。
// 卡面：[action]花费1补给，横置暖水瓶：治愈你所在地点上的一位调查员的1点伤害(如果该调查员有至少2点肉体创伤，改为治愈2伤害)。
// 卡面：[action]花费1补给，横置暖水瓶：治愈你所在地点上的一位调查员的1点恐惧(如果该调查员有至少2点精神创伤，改为治愈2恐惧)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04274 保温瓶：花 1 补给并横置，治疗同地点 1 点伤害/恐惧（对应创伤 2 点以上时 2 点）。

import { healWithTrauma } from './_shared.js'

export default {
  code: '04274',
  uses: 3,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action', label: '治疗 1 点伤害', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => healWithTrauma(state, inv, api, 'damage'),
    },
    {
      kind: 'action', label: '治疗 1 点恐惧', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => healWithTrauma(state, inv, api, 'horror'),
    },
  ],
  modifiers: [

  ],
}
