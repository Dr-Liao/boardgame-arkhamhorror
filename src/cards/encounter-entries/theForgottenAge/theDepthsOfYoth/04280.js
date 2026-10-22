// 04280 无尽洞窟
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { tfaPlacePursuit } from '../../_shared.js'

export default {
  code: '04280', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      tfaPlacePursuit(state, api)
      const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      if (!active.length) return
      const seat = active.length === 1 ? active[0].seat : Number(api.choose({
        kind: 'investigator', source: '04280', seat: state.campaign.leadSeat,
        prompt: '队长指定一位调查员担任队伍的侦查员。',
        options: active.map(inv => ({ id: String(inv.seat), label: inv.name })),
      }))
      const scout = state.investigators[seat] && !state.investigators[seat].defeated
        ? state.investigators[seat] : active[0]
      if (api.hasSupply?.(scout.seat, 'rope') ?? api.checkSupplies(scout.seat, 'rope')) {
        api.info?.(`侦查员 ${scout.name} 带着绳索，轻松爬上石崖。`)
        return
      }
      const skill = String(api.choose?.({
        kind: 'skill', source: '04280', seat: scout.seat,
        prompt: '攀爬石崖：选择用战斗或敏捷检定(5)。',
        options: [{ id: 'combat', label: '战斗(5)' }, { id: 'agility', label: '敏捷(5)' }],
      }) || 'combat') === 'agility' ? 'agility' : 'combat'
      api.test(scout.seat, skill, 5, result => {
        if (!result.success) api.trauma(scout.seat, 'physical', 1)
      }, 0, { label: '攀爬石崖', ability: true })
    },
  },
}
