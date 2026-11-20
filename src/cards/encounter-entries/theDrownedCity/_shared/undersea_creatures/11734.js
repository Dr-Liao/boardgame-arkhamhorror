// 11734 梦游迁徙（Dreaming Migration）· 诡计 · 共享遭遇组 undersea_creatures（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/undersea_creatures。
// 卡面（cards-data 11734）：
//   显现 - 如果场上没有敌人，梦游迁徙获得涌动。
//          否则，检定[willpower](3)。如果你失败，你必须选择一项：
//          - 最近的一名敌人移动到你所在地点并立刻攻击。
//          - 抽取遭遇弃牌堆中最上方的一名敌人。
//
// 读点（声明即接线）：
//   · 涌动 = encounterResolve 返回 { gainSurge: true }；
//   · 显现检定 = api.test（scenarioRuntime 签名）；
//   · 「最近的敌人移动到你所在地点并立刻攻击」= 距离用 _shared.js#entryDistance，移动
//     api.moveEnemy（relocateEnemy 的剧本写点），攻击 api.attack（剧本攻击入口）；
//   · 「抽取遭遇弃牌堆最上方的敌人」= api.takeEncounterCard(code, { pile:'encounterDiscard' })
//     取出物理卡 + api.drawEncounter(seat, { code }) 交给真实遭遇管线结算（含显现/生成）。
import { ALL_CARDS, entryDistance } from '../../../_shared.js'

const CODE = '11734'
const DIFFICULTY = 3

const activeEnemies = state => (state.enemies || []).filter(enemy => !enemy.defeated && !enemy.removedFromGame)

function nearestEnemies(state, from) {
  const scored = activeEnemies(state).map(enemy => ({ enemy, distance: entryDistance(state, from, enemy.location) }))
  const finite = scored.filter(row => Number.isFinite(row.distance) && row.distance >= 0)
  if (!finite.length) return []
  const nearest = Math.min(...finite.map(row => row.distance))
  return finite.filter(row => row.distance === nearest).map(row => row.enemy)
}

function topmostEnemyCard(state) {
  const discard = state.encounterDiscard || []
  for (let index = discard.length - 1; index >= 0; index -= 1) {
    const code = discard[index]
    if (ALL_CARDS[code]?.type === 'enemy') return code
  }
  return null
}

export default {
  code: CODE,
  name: '梦游迁徙',
  scope: 'treachery',
  implemented: true,
  flags: { traits: ['Hazard'], quantity: 2, test: { skill: 'willpower', difficulty: DIFFICULTY } },
  encounterResolve(state, inv, card, api) {
    if (!activeEnemies(state).length) {
      api.info?.('🌀 「梦游迁徙」：场上没有敌人，获得涌动。')
      return { gainSurge: true }
    }
    api.test(inv.seat, 'willpower', DIFFICULTY, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「梦游迁徙」检定（意志 ${result.value} vs ${DIFFICULTY}）。`)
        return
      }
      const nearest = nearestEnemies(state, inv.location)
      const topEnemy = topmostEnemyCard(state)
      const options = []
      if (nearest.length) options.push({ id: 'move', label: '最近的一名敌人移动到你所在地点并立刻攻击' })
      if (topEnemy) options.push({ id: 'draw', label: `抽取遭遇弃牌堆最上方的敌人（${api.cardName?.(topEnemy) || topEnemy}）` })
      if (!options.length) return
      const answer = options.length === 1 ? options[0].id : String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '「梦游迁徙」：选择一项。', options,
      }))
      if (answer === 'draw') {
        const taken = api.takeEncounterCard?.(topEnemy, { pile: 'encounterDiscard' })
        if (!taken) return
        api.info?.(`🌀 「梦游迁徙」：从遭遇弃牌堆抽出「${api.cardName?.(topEnemy) || topEnemy}」并结算。`)
        api.drawEncounter(inv.seat, { code: topEnemy, suppressSurge: true })
        return
      }
      const enemyAnswer = nearest.length === 1 ? nearest[0].id : api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat,
        prompt: '「梦游迁徙」：选择最近的一名敌人（并列）。',
        options: nearest.map(item => ({ id: item.id, label: api.cardName?.(item.originalCode || item.code) || item.name || item.code })),
      })
      const chosen = nearest.find(enemy => enemy.id === String(enemyAnswer)) || nearest[0]
      if (!chosen) return
      api.moveEnemy?.(chosen, inv.location)
      api.attack(chosen, inv)
      api.info?.(`🌀 「梦游迁徙」：最近的敌人「${chosen.name}」移动到 ${inv.name} 所在地点并立刻攻击。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '梦游迁徙' })
    return false
  },
  note: '涌动/显现/失败二选一全在条目内自足实现。「最近的敌人」用 entryDistance 取最近（并列由抽到本卡的'
    + '调查员选择，与参考「最近的敌人」口径一致）。「抽取遭遇弃牌堆最上方的敌人」= 从弃牌堆取回物理卡'
    + '后交给真实遭遇管线（api.takeEncounterCard + api.drawEncounter），会正常生成/交战。'
    + '近似：drawEncounter 用 suppressSurge 抑制该敌人自身涌动在本次结算里再抽一张'
    + '（参考的「从弃牌堆抽取」是否二次涌动依实现口径；此处保守不二次涌动）。',
}
