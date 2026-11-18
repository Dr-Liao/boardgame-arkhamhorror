// 10021 武士刀（Katana）· 守卫者资产 · 0 经验 · 双手槽
// 卡面：[action]：攻击。你本次检定得到 +2[combat]。如果你检定成功且超过难度正好 2 点，你可以
//       横置武士刀，以使本次攻击造成 +2 伤害。
//       [fast] 横置武士刀：攻击。本次攻击不使用 [combat]，改为使用 [agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · [action] 攻击：`api.fight(seat, enemyId, { assetId, combatBonus: 2 })`（attack 的唯一入口，
//     返回 B3 检定结果契约 { success, value, difficulty, ... }）。
//   · 「成功且超过难度正好 2 点…横置 +2 伤害」：`opts.onSuccess({ result, opts })` 在引擎判定成功
//     之后、伤害合计之前回调（combat.js 的 success 分支），在这里把 `opts.damageBonus` 累加 2，
//     因此 +2 伤害并入同一次攻击（不是第二次伤害结算）。横置用 `api.exhaust(source)`。
//   · [fast] 用敏捷攻击：`api.fight(..., { skill: 'agility' })`（actionTestSkill 直接接受替换技能）；
//     横置是描述子 `cost: { exhaust: true }`，`cost.action: false` 表示不花行动（[fast]）。
const CODE = '10021'

export default {
  code: CODE,
  name: 'Katana',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击：+2[combat]；成功且超过难度正好 2 点时，可横置武士刀使本次攻击 +2 伤害',
      target: { kind: 'enemy' },
      cost: { action: true },
      resolve: ({ inv, source, targetId, api }) => {
        if (!targetId) return
        api.fight(inv.seat, targetId, {
          assetId: source?.id,
          combatBonus: 2,
          onSuccess: ({ result, opts }) => {
            if (!source || source.exhausted) return
            const successBy = Number(result?.value) - Number(result?.difficulty)
            if (successBy !== 2) return
            const answer = api.choice({
              kind: 'effect', source: source?.id ?? CODE, seat: inv.seat, canSkip: true,
              prompt: '武士刀：本次检定成功且超过难度正好 2 点。是否横置武士刀，使本次攻击造成 +2 伤害？',
              options: [
                { id: 'skip', label: '不横置（本次攻击照常造成伤害）' },
                { id: 'exhaust', label: '横置武士刀：本次攻击 +2 伤害' },
              ],
            })
            if (answer !== 'exhaust') return
            api.exhaust(source)
            opts.damageBonus = (opts.damageBonus || 0) + 2
            api.info('⚔️ 武士刀：横置武士刀，本次攻击造成 +2 伤害。')
          },
        })
      },
    },
    {
      kind: 'action',
      countsAs: 'fight',
      label: '[fast] 横置：攻击（本次攻击使用敏捷代替战斗）',
      target: { kind: 'enemy' },
      cost: { action: false, exhaust: true },
      resolve: ({ inv, source, targetId, api }) => {
        if (!targetId) return
        api.fight(inv.seat, targetId, { assetId: source?.id, skill: 'agility' })
      },
    },
  ],
  modifiers: [],
}
