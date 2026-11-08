// 08505 不稳定冰盖（Precarious Ice Sheet） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：[reaction]你在不稳定冰盖抽取一张[[危险]]诡计时，在混乱袋里加入 1 个[frost]标记：取消该卡牌的效果并将其弃掉（团队每轮仅限一次）。庇护 2。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08505'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 2, campCandidate: true },
  abilities: [{
    kind: 'reaction', trigger: 'encounterDrawn',
    label: '不稳定冰盖：抽到[[危险]]诡计时加 1 个 [frost]，取消并弃掉该卡（团队每轮一次）',
    limit: { scope: 'perRound', owner: 'group' },
    criteria: ({ state, source, inv, context }) => context?.cardCode
      && state.investigators?.[state.skillTest?.seat ?? inv.seat]?.location === source.id
      && (ALL_CARDS[context.cardCode]?.traits || []).some(trait => String(trait).toLowerCase() === 'hazard'),
    resolve: ({ context, api }) => {
      const added = api.mechanics.frost.add(1)
      if (!added) {
        api.info('「不稳定冰盖」：寒霜标记池已满，无法加入 [frost]。')
        return
      }
      context.cancelled = true
      api.info('🧊 「不稳定冰盖」：取消「' + (context.cardCode || '危险诡计') + '」的效果并弃掉。')
    },
  }],
}


