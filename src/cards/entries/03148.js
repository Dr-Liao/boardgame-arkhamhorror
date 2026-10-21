// 03148 埋伏
// 卡面：附属到你所在地点。
// 卡面：如果被附属地点没有调查员，弃掉理伏。
// 卡面：强制 - 有敌人生成在被附属地点后：对该敌人造成2点伤害并弃掉埋伏。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03148 埋伏：附属到所在地点（地点上没有调查员时弃置）。

import { attachToChosenLocation } from './_shared.js'

export default {
  code: '03148',
  abilities: [
    {
      kind: 'played', label: '附属到所在地点',
      resolve: ({ state, inv, api }) => attachToChosenLocation(state, inv, api, { code: '03148', source: 'ambush' }),
    },
  ],
  ambushAttachment: true,
  modifiers: [

  ],
}
