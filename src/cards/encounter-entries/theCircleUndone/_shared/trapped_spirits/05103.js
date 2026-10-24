// 05103 怨灵
// 归属：战役共用 · theCircleUndone；遭遇组：trapped_spirits
// 卡面：猎手。
// 卡面：强制 - 在怨灵因（除[[法术]]或[[遗物]]以外的）伤害而被击败时：不将其弃掉，
//   改为将其附属到其所在地点。被附属的地点获得：「闹鬼 - 将怨灵生成在本地点。」
//
// 引擎 defeatEnemy 先移除实体再派发 enemyDefeated；返回 true = 替代弃掉/进胜利区。
// 「伤害来源」在 enemyDamaged 钩子里记录（enemyDamaged 先于击败判定派发）；
// 只有「伤害导致击败」（damageTaken >= health）才触发替代，非伤害的击败正常弃掉。

import { ALL_CARDS, originalOf } from '../../../_shared.js'

const WRAITH = '05103'

// 伤害来源是否来自法术/遗物支援（引擎把 source 传成支援实例 id）。
function isSpellOrRelicDamage(state, source) {
  if (typeof source !== 'string') return false
  for (const inv of state.investigators || []) {
    const asset = (inv.assets || []).find(item => item.id === source)
    if (!asset) continue
    return (ALL_CARDS[asset.code]?.traits || [])
      .some(trait => ['spell', 'relic'].includes(String(trait).toLowerCase()))
  }
  return false
}

export default {
  code: '05103',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onDamaged(state, enemy, api, seat, source) {
      enemy.lastDamageSource = typeof source === 'string' ? source : null
      enemy.lastDamagedRound = state.round
    },
    onDefeated(state, enemy, api) {
      if (originalOf(enemy) !== WRAITH) return false
      // 不是伤害造成的击败 → 正常弃掉。
      if ((enemy.damageTaken || 0) < (enemy.health || 0)) return false
      if (isSpellOrRelicDamage(state, enemy.lastDamageSource)) return false
      const location = (state.locations || []).find(entry => entry.id === enemy.location)
      if (!location) return false
      location.attachments ||= []
      if (!location.attachments.some(item => originalOf(item) === WRAITH)) {
        location.attachments.push({
          id: `wraith:${state.round}:${enemy.id}`, code: WRAITH, originalCode: WRAITH,
        })
      }
      const grantId = `05103:haunt:${location.id}`
      const alreadyGranted = (state.hauntedGrants || []).some(grant => grant.ability?.id === grantId)
      if (!alreadyGranted) {
        api.grantHaunted?.({
          locationId: location.id,
          ability: {
            id: grantId,
            text: '闹鬼 - 将怨灵生成在本地点。',
            effect: [{ kind: 'spawn', code: WRAITH, locationId: location.id }],
          },
        })
      }
      api.info?.('怨灵因非法术/遗物伤害被击败：它附属到所在地点，该地点获得「闹鬼 - 将怨灵生成在本地点」。')
      return true
    },
  },
}
