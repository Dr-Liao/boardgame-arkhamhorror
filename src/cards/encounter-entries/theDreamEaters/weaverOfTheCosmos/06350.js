// 06350 阿特拉克·纳克亚之腿（敌人，1 张；标签 legs4）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面同 06347：Massive；不能进行趁乱攻击；X = 所在地点隐藏值；躲避替代。
// 实现同 06347（声明式 modifiers + enemyScript.onEvade）。
import { activeInvestigators } from '../../_shared.js'

export default {
  code: '06350',
  scope: 'enemy',
  implemented: true,
  simplified: true,
  note: '躲避替代的「不能攻击所选调查员」缺引擎读点：实现为不横置 + 本轮不攻击任何人（见 primitive-request w-p8-f-evade-protection）。',
  modifiers: [
    { target: 'cannot:opportunityAttack' },
    { target: 'enemyFight', amount: ({ state, entity }) => {
      const location = (state.locations || []).find(item => item.id === entity?.location)
      return Number(location?.shroud || 0) + 2
    } },
  ],
  enemyScript: {
    onEvade(state, inv, enemy, result, api) {
      const here = inv?.location ?? enemy.location
      const candidates = activeInvestigators(state).filter(one => one.location === here)
      const answer = candidates.length <= 1 ? candidates[0]?.seat : api.choose?.({
        kind: 'target', source: '06350', seat: inv?.seat ?? state.currentSeat,
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
