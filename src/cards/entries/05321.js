// 05321 凋零术
// 卡面：[action]：攻击。本次攻击不使用[combat]，改为使用[willpower]。你本次攻击得到+2[willpower]。
//       如果本次攻击期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号，被攻击敌人在本回合剩余时间内
//       得到-1攻击值、-1生命值和-1躲避值，最低减至1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 符号效果是攻击能力自己的「如果揭示了……」直接结算，不是反应（不询问是否触发）。
// 主能力发起攻击前写下 endOfTest 标记（sourceCode='05321'、sourceInstanceId=目标敌人 id）。
// 符号在检定揭示时、攻击伤害结算之前由 forced 直接改数值（fight/evade/health 各 -1，floor 1），
// 因此 2 点生命的敌人会先变成 1 点生命，再吃到本次攻击的伤害而被击败。
// 05033「恐怖灵感」仍在同一符号窗口的快速事件段先打出，并写入 symbolEffect；
// 这里按取消 / 再结算一次读取该标志，然后清空（窗口结束口径）。

const SYMBOL_TOKENS = ['skull', 'cultist', 'tablet', 'elderthing']

export default {
  code: '05321',
  abilities: [
    {
      kind: 'action',
      cost: { action: true },
      countsAs: 'fight',
      target: { kind: 'enemy' },
      label: '攻击（意志代替战斗，+2 意志；揭示符号后敌人本回合 -1 攻/-1 血/-1 躲）',
      resolve: ({ inv, target, api }) => {
        const enemy = target?.entity
        if (!enemy) { api.info('这里没有可攻击的敌人。'); return }
        // 标记本次攻击的目标：符号揭示时的直接效果据此找到「被攻击的敌人」。
        api.addEffect({
          duration: 'endOfTest', sourceCode: '05321', sourceInstanceId: enemy.id,
          label: '凋零术：本次攻击的目标', modifiers: [],
        })
        api.fight(inv.seat, enemy.id, { skill: 'willpower', combatBonus: 2, noSpend: true, sourceCode: '05321' })
      },
    },
    {
      kind: 'forced', trigger: 'symbolRevealed',
      silent: true,
      // 符号窗口会开两次（反应窗口与 triggerReaction）。同一场检定只结算一次。
      limit: { scope: 'perTest', owner: 'instance' },
      label: '凋零术：符号后被攻击敌人本回合 -1 攻击值/-1 生命值/-1 躲避值（最低 1）',
      criteria: [({ state, inv, context }) => {
        if (!context || context.seat !== inv.seat) return false
        if (!SYMBOL_TOKENS.includes(context.token)) return false
        return (state.effects || []).some(effect => effect.sourceCode === '05321')
      }],
      resolve: ({ state, api }) => {
        const flag = state.skillTest?.symbolEffect
        const cancelled = flag?.cancelCard === '05321'
        const times = !cancelled && flag?.repeatCard === '05321' ? 2 : 1
        api.setSymbolEffect(null)
        if (cancelled) return
        const marker = (state.effects || []).find(effect => effect.sourceCode === '05321' && effect.sourceInstanceId)
        const enemy = state.enemies.find(item => item.id === marker?.sourceInstanceId)
        if (!enemy) return
        for (let i = 0; i < times; i++) {
          api.addEnemyStatModifier(enemy, { fight: -1, evade: -1, health: -1, floor: 1 }, { until: 'endOfTurn' })
        }
        const extra = times > 1 ? '（额外结算一次）' : ''
        api.info(`💀 「凋零术」揭示了符号标记：「${enemy.name}」本回合剩余时间内 -1 攻击值/-1 生命值/-1 躲避值（最低 1）${extra}。`)
      },
    },
  ],
  modifiers: [],
}
