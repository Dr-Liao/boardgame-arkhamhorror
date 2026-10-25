// 05157 凋零术
// 卡面：[action]：攻击。本次攻击不使用[combat]，改为使用[willpower]。
// 如果本次攻击期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号，
// 被攻击敌人在本回合剩余时间内得到-1攻击值和-1躲避值，最低减至1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：符号效果改成 symbolRevealed 窗口的 reaction（可被 05033「恐怖灵感」取消/再结算）：
//   主能力发起攻击前写下 endOfTest 标记效果（sourceCode='05157'、sourceInstanceId=目标敌人 id），
//   符号窗口里按标记找目标并应用 stat modifier；结算后清空 symbolEffect 标志（窗口结束口径）。

const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing']

export default {
  code: '05157',
  abilities: [
    {
      kind: 'action', label: '意志攻击（符号：被攻击敌人 -1 攻击值/-1 躲避值）',
      cost: { action: true },
      countsAs: 'fight',
      target: { kind: 'enemy' },
      resolve: ({ inv, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        // 标记本次攻击的目标：符号窗口（reaction）里据此找到「被攻击的敌人」。
        api.addEffect({
          duration: 'endOfTest', sourceCode: '05157', sourceInstanceId: enemy.id,
          label: '凋零术：本次攻击的目标', modifiers: [],
        })
        api.fight(inv.seat, enemy.id, { skill: 'willpower' })
      },
    },
    {
      kind: 'reaction', trigger: 'symbolRevealed',
      label: '凋零术：符号后被攻击敌人本回合 -1 攻击值/-1 躲避值（最低 1）',
      criteria: [({ state, inv, context }) => {
        if (!context || context.seat !== inv.seat) return false
        if (!SYMBOLS.includes(context.token)) return false
        return (state.effects || []).some(effect => effect.sourceCode === '05157')
      }],
      resolve: ({ state, api }) => {
        const marker = (state.effects || []).find(effect => effect.sourceCode === '05157' && effect.sourceInstanceId)
        const enemy = state.enemies.find(item => item.id === marker?.sourceInstanceId)
        if (enemy) {
          api.addEnemyStatModifier(enemy, { fight: -1, evade: -1, floor: 1 }, { until: 'endOfTurn' })
          api.info(`🌫️ 凋零术：「${enemy.name}」在本回合剩余时间内 -1 攻击值、-1 躲避值（最低 1）。`)
        }
        // 窗口结束：清空「取消/再结算」标志。
        api.setSymbolEffect(null)
      },
    },
  ],
  modifiers: [],
}
