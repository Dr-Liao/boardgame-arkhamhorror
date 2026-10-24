// 05157 凋零术
// 卡面：[action]：攻击。本次攻击不使用[combat]，改为使用[willpower]。
// 如果本次攻击期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号，
// 被攻击敌人在本回合剩余时间内得到-1攻击值和-1躲避值，最低减至1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：意志攻击走 api.fight({ skill: 'willpower' })，攻击后用 api.testResult() 的 drawn 判断符号。
// 显式简化：敌方数值的「本回合剩余时间」修正没有通用读点（addEnemyFightReduction 只在下一次攻击
// 后消耗，且没有躲避值读点），因此攻击值 -1 只按该原语实现，躲避值 -1 未实现。

const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing']

export default {
  code: '05157',
  simplified: true,
  note: '未实现：符号触发时被攻击敌人的「-1 躲避值（最低 1）」，以及「-1 攻击值持续到本回合结束」的时长——引擎没有运行期敌方数值修正的通用读点（addEnemyFightReduction 只作用于下一次攻击，且没有躲避值修正读点）；主要效果（本次攻击改用意志）与攻击值 -1（下一次攻击口径）已实现。',
  abilities: [
    {
      kind: 'action', label: '意志攻击（符号：敌人 -1 攻击值/-1 躲避值）',
      cost: { action: true },
      // 卡面「攻击。」= Fight 行动：按 fight 结算（借机攻击豁免、行动种类展示）。
      countsAs: 'fight',
      target: { kind: 'enemy' },
      resolve: ({ state, inv, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        api.fight(inv.seat, enemy.id, { skill: 'willpower' })
        const result = api.testResult()
        // 卡面只要求「本次攻击期间揭示符号」，不要求检定成功。
        if ((result?.drawn || []).some(token => SYMBOLS.includes(token)) && state.enemies.includes(enemy)) {
          api.addEnemyFightReduction(enemy, 1)
          api.info(`凋零术：「${enemy.name}」在本回合剩余时间内 -1 攻击值（引擎原语：作用于下一次攻击）。`)
        }
      },
    },
  ],
  modifiers: [],
}
