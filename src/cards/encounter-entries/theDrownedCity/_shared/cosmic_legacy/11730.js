// 11730 狡诈拟态（Cunning Mimicry）· 诡计 · 共享遭遇组 cosmic_legacy（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/cosmic_legacy。
// 卡面（cards-data 11730）：
//   显现 - 如果场上没有[[怪物]]敌人，狡诈拟态获得涌动。
//          否则，检定[intellect](3)。如果你失败，最近的一名[[怪物]]敌人攻击你(无论该敌人当前位于何处)。
//
// 读点（声明即接线）：
//   · 涌动 = encounterResolve 返回 { gainSurge: true }（encounter.js#finishDraw 读 resolution.gainSurge）；
//   · 显现检定在本条目结算（treachery-tokens.js#resolveTreacheryBody 的 entryRevelation 分支，
//     api = scenarioRuntime）：api.test(seat, skill, difficulty, resolve, ...)；
//   · 「最近的怪物敌人」= 用 _shared.js#entryDistance 按图连接计算距离（并列时 api.choice 选择）；
//   · 「攻击你（无论位于何处）」= api.attack（scenario-runtime 的剧本攻击入口，不改敌人位置）。
import { entryDistance } from '../../../_shared.js'

const CODE = '11730'
const DIFFICULTY = 3

const isMonster = enemy => (enemy?.traits || []).some(trait => String(trait).toLowerCase() === 'monster')

function nearestMonsters(state, from) {
  const monsters = (state.enemies || []).filter(enemy => !enemy.defeated && !enemy.removedFromGame && isMonster(enemy))
  const scored = monsters.map(enemy => ({ enemy, distance: entryDistance(state, from, enemy.location) }))
  const finite = scored.filter(row => Number.isFinite(row.distance) && row.distance >= 0)
  const pool = finite.length ? finite : scored
  if (!pool.length) return []
  const nearest = Math.min(...pool.map(row => row.distance))
  return pool.filter(row => row.distance === nearest).map(row => row.enemy)
}

export default {
  code: CODE,
  name: '狡诈拟态',
  scope: 'treachery',
  implemented: true,
  flags: { traits: ['Scheme'], quantity: 2, test: { skill: 'intellect', difficulty: DIFFICULTY } },
  encounterResolve(state, inv, card, api) {
    const monsters = (state.enemies || []).filter(enemy => !enemy.defeated && !enemy.removedFromGame && isMonster(enemy))
    if (!monsters.length) {
      api.info?.('🌀 「狡诈拟态」：场上没有怪物敌人，获得涌动。')
      return { gainSurge: true }
    }
    api.test(inv.seat, 'intellect', DIFFICULTY, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「狡诈拟态」检定（智识 ${result.value} vs ${DIFFICULTY}）。`)
        return
      }
      const candidates = nearestMonsters(state, inv.location)
      if (!candidates.length) return
      const answer = candidates.length === 1 ? candidates[0].id : api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat,
        prompt: '「狡诈拟态」：选择最近的一名怪物敌人（并列）。',
        options: candidates.map(enemy => ({ id: enemy.id, label: api.cardName?.(enemy.originalCode || enemy.code) || enemy.name || enemy.code })),
      })
      const chosen = candidates.find(enemy => enemy.id === String(answer)) || candidates[0]
      api.attack(chosen, inv)
      api.info?.(`👁️ 「狡诈拟态」：${inv.name} 检定失败，最近的一名怪物敌人「${chosen.name}」攻击 ta（无论其位于何处）。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '狡诈拟态' })
    return false
  },
  note: '涌动按卡面在「场上无怪物敌人」时返回 { gainSurge:true }；显现检定与失败后的「最近怪物敌人攻击」'
    + '都在条目内自足实现，攻击走 api.attack（不移动敌人）。「最近怪物敌人」与参考 nearest-with-fallback '
    + '匹配器同口径（没有可达敌人时退回任一怪物敌人）；并列最近时由显现者选择（参考亦为显现者选择）。',
}
