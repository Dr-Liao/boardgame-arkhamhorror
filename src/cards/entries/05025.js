// 05025 串联线索
// 卡面：快速。你发现所在地点的最后一个线索后打出。
// 卡面：发现一个地点的2个线索，该地点的印刷隐藏值须低于你所在地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05025 串联线索：快速事件；发现所在地点最后 1 个线索后，
// 发现另一个隐藏值更低地点的 2 个线索。

import { ownSeat } from '../../engine/matcher.js'

// 卡面「快速。你发现所在地点的最后一个线索后打出」：这张牌只能走发现线索后的反应窗口，
// 不能作为普通事件用行动打出（否则会白付 4 资源）。引擎的反应窗口只读 criteria、
// 不读 playCondition，因此这里用一条恒假的打出条件封闭普通出牌路径。
export default {
  code: '05025',
  playCondition: [{ when: () => false, message: '「串联线索」只能在发现最后线索后的反应窗口打出' }],
  abilities: [
    {
      kind: 'reaction', trigger: 'clueDiscovered', label: '发现一个隐藏值更低地点的 2 个线索',
      fromHand: true,
      criteria: [ownSeat(),
        ctx => ctx.context?.location === ctx.inv?.location && ctx.context?.lastClue === true,
        // 目标合法性：必须存在「隐藏值更低且有线索」的其他地点，否则不应提供该反应。
        ctx => {
          const here = (ctx.state?.locations || []).find(location => location.id === ctx.inv?.location)
          return (ctx.state?.locations || []).some(location => location.id !== ctx.inv?.location
            && (location.shroud || 0) < (here?.shroud || 0) && (location.clues || 0) > 0)
        }],
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const options = state.locations.filter(location => location.id !== inv.location
          && (location.shroud || 0) < (here?.shroud || 0) && (location.clues || 0) > 0)
        if (!options.length) return api.info('没有隐藏值更低且有线索的地点。')
        const answer = options.length === 1 ? options[0].id
          : api.choice({ kind: 'target', source: '05025', seat: inv.seat, prompt: '选择发现线索的地点。',
            options: options.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
        const target = options.find(location => location.id === answer)
        if (target) api.discoverAt(inv.seat, target.id, 2)
      },
    },
  ],
  modifiers: [

  ],
}
