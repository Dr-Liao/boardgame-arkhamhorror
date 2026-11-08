// 08712 极地幻景（Polar Mirage）· 诡计 · silence_and_mystery
// 卡面：显现 - 附属到最近的有线索且没有附属极地幻景的地点。强制 - 你发现附属地点的线索，或控制
//   附属地点的线索后：弃掉你手中所有非弱点卡牌。弃掉极地幻景。
// 读点：显现附走 api.attachToLocation；「发现/控制附属地点线索后弃手牌」需要引擎的地点附属强制窗口
//   （primitive-requests/p7-08712.json）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08712'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, clueDiscoveryDiscardNonWeakness: true },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(loc => (loc.clues || 0) > 0
      && !(loc.attachments || []).some(attachment => (attachment.originalCode || attachment.code) === CODE))
    const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, inv.location, loc.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const nearest = Math.min(...scored.map(item => item.distance))
    const options = scored.filter(item => item.distance === nearest).map(item => item.loc)
    const chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近的有线索且没有附属「极地幻景」的地点。',
      options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })) || options[0]
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('🌌 「极地幻景」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '「发现/控制附属地点线索后弃掉手中所有非弱点卡牌并弃掉本卡」需要引擎的地点附属强制读点（primitive-requests/p7-08712.json）。',
}

