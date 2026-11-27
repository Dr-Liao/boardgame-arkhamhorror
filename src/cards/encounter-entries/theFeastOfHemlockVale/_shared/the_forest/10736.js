// 10736 荆棘之墙（Wall of Thorns）· 诡计 · 共享遭遇组 the_forest（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_forest。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Revelation - Attach Wall of Thorns to the nearest location without Wall of Thorns attached.
//   (Day [day]) Forced - When you move into attached location: Take 2 damage. Discard Wall of Thorns.
//   (Night [night]) Forced - When you move into or out of attached location: Take 1 damage.
//
// 读点（声明即接线）：
//   · 显现直接在本条目结算（encounterResolve；FHV 诡计的 entryRevelation 条目通道，
//     src/engine/treachery-tokens.js#resolveTreacheryBody）。
//   · 「最近且没有荆棘之墙的地点」= _shared.js#entryDistance 的连接图 BFS（同距由领队选择），
//     已有同卡附属的地点排除（与 07299 石障同一写法）。
//   · 附属 = api.attachToLocation（src/engine/location-attachments.js#attachLocationCard 唯一写入口，
//     落在 location.attachments；不写 state）。
//   · 进入/离开附属地点时，在移动结算内读取该地点的昼夜。
import { entryDistance, originalOf } from '../../../_shared.js'
import { duringPeriod } from '../../../../../engine/matcher.js'

const CODE = '10736'
const NAME = '荆棘之墙'
const isDay = duringPeriod('day')
const isNight = duringPeriod('night')

const hasWall = location =>
  (location.attachments || []).some(attachment => String(originalOf(attachment)) === CODE)

function nearestEligibleLocations(state, fromId) {
  const scored = (state.locations || [])
    .filter(location => !hasWall(location))
    .map(location => ({ location, distance: entryDistance(state, fromId, location.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.location)
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    onInvestigatorMove({ state, inv, source, location, from, to, api }) {
      if (from?.id === to?.id || (location.id !== from?.id && location.id !== to?.id)) return
      const context = { state, source: location }
      const records = state.campaign?.records || {}
      const recordedDate = typeof records.hemlockDate === 'string' ? records.hemlockDate.split(':')[1] : null
      const recorded = String(records.time ?? records.timeOfDay ?? recordedDate ?? '').toLowerCase()
      const night = isNight(context) || (!isDay(context) && recorded === 'night')
      if (night) api.damage(inv.seat, 1)
      else if (location.id === to?.id && (isDay(context) || recorded === 'day')) {
        api.damage(inv.seat, 2)
        api.detachEncounterAttachmentById(source.id)
      }
    },
  },
  flags: {
    encounterGroup: 'the_forest',
    quantity: 2,
    traits: ['Hazard', 'Flora'],
    attachToNearestWithoutCopy: true,
    dayMoveInto: { damage: 2, discardSelf: true },
    nightMoveInOrOut: { damage: 1, discardSelf: false },
  },
  encounterResolve(state, inv, card, api) {
    void card
    const candidates = nearestEligibleLocations(state, inv.location)
    if (!candidates.length) {
      api.info?.(`「${NAME}」：没有可附属的地点，弃掉。`)
      return false
    }
    const chosen = candidates.length === 1 ? candidates[0] : candidates.find(location => location.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat,
      prompt: `「${NAME}」：选择最近且没有荆棘之墙的地点。`,
      options: candidates.map(location => ({ id: location.id, label: location.name || location.id })),
    })) || candidates[0]
    api.attachToLocation(chosen.id, {
      code: CODE, originalCode: CODE, id: `${CODE}:${chosen.id}`,
    })
    api.info?.(`🌿 「${NAME}」附属到「${chosen.name || chosen.id}」。`)
    return { placed: true }
  },
}
