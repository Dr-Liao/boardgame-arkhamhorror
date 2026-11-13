// 09056 外科手术工具（Surgical Kit）· 探寻者（Seeker）资产 · 3 经验 · 道具 · 工具 · 科学。
//
// 卡面：使用(4 补给)。
//       [reaction] 当你的一张卡牌效果治愈一名调查员的伤害时，花费 1 补给：该效果额外治愈 1 点伤害，
//       或你抽 1 张牌并治愈 1 点恐惧。
//       [action][action]：治愈你所在地点一位调查员或一个[[盟友]]支援的 3 点伤害。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「治愈后追加治疗」→ damageHealed 窗口（harm-threat.js#healDamageFrom 在真正治疗 ≥1 点后开窗，
//     context 带 seat（治疗者）、healedSeat、amount、assetId）。
//   · 「额外治愈 1 点」→ api.healDamage / 「抽 1 张 + 治愈 1 点恐惧」→ api.drawCardsLogged + api.healHorror
//     （都是统一治疗入口，会按规则再开窗口）。
//   · [action][action] 的双行动费用：描述子的 `cost.action: 2`（turn-flow.js#actionCost 对数值
//     action 返回 2，dispatch 校验并扣 2 个行动；P1-8 前用 criteria 预检 + api.loseActions 手动补扣，
//     结果只剩 1 行动时能力仍可点、结算中途失败）。
const CODE = '09056'

export default {
  code: CODE,
  uses: 4,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'damageHealed',
      cost: { uses: 1 },
      label: '你的卡牌效果治愈调查员伤害后：花费 1 补给，额外治愈 1 点伤害或抽 1 张并治愈 1 点恐惧',
      criteria: [({ source, context, inv }) => {
        if (!source || (source.uses || 0) <= 0) return false
        if (!Number.isInteger(context?.healedSeat)) return false
        // 「你的一张卡牌效果」：治疗者座位就是本卡的持有者。
        return context.seat === inv.seat
      }],
      resolve: ({ inv, api, context }) => {
        const healSeat = context.healedSeat
        const answer = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '「外科手术工具」：选择额外效果。',
          options: [
            { id: 'heal', label: '该效果额外治愈 1 点伤害' },
            { id: 'draw', label: '抽 1 张牌并治愈 1 点恐惧' },
          ],
        })
        if (answer === 'draw') {
          api.drawCardsLogged(inv.seat, 1)
          api.healHorror(healSeat, 1)
          api.info('🧪 「外科手术工具」：抽 1 张牌并治愈 1 点恐惧。')
          return
        }
        api.healDamage(healSeat, 1)
        api.info('🧪 「外科手术工具」：该效果额外治愈 1 点伤害。')
      },
    },
    {
      kind: 'action',
      cost: { action: 2 },
      label: '[action][action]：治愈你所在地点一位调查员或一个[[盟友]]支援的 3 点伤害',
      resolve: ({ state, inv, api }) => {
        const options = []
        for (const other of api.investigatorsAt(inv.location)) {
          if ((other.damage || 0) > 0) options.push({ id: `seat:${other.seat}`, label: `${other.name}（${other.damage} 点伤害）` })
        }
        for (const other of api.investigatorsAt(inv.location)) {
          for (const asset of other.assets || []) {
            const traits = api.cardTraits(asset.code).map(trait => String(trait).toLowerCase())
            if (!traits.includes('ally')) continue
            if (!(asset.damage > 0)) continue
            options.push({ id: `asset:${asset.id}`, label: `${api.cardName(asset.code)}（${asset.damage} 点伤害）` })
          }
        }
        if (!options.length) {
          api.info('「外科手术工具」：同地点没有受伤的调查员或[[盟友]]支援。')
          return
        }
        const picked = options.length === 1 ? options[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「外科手术工具」：选择要治愈 3 点伤害的目标。', options,
        })
        if (String(picked).startsWith('seat:')) {
          const seat = Number(String(picked).slice('seat:'.length))
          const healed = api.healDamage(seat, 3)
          api.info(`🧪 「外科手术工具」：治愈 ${state.investigators[seat]?.name || `座位 ${seat}`} ${healed} 点伤害。`)
          return
        }
        const assetId = String(picked).slice('asset:'.length)
        const owner = api.investigatorsAt(inv.location).find(other => (other.assets || []).some(item => item.id === assetId))
        const card = owner?.assets.find(item => item.id === assetId)
        if (!card) return
        api.healAsset(card, { damage: 3, owner })
        api.info(`🧪 「外科手术工具」：治愈「${api.cardName(card.code)}」3 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
