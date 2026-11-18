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
//   · 昼夜两段「进入/离开附属地点的强制伤害」：引擎对**地点附属**没有移动窗口来源
//     （ability-rules.js#nonPlayerAbilitySources 只枚举地点本身，不枚举 location.attachments；
//     hidden-rules.js 的附属读点只有 treacheryRule.blocksMovementWhileReady 一类布尔规则），
//     因此这次只落数据（dayMoveInto / nightMoveInOut），契约允许的近似在 note 里披露。
import { entryDistance, originalOf } from '../../../_shared.js'

const CODE = '10736'
const NAME = '荆棘之墙'

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
    return false
  },
  note: '显现（附属到最近且没有同卡附属的地点）自足实现。「白日：进入时 2 点伤害并弃掉本卡 / '
    + '黑夜：进入或离开时 1 点伤害」是移动窗口强制，引擎的地点附属没有移动窗口来源（只有地点本身是窗口来源），'
    + '本批只落数据（flags.dayMoveInto / flags.nightMoveInOut）留给 P8 章节移动读点，未接线的子句不冒充已实现。',
}
