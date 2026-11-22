// 60152 贝基（Becky，托米·马尔登签名）
// 卡面：使用(2子弹)。[action] 花 1 子弹：攻击([combat])，+2[combat]、伤害+1。
// [reaction] 触发上述能力时横置贝基：本次攻击忽略冷漠和反击。
// 读点：action 描述子（target enemy）+ api.fight 的 combatBonus/damageBonus/ignoreAloof/ignoreRetaliate；
// 横置时机在发起攻击前结算（印刷为反应；引擎 attack 检定的 source 不带 assetId，无法在 test 窗口可靠识别本枪，
// 故把「横置换忽略关键词」并入同一 action 的选择，见 note）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60152',
  uses: 2,
  usesType: 'ammo',
  abilities: [{
    kind: 'action',
    label: '花 1 子弹：攻击（战斗 +2，伤害 +1）',
    cost: { action: true, uses: 1 },
    countsAs: 'fight',
    target: { kind: 'enemy' },
    resolve: ({ inv, target, source, api }) => {
      if (!target) return
      let ignoreAloof = false
      let ignoreRetaliate = false
      if (source && !source.exhausted) {
        const answer = api.choice({
          kind: 'reaction', source: '60152', seat: inv.seat, canSkip: true,
          prompt: '是否横置贝基，使本次攻击忽略冷漠与反击？',
          options: [
            { id: 'skip', label: '不横置' },
            { id: 'exhaust', label: '横置贝基：忽略冷漠与反击' },
          ],
        })
        if (answer === 'exhaust') {
          api.exhaust(source)
          ignoreAloof = true
          ignoreRetaliate = true
        }
      }
      api.fight(inv.seat, target.id, {
        assetId: source?.id, combatBonus: 2, damageBonus: 1, ignoreAloof, ignoreRetaliate,
      })
    },
  }],
  note: 'approximation: 「触发上述攻击时横置贝基」并入攻击行动的选择（引擎攻击检定的 source 不携带 gun assetId，test 窗口无法识别本卡作为武器来源）。',
  modifiers: [],
}
