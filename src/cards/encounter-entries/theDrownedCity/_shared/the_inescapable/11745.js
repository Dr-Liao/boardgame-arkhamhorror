// 11745 仍在你身后（Still Behind You）· 诡计 · 共享遭遇组 the_inescapable（印刷 3 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/the_inescapable。
// 卡面（cards-data 11745）：
//   显现 - 检定[agility](2)。胜利区每有1张仍在你身后，本检定难度+1。
//          如果你失败且穷途异魔……
//          - ……在场，其逐处地点移动到你所在地点并与你交战。
//          - ……不在场，查找所有场上和场外区域，找出穷途异魔，将其抽取。将仍在你身后加入胜利区。
//
// 读点（声明即接线）：
//   · 难度 = 2 + 胜利区里本卡张数（state.victoryDisplay，只读）；检定 = api.test；
//   · 「逐处地点移动到你所在地点」= _shared.js#shortestNextStep 逐步走 + api.moveEnemy
//     （每次移动都触发引擎的敌人移动读点），最后 api.engage 交战；
//   · 「不在场：查找所有场上/场外区域」= 场景放一边（api.takeFromSetAside）、遭遇牌库/弃牌堆
//     （api.takeEncounterCard）、放一边敌人（api.scenario.restoreEnemyFromAside）与移除区
//     （state.removedFromGame）逐处查找；找到后 api.drawEncounter({ code }) 走真实遭遇管线生成/交战；
//   · 「将仍在你身后加入胜利区」= api.addStoryToVictory(CODE)——encounter.js 结算后按胜利区新增
//     判定本卡已「放置」，不会再进遭遇弃牌堆。
import { shortestNextStep } from '../../../_shared.js'

const CODE = '11745'
const ENEMY = '11744'
const BASE_DIFFICULTY = 2

const copiesInVictory = state => (state.victoryDisplay || [])
  .filter(card => String(card?.originalCode || card?.code || card) === CODE).length

const inescapableInPlay = state => (state.enemies || [])
  .find(enemy => String(enemy.originalCode || enemy.code) === ENEMY && !enemy.defeated && !enemy.removedFromGame) || null

/** 在场上/场外所有能找到它的区域里取出穷途异魔；返回取出的来源说明。 */
function findOutOfPlayInescapable(state, api) {
  if (api.takeFromSetAside?.(ENEMY)) return 'setAside'
  const fromEncounter = api.takeEncounterCard?.(ENEMY, { pile: 'encounterDeck' })
    || api.takeEncounterCard?.(ENEMY, { pile: 'encounterDiscard' })
  if (fromEncounter) return fromEncounter.pile
  const aside = (state.setAsideEnemies || []).find(enemy => String(enemy.originalCode || enemy.code) === ENEMY)
  if (aside) return 'setAsideEnemy'
  if ((state.removedFromGame || []).includes(ENEMY)) return 'removedFromGame'
  if ((state.scenarioZones?.setAside || []).includes(ENEMY)) return 'setAside'
  // 胜利区也算「场外」：被击败并进入胜利区后，把它的物理卡取回再抽取。
  if ((state.victoryDisplay || []).some(card => String(card?.originalCode || card?.code || card) === ENEMY)) {
    api.scenario?.takeFromVictory?.(ENEMY)
    return 'victoryDisplay'
  }
  return null
}

export default {
  code: CODE,
  name: '仍在你身后',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Scheme'],
    quantity: 3,
    test: { skill: 'agility', difficulty: BASE_DIFFICULTY, plusCopiesInVictory: 1 },
    failedAgainst: ENEMY,
  },
  encounterResolve(state, inv, card, api) {
    const difficulty = BASE_DIFFICULTY + copiesInVictory(state)
    api.test(inv.seat, 'agility', difficulty, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「仍在你身后」检定（敏捷 ${result.value} vs ${difficulty}）。`)
        return
      }
      const enemy = inescapableInPlay(state)
      if (enemy) {
        let guard = 0
        while (enemy.location !== inv.location && guard < 32) {
          guard += 1
          const next = shortestNextStep(state, enemy.location, inv.location)
          if (!next) break
          api.moveEnemy?.(enemy, next)
        }
        if (enemy.location === inv.location) api.engage?.(enemy, inv.seat)
        api.info?.(`👣 「仍在你身后」：${inv.name} 检定失败，穷途异魔逐处地点移动到 ta 所在地点并与 ta 交战。`)
        return
      }
      const found = findOutOfPlayInescapable(state, api)
      if (found) {
        if (found === 'setAsideEnemy') {
          const aside = (state.setAsideEnemies || []).find(item => String(item.originalCode || item.code) === ENEMY)
          api.restoreEnemyFromAside?.(aside.id, inv.location)
        } else {
          api.drawEncounter(inv.seat, { code: ENEMY, suppressSurge: true })
        }
        api.info?.(`👣 「仍在你身后」：${inv.name} 检定失败，从场外找出穷途异魔并抽取它。`)
      } else {
        api.info?.('👣 「仍在你身后」：本局找不到穷途异魔（所有区域都没有它）。')
      }
      api.addStoryToVictory(CODE)
      api.info?.('👣 「仍在你身后」被加入胜利区。')
    }, 0, { code: CODE, label: '遭遇检定', name: '仍在你身后' })
    return false
  },
  note: '难度随胜利区里「仍在你身后」的份数递增；失败后分「在场（逐地点移动并交战）」与'
    + '「不在场（查找场外区域、抽取穷途异魔并加入胜利区）」两条分支。'
    + '场外查找覆盖：场景放一边、遭遇牌库/弃牌堆、放一边敌人、移除区、胜利区（第三/四轮补齐）；'
    + '找到后统一走 api.drawEncounter 生成/交战。近似：其它尚未枚举的章节私有牌库/极少数容器不在查找范围。',
}
