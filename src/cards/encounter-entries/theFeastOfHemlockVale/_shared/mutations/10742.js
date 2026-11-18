// 10742 异常疯长（Unnatural Growth）· 诡计 · 共享遭遇组 mutations（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/mutations。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Revelation - Place 1 doom on the nearest enemy with no doom on it. If no doom was placed by
//   this effect, discard 2 cards at random from your hand.
//
// 读点（声明即接线）：
//   · 显现直接在本条目结算（encounterResolve；FHV 诡计的 entryRevelation 条目通道，
//     src/engine/treachery-tokens.js#resolveTreacheryBody）。
//   · 「最近且没有毁灭标记的敌人」= _shared.js#entryDistance 的连接图 BFS，只考虑 (enemy.doom || 0) === 0；
//     同距由领队选择（api.choice）。
//   · 放毁灭 = api.doomOn（scenario-runtime.js → placeDoomOnCard，与议程/章节同一个毁灭写入口，
//     受 canPlaceDoomOn 守卫）。
//   · 没有放成毁灭（选不出敌人，或毁灭被禁止）→ api.discardRandom（从手牌随机弃 2 张的唯一入口）。
import { entryDistance } from '../../../_shared.js'

const CODE = '10742'
const NAME = '异常疯长'
const DISCARD_COUNT = 2

function nearestDoomlessEnemies(state, fromId) {
  const scored = (state.enemies || [])
    .filter(enemy => enemy && !enemy.defeated && !enemy.removedFromGame && enemy.location
      && (Number(enemy.doom) || 0) === 0)
    .map(enemy => ({ enemy, distance: entryDistance(state, fromId, enemy.location) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.enemy)
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    encounterGroup: 'mutations',
    quantity: 2,
    traits: ['Curse'],
    placeDoomOnNearest: { amount: 1, requireNoDoom: true },
    fallbackDiscardRandom: DISCARD_COUNT,
  },
  encounterResolve(state, inv, card, api) {
    void card
    if (!inv) return false
    const candidates = nearestDoomlessEnemies(state, inv.location)
    if (candidates.length) {
      const target = candidates.length === 1 ? candidates[0] : candidates.find(enemy => enemy.id === api.choice({
        kind: 'target', source: CODE, seat: inv.seat,
        prompt: `「${NAME}」：选择最近且没有毁灭标记的敌人（距离相同）。`,
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
      })) || candidates[0]
      const placed = api.doomOn(target, 1)
      if (placed) {
        api.info?.(`🧿 「${NAME}」在「${target.name}」上放置 1 个毁灭标记。`)
        return false
      }
      api.info?.(`🧿 「${NAME}」：不能在「${target.name}」上放置毁灭标记。`)
    }
    const discarded = api.discardRandom(inv.seat, DISCARD_COUNT) || []
    api.info?.(`🃏 「${NAME}」没有放置毁灭：${inv.name} 随机弃掉 ${discarded.length} / ${DISCARD_COUNT} 张手牌。`)
    return false
  },
  note: '显现自足实现（最近且无毁灭的敌人 → 放 1 毁灭；没有放成 → 随机弃 2 张）。'
    + '「没有以此效果放置毁灭标记」按 api.doomOn 的返回值判定，因此毁灭被章节禁止时也会落到弃手牌分支。',
}
