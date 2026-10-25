// 05036 钉鞋
// 卡面：每位调查员仅限1张[[鞋子]]。
// 卡面：你得到+1[agility]。
// 卡面：[reaction]在你移动后，新到地点的敌人与你交战之前，横置钉鞋：检定[agility](3)。
//       如果你检定成功，移动到一个连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05036 钉鞋：+1 敏捷；移动后的反应——横置、敏捷(3)检定，成功再移动到连接地点。
// 显式简化：① 反应时机在引擎的 move 窗口打开时敌人已经自动交战（卡面要求在交战之前），
// 因此「先交战再走」的差别只在敌人已交战；② 「每位调查员仅限 1 张[[鞋子]]」没有按特性分组
// 的场上限额读点，未校验。

import { ALL_CARDS } from '../../cards/cards-data.js'
import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

export default {
  code: '05036',
  note: 'R6：反应改挂 moveBeforeEngage 窗口（移动后、新地点敌人自动交战前），与卡面时机一致；「每位调查员仅限 1 张[[鞋子]]」由 playCondition 校验。已实现：+1 敏捷、横置、敏捷(3)检定、成功移动到连接地点。',
  // 审计 R4：补「每位调查员仅限 1 张[[鞋子]]」——打出时校验控制者场上同特性资产数。
  playCondition: [{
    when: ({ inv }) => !(inv.assets || []).some(asset =>
      (ALL_CARDS[asset.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'footwear')),
    message: '每位调查员仅限 1 张[[鞋子]]',
  }],
  modifiers: [
    skillModifier('agility', 1),
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'moveBeforeEngage',
      label: '横置：敏捷(3)，成功后移动到连接地点',
      cost: { exhaust: true },
      criteria: [ownSeat()],
      resolve: ({ state, inv, api }) => {
        api.test(inv.seat, 'agility', 3, {
          source: { label: '钉鞋', name: api.cardName('05036'), code: '05036' },
          resolve: result => {
            if (!result.success) return
            const here = state.locations.find(location => location.id === inv.location)
            const destinations = [...new Set(here?.connections || [])]
              .filter(id => state.locations.some(location => location.id === id))
            if (!destinations.length) { api.info('没有可移动的连接地点。'); return }
            const picked = destinations.length === 1 ? destinations[0]
              : api.choice({ kind: 'target', source: '05036', seat: inv.seat, prompt: '选择要移动到的连接地点。',
                options: destinations.map(id => ({ id, label: api.locationName(id) })) })
            if (picked) api.moveInvestigator(inv.seat, picked)
          },
        })
      },
    },
  ],
}
