// 08509 雪冢（Snow Graves） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：[reaction]你发现雪冢的最后一个线索后，将忒咳哩-哩牌库顶的 3 张卡牌洗入你的牌库，不要查看内容：在剧本日志「已回收的补给品」中记录绿皂石（团队每场战役限一次）。背面：进入额外费用 2[per_investigator] 线索。庇护 5。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

const CODE = '08509'
const GREEN_SOAPSTONE = '08614'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 5, campCandidate: true, entryGroupCluesPerInvestigator: 2 },
  abilities: [{
    kind: 'reaction', trigger: 'clueDiscovered',
    label: '雪冢：发现最后一个线索后洗入 3 张忒咳哩-哩并记录「绿皂石」（团队每场战役一次）',
    limit: { scope: 'perCampaign', owner: 'group' },
    criteria: ({ state, source, inv, context }) => inv?.location === source.id && (source.clues || 0) === 0,
    resolve: ({ inv, api }) => {
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, Math.min(3, size)) : false
      const done = Array.isArray(shuffled) ? shuffled.length : 0
      api.mechanics.recordSets.add('suppliesRecovered', GREEN_SOAPSTONE)
      api.info('⛰️ 「雪冢」：洗入 ' + done + ' 张忒咳哩-哩，并记录「绿皂石」。')
    },
  }],
}


