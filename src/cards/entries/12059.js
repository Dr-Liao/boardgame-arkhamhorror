// 12059 宇宙烈焰（Cosmic Flame）
// 卡面：使用(3充能)。
//       [action]：攻击([willpower])。如果你检定成功，你可以花费1充能以使本次攻击造成伤害+1。
//       如果你本次检定期间揭示了[skull]标记，移除宇宙烈焰的1充能（如果你不能这么做，受到1点伤害并弃掉本卡牌）。
//
// 读点：
//   · 充能 → 条目级 uses/usesType（实例初始化读点）；
//   · 攻击（意志）→ api.fight({ skill:'willpower', assetId })；
//   · 成功后可选花 1 充能 +1 伤害 → doFight 的 maySpendUsesForDamage 选项（combat.js）；
//   · 揭示[skull]后移除 1 充能（无充能则 1 伤害 + 弃牌）→ forced 'skullRevealed' 窗口 + skillTest.source.assetId
//     精确匹配本实例；数量读写走 api.setAssetUses / api.discardAsset / api.damage。
import { attackableEnemies } from './_shared.js'

const CODE = '12059'

export default {
  code: CODE,
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      cost: { action: true },
      target: { kind: 'enemy', query: ({ state, inv, candidate }) => attackableEnemies(state, inv).some(enemy => enemy.id === candidate.id) },
      label: '攻击（意志）：成功后可选花 1 充能使本次攻击 +1 伤害',
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        api.fight(inv.seat, enemy.id, {
          skill: 'willpower', assetId: source?.id, trackAssetSource: true,
          maySpendUsesForDamage: { uses: 1, damage: 1 },
        })
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
