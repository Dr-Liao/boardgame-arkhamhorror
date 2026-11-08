// 08693 雪盲危机（Snow Blindness） · 诡计 · deadly_weather
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 附属到你所在地点。
//   位于附属地点的每位调查员得到 -1[willpower]、-1[intellect]、-1[combat]、-1[agility]。强制 - 当一轮结束时：弃掉雪盲危机。
// 读点：显现附走 api.attachToLocation；附属地点的持续/强制限制需要「地点附属规则」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08693.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08693'

function nearestLocation(state, fromId) {
  const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
  const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, fromId, loc.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.loc)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, weather: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    let chosen = null
    if (false) {
      const options = nearestLocation(state, inv.location)
      if (!options.length) return false
      chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「雪盲危机（Snow Blindness）」的地点。',
        options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
      })) || options[0]
    } else {
      chosen = state.locations.find(loc => loc.id === inv.location)
      if (!chosen) return false
    }
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('「雪盲危机（Snow Blindness）」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的持续限制与轮末弃掉需要引擎的地点附属规则读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08693.json。',
}

