// 09087 爆炸结界（Explosive Ward）· 秘术师事件 · 0 经验。
// 卡面：你打出爆炸结界前，可以从自己的法术槽位弃掉任意数量的卡牌。
//       对一个与你交战的非[[精英]]敌人造成 X 点伤害。X 不能大于你没有支援的法术槽位数量。
//       本行动不会触发趁乱攻击。
//
// 读点：X 费用 = chooseResourceCostOnPlay（支付前选择 X）；X 的实际支付额从 played 描述子的
//       context.playCost.cost 读取；伤害 api.damageEnemy；弃法术支援 api.discardAsset；
//       「不触发趁乱攻击」写在 played.noOpportunityAttack。
//
// approximation（已写 primitive-request/09087.json）：
//   · 「打出前弃法术槽位」在引擎里发生在选择 X 之后（支付前窗口晚于 X 选择），因此本实现
//     在结算时弃置并把空格数量作为 X 的上限；测试覆盖上限钳制。
//   · 法术槽容量按通用 2 个计算（引擎没有公开容量读数）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const arcaneAssets = inv => (inv.assets || []).filter(asset => (ALL_CARDS[asset.code]?.slots || [])
  .some(slot => String(slot).trim().toLowerCase().startsWith('arcane')))
const emptyArcaneSlots = inv => Math.max(0, 2 - arcaneAssets(inv).reduce((total, asset) => {
  const slots = ALL_CARDS[asset.code]?.slots || []
  return total + slots.reduce((sum, slot) => {
    const key = String(slot).trim().toLowerCase()
    return sum + (key === 'arcane x2' ? 2 : key === 'arcane' ? 1 : 0)
  }, 0)
}, 0))

export default {
  code: '09087',
  simplified: true,
  note: 'approximation: 见 primitive-request/09087.json（「打出前弃法术槽」在 X 选择之后结算；槽位容量按 2 计）',
  chooseResourceCostOnPlay: true,
  abilities: [
    {
      kind: 'played',
      noOpportunityAttack: true,
      label: '弃任意数量法术槽位支援；对交战的非精英敌人造成 X 伤害（X ≤ 空法术槽）',
      resolve: ({ state, inv, context, api }) => {
        while (true) {
          const candidates = arcaneAssets(inv)
          if (!candidates.length) break
          const picked = api.choice({
            kind: 'discard', source: '09087', seat: inv.seat, canSkip: true,
            prompt: '是否从法术槽位弃掉一张支援？（可重复，直到选择「完成」）',
            options: [{ id: 'done', label: '完成' },
              ...candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))],
          })
          if (!picked || picked === 'done') break
          const asset = candidates.find(item => item.id === picked)
          if (!asset) break
          api.discardAsset(inv.seat, asset)
          api.info(`🔥 「爆炸结界」：从法术槽位弃掉「${api.cardName(asset.code)}」。`)
        }
        const paidX = Number(context?.playCost?.cost ?? 0)
        const damage = Math.min(paidX, emptyArcaneSlots(inv))
        const targets = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat && !enemy.elite)
        if (!targets.length) {
          api.info('「爆炸结界」：没有与你交战的非精英敌人。')
          return
        }
        const target = targets.length === 1 ? targets[0] : api.choice({
          kind: 'target', source: '09087', seat: inv.seat, prompt: '选择受到伤害的非精英敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
        })
        const enemy = targets.find(item => item.id === target) || targets[0]
        if (!damage) {
          api.info('「爆炸结界」：没有空的法术槽位，X 为 0。')
          return
        }
        api.damageEnemy(enemy, damage, inv.seat, { code: '09087' })
        api.info(`💥 「爆炸结界」：对「${enemy.name || enemy.code}」造成 ${damage} 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
