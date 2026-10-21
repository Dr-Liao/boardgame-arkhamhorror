// 02273 喘息时间
// 卡面：你所在地点没有敌人才能打出。
// 卡面：治愈3点恐惧并抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02273 喘息时间：所在地点没有敌人才能打出；治愈 3 点恐惧并抽 1 张。

import { noEnemiesHere } from '../../engine/matcher.js'

export default {
  code: '02273',
  playCondition: [{ when: noEnemiesHere(), message: '当前地点有敌人' }],
  abilities: [
    {
      kind: 'played', label: '治愈 3 点恐惧并抽 1 张',
      effect: { type: 'sequence', effects: [{ type: 'heal', amount: 3, what: 'horror' }, { type: 'draw', amount: 1 }] },
    },
  ],
  modifiers: [

  ],
}
