// 06195 .35温彻斯特步枪
// 卡面：使用(5子弹)。
// 卡面：[action]花费1子弹：攻击。(FAQ，v1.7)你本次攻击得到+2[combat]。
//       如果本次攻击期间揭示了+1、0或[elder_sign]混乱标记，本次攻击造成+2伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：使用次数是条目级 uses/usesType；攻击走 api.fight（combatBonus 加战斗值、assetId 认武器）。
// 显式简化（simplified）：「本次攻击期间揭示了 +1、0 或 [elder_sign] 标记 → +2 伤害」——
// doFight 的伤害加值只支持固定 damageBonus，没有按揭示标记条件加伤害的选项，未实现。

export default {
  code: '06195',
  uses: 5,
  usesType: 'ammo',
  discardWhenEmpty: true,
  simplified: true,
  note: '未实现：「本次攻击期间揭示了 +1、0 或 [elder_sign] 混乱标记时 +2 伤害」——'
    + 'doFight 只支持固定伤害加值，没有按揭示标记条件加伤害的选项；'
    + '使用(5子弹)、花 1 子弹攻击、本次攻击 +2[combat] 已实现。',
  abilities: [
    {
      kind: 'action',
      label: '花费 1 子弹：攻击（战斗 +2）',
      cost: { action: true, uses: 1 },
      countsAs: 'fight',
      resolve: ({ state, inv, api, source }) => {
        const candidates = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === inv.location)
        if (!candidates.length) { api.info('没有可攻击的敌人。'); return }
        const chosenId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '06195', seat: inv.seat,
          prompt: '选择要攻击的敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const foe = candidates.find(enemy => enemy.id === chosenId) || candidates[0]
        api.fight(inv.seat, foe.id, { assetId: source?.id, combatBonus: 2 })
      },
    },
  ],
  modifiers: [],
}
