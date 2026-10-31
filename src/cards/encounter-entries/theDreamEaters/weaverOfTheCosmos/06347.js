// 06347 阿特拉克·纳克亚之腿（敌人，1 张；标签 legs1）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：Massive；本敌人不能进行趁乱攻击。X 为本敌人所在地点的隐藏值（战斗值 = X）。
//   强制 - 在你将要躲避本敌人时：其不横置，改为选择你所在地点的一位调查员。本敌人本轮不能攻击所选调查员。
// 实现：声明式修正 modifiers（引擎 entityModifierTotal 读点，D1 通道）——不发动借机攻击 +
//   enemyFight 补到所在地点隐藏值（印刷卡面把 X 记作 -2，修正 = 隐藏值 + 2 抵消基数）。
//   躲避替代走 enemyScript.onEvade（章节 behavior.afterEvade 派发），同 06346 的 simplified 说明。
import { activeInvestigators } from '../../_shared.js'

export const legsFightModifier = ({ state, entity }) => {
  const location = (state.locations || []).find(item => item.id === entity?.location)
  return Number(location?.shroud || 0) + 2
}

export default {
  code: '06347',
  scope: 'enemy',
  implemented: true,
  simplified: true,
  note: '躲避替代的「不能攻击所选调查员」缺引擎读点：实现为不横置 + 本轮不攻击任何人（见 primitive-request w-p8-f-evade-protection）。',
  modifiers: [
    { target: 'cannot:opportunityAttack' },
    { target: 'enemyFight', amount: legsFightModifier },
  ],
  enemyScript: {
    onEvade(state, inv, enemy, result, api) {
      const here = inv?.location ?? enemy.location
      const candidates = activeInvestigators(state).filter(one => one.location === here)
      const answer = candidates.length <= 1 ? candidates[0]?.seat : api.choose?.({
        kind: 'target', source: '06347', seat: inv?.seat ?? state.currentSeat,
        prompt: '阿特拉克·纳克亚之腿被躲避：选择它本轮不能攻击的调查员。',
        options: candidates.map(one => ({ id: String(one.seat), label: one.name })),
      })
      api.readyEnemy?.(enemy)
      api.skipEnemyAttackThisRound?.(enemy)
      api.setScenarioFlag?.('atlachNachaEvadeProtected', { round: state.round, seat: Number(answer ?? candidates[0]?.seat) })
      api.info?.('🕷️ 阿特拉克·纳克亚之腿没有横置；本轮它不能攻击所选调查员。')
    },
  },
}
