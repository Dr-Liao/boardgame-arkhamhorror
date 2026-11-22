// 12071 宇宙烈焰（Cosmic Flame，5 经验版）
// 卡面：使用(4充能)。
//       [action]：攻击([willpower])。你本次攻击得到+2[willpower]并且造成伤害+1。
//       如果你检定成功，你可以花费1充能，以对你所在地点的一个敌人造成1点伤害。
//       如果你本次检定期间揭示了[skull]标记，移除宇宙烈焰的1充能（如果你不能这么做，受到1点伤害并弃掉本卡牌）。
//
// 读点：
//   · 充能 → uses/usesType；攻击（意志+2、伤害+1）→ api.fight({ skill:'willpower', bonus/damageBonus })；
//   · 成功后可选花 1 充能对同地点敌人造成 1 伤害 → api.fight 返回结果后的可选分支 + api.spendUses +
//     api.damageEnemy（05114/10117 的「攻击后结算」同口径；敌人在同地点枚举 state.enemies）；
//   · 揭示[skull]移除充能（无充能则 1 伤害 + 弃牌）→ forced 'skullRevealed' + skillTest.source.assetId 匹配。
import { attackableEnemies } from './_shared.js'

const CODE = '12071'

export default {
  code: CODE,
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      cost: { action: true },
      target: { kind: 'enemy', query: ({ state, inv, candidate }) => attackableEnemies(state, inv).some(enemy => enemy.id === candidate.id) },
      label: '攻击（意志+2、伤害+1）：成功后可选花 1 充能，对所在地点一个敌人造成 1 伤害',
      resolve: ({ state, inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const result = api.fight(inv.seat, enemy.id, {
          skill: 'willpower', assetId: source?.id, trackAssetSource: true,
          combatBonus: 2, damageBonus: 1,
        })
        if (!result?.success) return
        const asset = (inv.assets || []).find(item => item.id === source?.id)
        if (!asset || (asset.uses || 0) <= 0) return
        const answer = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '「宇宙烈焰」：是否花费 1 充能，对所在地点的一个敌人造成 1 点伤害？',
          options: [{ id: 'spend', label: '花费 1 充能' }, { id: 'skip', label: '不花费' }],
        })
        if (answer !== 'spend') return
        if (!api.spendUses(asset, 1)) return
        const enemies = state.enemies.filter(item => item.location === inv.location)
        if (!enemies.length) return
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择受到 1 点伤害的敌人。',
          options: enemies.map(item => ({ id: item.id, label: item.name })),
        })
        const hit = enemies.find(item => item.id === enemyId) || enemies[0]
        if (!hit) return
        api.damageEnemy(hit, 1, inv.seat, CODE)
        api.info(`🔥「宇宙烈焰」：花费 1 充能，对「${hit.name}」造成 1 点伤害。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'skullRevealed',
      limit: { scope: 'perTest', owner: 'instance' },
      label: '本次检定揭示[skull]：移除 1 充能；无充能则受 1 伤害并弃掉本卡牌',
      criteria: [({ state, source }) => state.skillTest?.source?.assetId === source?.id],
      resolve: ({ inv, source, api }) => {
        const asset = (inv.assets || []).find(item => item.id === source?.id)
        if (!asset) return
        if ((asset.uses || 0) > 0) {
          api.setAssetUses(asset, (asset.uses || 0) - 1)
          api.info(`🔥「宇宙烈焰」因[skull]移除 1 充能（剩余 ${asset.uses || 0}）。`)
          return
        }
        api.damage(inv.seat, 1)
        api.discardAsset(inv.seat, asset)
        api.info(`🔥「宇宙烈焰」没有充能可移除：${inv.name} 受到 1 点伤害并弃掉本卡牌。`)
      },
    },
  ],
  modifiers: [],
}
