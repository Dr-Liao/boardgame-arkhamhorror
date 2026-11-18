// 10737 野性的呼唤（Call of the Wild）· 诡计 · 共享遭遇组 the_forest（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_forest。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Revelation - Test [agility] (3). If you fail, choose the nearest enemy. That enemy attacks you.
//   If you failed and no enemy was chosen, take 2 damage instead.
//
// 读点（声明即接线）：
//   · 显现直接在本条目结算（encounterResolve；FHV 诡计的 entryRevelation 条目通道，
//     src/engine/treachery-tokens.js#resolveTreacheryBody）。
//   · 检定 = api.test（scenario-runtime.js 的检定管线：混乱标记、失败差值、日志与重放都复用）。
//   · 「最近的敌人」= _shared.js#entryDistance 的连接图 BFS；同距由领队选择（api.choice）。
//   · 该敌人攻击你 = api.attack（scenarioRuntime 的 enemyAttack，走引擎的攻击结算：伤害分配、
//     攻击后关键词与 AI 日志）。没有敌人可选时 = api.directDamage（引擎的直接伤害入口）。
import { entryDistance } from '../../../_shared.js'

const CODE = '10737'
const NAME = '野性的呼唤'
const SKILL = 'agility'
const DIFFICULTY = 3
const NO_ENEMY_DAMAGE = 2

function nearestEnemies(state, fromId) {
  const scored = (state.enemies || [])
    .filter(enemy => enemy && !enemy.defeated && !enemy.removedFromGame && enemy.location)
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
    encounterGroup: 'the_forest',
    quantity: 2,
    traits: ['Terror'],
    test: { skill: SKILL, difficulty: DIFFICULTY },
    fail: { nearestEnemyAttacks: true, noEnemyDamage: NO_ENEMY_DAMAGE },
  },
  encounterResolve(state, inv, card, api) {
    void card
    if (!inv) return false
    api.test(inv.seat, SKILL, DIFFICULTY, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「${NAME}」检定（敏捷 ${result.value} vs ${DIFFICULTY}）。`)
        return
      }
      const actor = state.investigators?.[inv.seat]
      const candidates = nearestEnemies(state, actor?.location ?? inv.location)
      if (!candidates.length) {
        api.directDamage(inv.seat, NO_ENEMY_DAMAGE)
        api.info?.(`❌ 「${NAME}」失败且没有敌人可选：${inv.name} 受到 ${NO_ENEMY_DAMAGE} 点伤害。`)
        return
      }
      const target = candidates.length === 1 ? candidates[0] : candidates.find(enemy => enemy.id === api.choice({
        kind: 'target', source: CODE, seat: inv.seat,
        prompt: `「${NAME}」：选择最近的敌人（距离相同）。`,
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
      })) || candidates[0]
      api.info?.(`❌ 「${NAME}」失败：最近的敌人「${target.name}」攻击 ${inv.name}。`)
      api.attack(target, actor)
    }, 0, { type: 'treachery', code: CODE, name: NAME })
    return false
  },
  note: '显现自足实现（api.test + 最近的敌人攻击 / 无敌人时 2 点直接伤害）。「选择最近的敌人」在距离相同时'
    + '由领队用 api.choice 指定，与引擎其它「同距由队长选择」的口径一致。',
}
