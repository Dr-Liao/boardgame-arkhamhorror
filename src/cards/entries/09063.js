// 09063 非分之财（Embezzled Treasure）· 游荡者（Rogue）资产 · 0 经验 · 道具 · 违法。
//
// 卡面：[fast] 横置非分之财：从你资源池中将最多 2 资源移动到非分之财上（最多 10 资源）。
//       强制 - 在你撤退或游戏结束时：非分之财上每有 2 资源，选择一位调查员，该调查员在本剧本的
//       下一场冒险开始时资源池中有额外 1 资源。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 卡上的资源用实例的 uses/usesType('resources') 保存（引擎没有通用的 asset.resources 写入口，
//     见下方 approximation 与原语请求）。移动走 api.spendResources + api.addUses（都是统一记账）。
//   · 「下一场冒险 +1 资源」→ 战役记录 api.setCampaignRecord（同读点 api.campaignRecord 可回读）。
// approximation: ①卡面「资源」本应放在 asset.resources，但引擎的资源寄存原语只服务「家族遗产」
//   （investigator.resourceBank 规则），因此本卡用实例 uses 计数保存（primitive-requests/09063.json）；
//   ②「撤退或游戏结束时」没有对应窗口，改为一张可主动结算的 free 能力（同样写战役记录），
//   窗口与下一场冒险开局的读点见同一份请求。
const CODE = '09063'
const MAX_RESOURCES = 10
const recordKey = seat => `09063:bonusResources:${seat}`

export default {
  code: CODE,
  uses: 0,
  usesType: 'resources',
  simplified: true,
  note: 'approximation: 卡上资源用实例 uses 保存；撤退/游戏结束改为主动结算的 free 能力并写战役记录（primitive-requests/09063.json）。',
  abilities: [
    {
      kind: 'free',
      cost: { exhaust: true },
      label: '横置：从资源池移动最多 2 资源到非分之财上（上限 10）',
      criteria: [({ inv, source }) => (inv.resources || 0) > 0 && (source?.uses || 0) < MAX_RESOURCES],
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const room = Math.max(0, MAX_RESOURCES - (source.uses || 0))
        const amount = Math.min(2, room, inv.resources || 0)
        if (amount <= 0) {
          api.info('「非分之财」：没有可移动的资源。')
          return
        }
        api.spendResources(inv.seat, amount)
        api.addUses(source, amount)
        api.info(`💰 「非分之财」：从资源池移动 ${amount} 资源到卡上（当前 ${source.uses || 0}/${MAX_RESOURCES}）。`)
      },
    },
    {
      kind: 'free',
      label: '（撤退或游戏结束时结算）每 2 资源：选择一位调查员下个冒险开局 +1 资源',
      criteria: [({ source }) => Math.floor((source?.uses || 0) / 2) > 0],
      resolve: ({ state, inv, source, api }) => {
        const points = Math.floor((source?.uses || 0) / 2)
        if (points <= 0) {
          api.info('「非分之财」：卡上没有 2 点以上的资源。')
          return
        }
        for (let index = 0; index < points; index++) {
          const alive = state.investigators.filter(other => !other.defeated)
          if (!alive.length) return
          const seatId = alive.length === 1 ? alive[0].seat : Number(api.choice({
            kind: 'investigator', source: CODE, seat: inv.seat,
            prompt: `「非分之财」：第 ${index + 1} 位在下个冒险开局获得额外 1 资源的调查员。`,
            options: alive.map(other => ({ id: String(other.seat), label: other.name })),
          }))
          const target = state.investigators[seatId]
          if (!target) continue
          const key = recordKey(target.seat)
          const current = Number(api.campaignRecord(key) || 0)
          api.setCampaignRecord(key, current + 1)
          api.info(`💰 「非分之财」：${target.name} 将在下一场冒险开局获得额外 1 资源（累计 ${current + 1}）。`)
        }
      },
    },
  ],
  modifiers: [],
}
