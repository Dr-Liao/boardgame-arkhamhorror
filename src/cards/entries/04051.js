// 04051 亚历山卓·维拉
// 卡面：你调查[[古代]]地点时得到+1技能值。
// 卡面：[action]如果你位于[[古代]]地点，横置亚历山卓·维拉：抽取2张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04051 亚历山卓·维拉：调查[[古代]]地点 +1 技能；[行动]横置抽 2。
// 简化：修正按「位于[[古代]]地点时全部技能 +1」处理（含非调查检定），卡面只写调查。

import { atTrait } from '../../engine/matcher.js'
import { allSkillModifiers } from './_shared.js'

export default {
  code: '04051',
  simplified: true,
  // 第 114 轮：「伊斯人身体」换身准备时，这张剧情资产要放到一边（原 theCityOfArchives 的卡号分支）。
  assetRule: { setAsideOnBodySwap: true },
  modifiers: allSkillModifiers(1, {
    when: ({ state, inv }) => {
      if (state?.skillTest?.source?.label !== '调查') return false
      const location = (state.locations || []).find(item => item.id === inv?.location)
      return (location?.traits || []).some(trait => String(trait).toLowerCase() === 'ancient')
    },
  }),
  abilities: [
    {
      kind: 'action', label: '横置：抽 2 张牌（需在[[古代]]地点）',
      criteria: [atTrait('ancient')], cost: { exhaust: true },
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 2),
    },
  ],
}
