// 08506 辽阔雪地（Broad Snowdrifts） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：[reaction]在你成功调查辽阔雪地时，在混乱袋里加入 1 个[frost]标记：发现辽阔雪地额外 3 个线索（团队每场游戏仅限一次）。背面：进入本地点的额外费用（共同花费 1[per_investigator] 线索）。庇护 4。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

const CODE = '08506'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 4, campCandidate: true, entryGroupCluesPerInvestigator: 1 },
  abilities: [{
    kind: 'reaction', trigger: 'investigateSuccess',
    label: '辽阔雪地：加 1 个 [frost] 换取额外 3 个线索（团队每场游戏一次）',
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ state, inv, context }) => context?.location === source?.id
      && state.investigators?.[inv?.seat ?? state.skillTest?.seat]?.location === context?.location,
    resolve: ({ state, inv, context, api }) => {
      const locationId = context?.location ?? inv?.location
      const added = api.mechanics.frost.add(1)
      if (!added) {
        api.info('「辽阔雪地」：寒霜标记池已满。')
        return
      }
      api.discoverClue(inv.seat, 3, locationId)
      api.info('🏔️ 「辽阔雪地」：额外发现 3 个线索。')
    },
  }],
}


