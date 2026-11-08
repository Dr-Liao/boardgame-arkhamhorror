// 08510 破冰船登陆点（Icebreaker Landing） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：[action]：谈判。检定[intellect](4) 搜索被困船只。成功则移除混乱袋 1 个[frost]标记，或记录「小型收音机」（每个剧本最多一次成功）。背面：进入额外费用 2[per_investigator] 线索。庇护 5。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

const CODE = '08510'
const SMALL_RADIO = '08619'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 5, campCandidate: true, entryGroupCluesPerInvestigator: 2 },
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '谈判 智力(4)：移除 1 个 [frost]，或记录「小型收音机」',
    limit: { scope: 'perGame', owner: 'group' },
    resolve: ({ inv, api }) => {
      api.test(inv.seat, 'intellect', 4, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        const choices = [{ id: 'frost', label: '移除混乱袋中 1 个 [frost] 标记' },
          { id: 'radio', label: '在剧本日志记录「小型收音机」' }]
        const pick = choices.length === 1 ? 'frost' : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '搜索被困船只：选择一项。', options: choices })
        if (pick === 'radio') {
          api.mechanics.recordSets.add('suppliesRecovered', SMALL_RADIO)
          api.info('📻 「破冰船登陆点」：记录「小型收音机」。')
        } else {
          const paid = api.mechanics.frost.pay(1)
          api.info(paid ? '🧊 「破冰船登陆点」：移除 1 个 [frost]。' : '混乱袋里没有 [frost] 标记。')
        }
      } })
    },
  }],
}


