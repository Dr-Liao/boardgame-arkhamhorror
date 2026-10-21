// 02151 “我要走了！”
// 卡面：场上有冒险卡带有“撤退”能力才能打出。
// 卡面：撤退。你逃出了这个鬼地方。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { resignAvailable } from '../../engine/matcher.js'

export default {
  code: '02151',
  playCondition: [
    { when: resignAvailable(), message: '场上没有带「撤退」能力的剧本卡' },
  ],
  abilities: [
    { kind: 'played', label: '“我要走了！”', resolve: ({ inv, api }) => api.resign(inv.seat) },
  ],
  modifiers: [

  ],
}
