// 06272 巨噬蠕虫隧道（Dhole Tunnel，诡计，3 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：terror_of_the_vale（PONR）。
// 卡面：Revelation - 如果滑行的巨噬蠕虫在场上，其移动并攻击，如同此刻是敌军阶段。
//       否则，将巨噬蠕虫隧道附属到与最近的巨噬蠕虫隧道之间连接次数至少为 2 的一个地点
//       （如果你不能这么做，则附属到你所在地点）。然后，如果滑行的巨噬蠕虫在胜利区，
//       将其以横置状态生成在附属的地点。
// 实现：全部用 api 结算——在场上时 api.stepToward + api.moveEnemy + api.attack；
//   否则 BFS 计算离最近隧道 ≥2 的地点，api.choose 选地点后 api.attachToLocation；
//   胜利区检查从 state.victoryDisplay 只读，api.spawn + api.exhaustEnemy。
import { originalOf } from '../../../_shared.js'

const DHOLE = '06271'
const TUNNEL = '06272'

function distanceMap(state, from) {
  const distance = new Map([[from, 0]])
  const queue = [from]
  for (const current of queue) {
    const location = (state.locations || []).find(item => item.id === current)
    for (const next of location?.connections || []) {
      if (distance.has(next) || !(state.locations || []).some(item => item.id === next)) continue
      distance.set(next, distance.get(current) + 1)
      queue.push(next)
    }
  }
  return distance
}

function nearestTunnelDistance(state, from) {
  const distances = (state.locations || [])
    .filter(location => (location.attachments || []).some(attachment =>
      (attachment.originalCode || attachment.code) === TUNNEL))
    .map(location => distanceMap(state, location.id).get(from))
    .filter(Number.isFinite)
  return distances.length ? Math.min(...distances) : null
}

export default {
  code: '06272',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const dhole = (state.enemies || []).find(enemy => originalOf(enemy) === DHOLE)
    if (dhole) {
      const target = (state.investigators || []).find(one => !one.defeated && !one.resigned)
      if (target) {
        const next = api.stepToward?.(dhole.location, target.location)
        if (next) api.moveEnemy?.(dhole, next)
      }
      const here = (state.locations || []).find(location => location.id === dhole.location)
      for (const one of (state.investigators || []).filter(entry =>
        !entry.defeated && !entry.resigned && entry.location === dhole.location)) {
        api.attack?.(dhole, one)
      }
      api.info?.(`🐛 「巨噬蠕虫隧道」：滑行的巨噬蠕虫如同敌军阶段般移动并攻击${here ? `（到达「${here.name}」）` : ''}。`)
      return false
    }
    const nearest = nearestTunnelDistance(state, inv.location)
    const candidates = (state.locations || []).filter(location => {
      const distance = nearest == null ? Infinity : distanceMap(state, inv.location).get(location.id)
      if (!Number.isFinite(distance)) return false
      return nearest == null || (distance >= 2 && location.id !== inv.location)
    })
    let targetLocation = null
    if (candidates.length === 0) targetLocation = (state.locations || []).find(location => location.id === inv.location) || null
    else if (candidates.length === 1) targetLocation = candidates[0]
    else {
      const answer = api.choose?.({
        kind: 'location', source: '06272', seat: inv.seat,
        prompt: '选择「巨噬蠕虫隧道」附属的地点（与最近的隧道至少相距 2 条连接）。',
        options: candidates.map(location => ({ id: location.id, label: location.name })),
      })
      targetLocation = candidates.find(location => location.id === String(answer)) || candidates[0]
    }
    if (!targetLocation) return false
    api.attachToLocation?.(targetLocation.id, { code: TUNNEL, originalCode: TUNNEL })
    api.info?.(`🐛 「巨噬蠕虫隧道」附属到「${targetLocation.name}」。`)
    const inVictory = (state.victoryDisplay || []).some(entry =>
      (entry.originalCode || entry.code) === DHOLE)
    if (inVictory) {
      const spawned = api.spawn?.(DHOLE, targetLocation.id)
      if (spawned) api.exhaustEnemy?.(spawned)
      api.info?.(`🐛 滑行的巨噬蠕虫从胜利区以横置状态生成在「${targetLocation.name}」。`)
    }
    return false
  },
}
