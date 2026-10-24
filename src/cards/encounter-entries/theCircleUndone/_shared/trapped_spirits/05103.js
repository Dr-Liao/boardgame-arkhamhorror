// 05103 怨灵
// 归属：战役共用 · theCircleUndone；遭遇组：trapped_spirits
// 卡面：猎手。
// 卡面：强制 - 在怨灵因（除[[法术]]或[[遗物]]以外的）伤害而被击败时：不将其弃掉，
//   改为将其附属到其所在地点。被附属的地点获得：「闹鬼 - 将怨灵生成在本地点。」
//
// 引擎 defeatEnemy 先移除实体再派发 enemyDefeated；返回 true = 替代弃掉/进胜利区。
// 「伤害来源」在 enemyDamaged 钩子里记录（enemyDamaged 先于击败判定派发），引擎可能传
// 支援实例 id、事件卡 id 或 { code, traits, kind } 形状的来源对象（2026-10-25 引擎修复后）。
// 只有「伤害导致击败」（damageTaken >= health）才触发替代，非伤害的击败正常弃掉。
// 每只怨灵各自附属/授予：同名多只时各自独立一条闹鬼能力（旧的 alreadyGranted 去重会吞掉第二只）。

import { ALL_CARDS, originalOf } from '../../../_shared.js'

const WRAITH = '05103'
const SPELL_RELIC_TRAITS = Object.freeze(['spell', 'relic'])

function traitIsSpellOrRelic(code) {
  return (ALL_CARDS[code]?.traits || [])
    .some(trait => SPELL_RELIC_TRAITS.includes(String(trait).toLowerCase()))
}

// 伤害来源是否来自法术/遗物支援（引擎把 source 传成支援实例 id 或来源对象）。
function isSpellOrRelicDamage(state, source) {
  if (source == null) return false
  if (typeof source === 'string') {
    if (traitIsSpellOrRelic(source)) return true
    for (const inv of state.investigators || []) {
      const asset = (inv.assets || []).find(item => item.id === source)
      if (asset) return traitIsSpellOrRelic(originalOf(asset))
    }
    return false
  }
  if (typeof source !== 'object') return false
  const kind = String(source.kind || source.type || '').toLowerCase()
  if (SPELL_RELIC_TRAITS.includes(kind)) return true
  const traits = source.traits || (source.code ? ALL_CARDS[source.code]?.traits : null) || []
  if (traits.some(trait => SPELL_RELIC_TRAITS.includes(String(trait).toLowerCase()))) return true
  for (const key of ['code', 'assetCode', 'cardCode', 'sourceCode']) {
    if (typeof source[key] === 'string' && traitIsSpellOrRelic(source[key])) return true
  }
  return false
}

export default {
  code: '05103',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onDamaged(state, enemy, api, seat, source) {
      // 保留原始来源（字符串或对象），击败时用共享口径判定法术/遗物。
      enemy.lastDamageSource = source ?? null
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
      const attachmentId = `wraith:${enemy.id}`
      if (!location.attachments.some(item => item.id === attachmentId)) {
        location.attachments.push({
          id: attachmentId, code: WRAITH, originalCode: WRAITH,
        })
      }
      // 每只怨灵各自授予一条「将怨灵生成在本地点」（同名多只时各自独立）。
      const grantId = `05103:haunt:${enemy.id}`
      api.grantHaunted?.({
        locationId: location.id,
        ability: {
          id: grantId,
          text: '闹鬼 - 将怨灵生成在本地点。',
          effect: [{ kind: 'spawn', code: WRAITH, locationId: location.id }],
        },
      })
      api.info?.('怨灵因非法术/遗物伤害被击败：它附属到所在地点，该地点获得「闹鬼 - 将怨灵生成在本地点」。')
      return true
    },
  },
}
