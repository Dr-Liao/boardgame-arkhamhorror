// 08691 同源迷雾（Kindred Mist）· 诡计 · creatures_in_the_ice
// 卡面：显现 - 附属到最近且没有附属同源迷雾的地点。
// 强制 - 你在附属地点时，在忒咳哩-哩牌库的卡牌将要混洗入你的牌库时：改为抽取那些卡牌，不要
//   将它们放在忒咳哩-哩牌库底，改为放在你的牌库底。当一轮结束时弃掉同源迷雾。
// 读点：显现附走 api.attachToLocation（location-attachments.js 唯一写入口）；
//   洗入替代与轮末强制需要「地点附属强制窗口」这个引擎读点，见
//   artifacts/migration/eote/primitive-requests/p7-08691.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08691'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, replacesTekeliShuffleAtLocation: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
    const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, inv.location, loc.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const nearest = Math.min(...scored.map(item => item.distance))
    const options = scored.filter(item => item.distance === nearest).map(item => item.loc)
    const chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「同源迷雾」的地点。',
      options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })) || options[0]
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('🌫️ 「同源迷雾」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的忒咳哩-哩洗入替代与轮末弃掉需要引擎的地点附属强制读点；本条目只落数据与附属，读点请求见 primitive-requests/p7-08691.json。',
}

