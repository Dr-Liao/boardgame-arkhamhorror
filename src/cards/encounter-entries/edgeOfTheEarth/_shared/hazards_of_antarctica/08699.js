// 08699 穿越冰雪（Crossing the Ice）· 诡计 · hazards_of_antarctica
// 卡面：显现 - 附属到最近且没有附属穿越冰雪的地点。作为进入或离开附属地点（除因冒险卡牌效果外）
//   的额外费用，检定[agility](2)。如果你检定失败，取消本次移动的效果，受到 1 点伤害和 1 点恐惧，
//   并弃掉穿越冰雪。
// 读点：显现附走 api.attachToLocation；移动进出检定需要「地点附属移动检定」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08699.json（不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08699'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, moveEntryTest: { skill: 'agility', difficulty: 2, cancelMove: true, damage: 1, horror: 1, discardOnFail: true } },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
    const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, inv.location, loc.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const nearest = Math.min(...scored.map(item => item.distance))
    const options = scored.filter(item => item.distance === nearest).map(item => item.loc)
    const chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「穿越冰雪」的地点。',
      options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })) || options[0]
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('❄️ 「穿越冰雪」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '「进入/离开附属地点的额外敏捷(2)检定」需要引擎的地点附属移动检定读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08699.json。',
}

