// 06346 阿特拉克·纳克亚（敌人，1 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：Massive（庞大）；精英古神·蜘蛛。
//   强制 - 在阿特拉克·纳克亚离开一个地点时：如果该地点上没有调查员，在该地点上放置 1 个毁灭标记。
//     否则，其攻击该地点的每位调查员。
//   强制 - 你躲避阿特拉克·纳克亚后：其不横置，改为选择你所在地点的一位调查员。它本轮不能攻击所选调查员。
// 接线：enemyScript.onMoved 由 TDE 共享层 enemyMoved 派发（第 3 实参是「移动前地点」）；
//   onEvade 由章节 behavior.afterEvade 派发（共享层未内置，见 worker 报告的共享层请求）。
//   simplified：引擎没有「不能攻击指定调查员」的读点，躲替代实现为「不横置 + 本轮不攻击任何人」。
import { activeInvestigators } from '../../_shared.js'

function doomAt(state, api, locationId) {
  const location = (state.locations || []).find(item => item.id === locationId)
  if (!location) return
  api.locationDoom?.add(location, 1)
  api.info?.(`🕸️ 「${location.name}」上放置 1 个毁灭标记。`)
}

export default {
  code: '06346',
  scope: 'enemy',
  implemented: true,
  simplified: true,
  note: '躲避替代的「不能攻击所选调查员」缺引擎读点：实现为不横置 + 本轮不攻击任何人（见 primitive-request w-p8-f-evade-protection）；离开地点与击败标记已实现。',
  enemyScript: {
    onMoved(state, enemy, previousLocation, api) {
      const previous = previousLocation || null
      if (!previous) return
      const present = activeInvestigators(state).filter(inv => inv.location === previous)
      if (!present.length) { doomAt(state, api, previous); return }
      api.info?.(`🕷️ 阿特拉克·纳克亚离开「${api.locName?.(previous) || previous}」：攻击该地点的每位调查员。`)
      for (const inv of present) {
        api.attack?.(enemy, inv)
        if (inv.defeated || inv.resigned) break
      }
    },
    onEvade(state, inv, enemy, result, api) {
      const here = inv?.location ?? enemy.location
      const candidates = activeInvestigators(state).filter(one => one.location === here)
      const answer = candidates.length <= 1 ? candidates[0]?.seat : api.choose?.({
        kind: 'target', source: '06346', seat: inv?.seat ?? state.currentSeat,
        prompt: '阿特拉克·纳克亚被躲避：选择它本轮不能攻击的调查员。',
        options: candidates.map(one => ({ id: String(one.seat), label: one.name })),
      })
      api.readyEnemy?.(enemy)
      api.skipEnemyAttackThisRound?.(enemy)
      api.setScenarioFlag?.('atlachNachaEvadeProtected', { round: state.round, seat: Number(answer ?? candidates[0]?.seat) })
      api.info?.('🕷️ 阿特拉克·纳克亚没有横置；本轮它不能攻击所选调查员。')
    },
    onDefeated(state, enemy, api) {
      api.setScenarioFlag?.('atlachNachaDefeated', true)
      return false
    },
  },
}
