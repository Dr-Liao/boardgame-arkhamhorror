// 08511 严寒洞穴（Frigid Cave） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：[action]在混乱袋里加入 1 个[frost]标记：记录「矿物标本」（团队每个剧本仅限一次）。背面：进入额外费用 2[per_investigator] 线索。庇护 6。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

const CODE = '08511'
const MINERAL_SPECIMEN = '08618'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 6, campCandidate: true, entryGroupCluesPerInvestigator: 2 },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '加 1 个 [frost]：记录「矿物标本」（团队每剧本一次）',
    limit: { scope: 'perGame', owner: 'group' },
    resolve: ({ api }) => {
      const added = api.mechanics.frost.add(1)
      if (!added) {
        api.info('「严寒洞穴」：寒霜标记池已满，无法加入 [frost]。')
        return
      }
      api.mechanics.recordSets.add('suppliesRecovered', MINERAL_SPECIMEN)
      api.info('🪨 「严寒洞穴」：加入 1 个 [frost] 并记录「矿物标本」。')
    },
  }],
}


