// 90063 可靠的长鞭（Trusty Bullwhip · Advanced）· 中立 · 支援/道具/武器/近战 · 手部槽 · 蒙特雷牌库专用。
//
// 卡面（cards-data 90063）：
//   Fast. Monterey Jack deck only. Advanced.
//   [action]: Fight. This attack uses [agility] instead of [combat]. You get +2 skill value for this
//     attack. If this attack succeeds, you may exhaust Trusty Bullwhip to deal +1 damage for this
//     attack and automatically evade the attacked enemy.
//
// 引擎读点（与基础版 08008 同一套，差异在 +2 与「+1 伤害**并**自动躲避」）：
//   · 快速：条目级 `fast: true`（card-defs/validateMove 的快速读点）。
//   · 攻击：`api.fight(seat, enemyId, { skill:'agility', assetId, combatBonus:2, onSuccess })`——
//     combat.js 的 actionTestSkill 用 opts.skill 指定敏捷，combatBonus 计入本次检定的 skillBonus。
//   · 成功后可选横置：onSuccess 在伤害结算前触发，可写 `opts.damageBonus += 1` 与
//     `api.autoEvadeEnemy(enemy)`；横置状态由 `source.exhausted` 判定（与 08008 同口径）。

const code = '90063'

export default {
  code,
  fast: true,
  abilities: [
    {
      kind: 'action',
      label: '攻击（敏捷 +2；成功后横置可 +1 伤害并自动躲避）',
      cost: { action: true },
      countsAs: 'fight',
      target: { kind: 'enemy' },
      resolve: ({ inv, target, source, api }) => {
        if (!target) return
        const whipId = source?.id ?? null
        api.fight(inv.seat, target.id, {
          skill: 'agility',
          assetId: whipId,
          combatBonus: 2,
          onSuccess: ({ enemy, opts }) => {
            const whip = (inv.assets || []).find(asset => asset.id === whipId)
            if (!whip || whip.exhausted) return
            const answer = api.choice({
              kind: 'effect', source: whipId || code, seat: inv.seat,
              prompt: '横置可靠的长鞭：本次攻击 +1 伤害并自动躲避受攻击的敌人？',
              options: [{ id: 'skip', label: '不横置' }, { id: 'exhaust', label: '横置：+1 伤害并自动躲避' }],
            })
            if (answer !== 'exhaust') return
            api.exhaust(whip)
            opts.damageBonus = (opts.damageBonus || 0) + 1
            if (enemy && !enemy.defeated) api.autoEvadeEnemy(enemy)
          },
        })
      },
    },
  ],
  modifiers: [],
}
