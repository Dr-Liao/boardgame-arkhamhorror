// 10110 草叉（Pitchfork）· 潜袭者支援 · 0 经验 · 3 资源 · 双手 · 道具/工具/武器/近战
// 卡面：[action]：攻击。本次攻击你得到 +1[combat] 并造成 +2 伤害。如果本次攻击成功，
//       失去对草叉的控制并将它附属到你所在地点。附属地点获得：
//       「[action]：控制草叉。草叉所在地点的任意调查员均可以触发此能力。」
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 攻击加值/加伤害 = api.fight(seat, enemyId, { combatBonus: 1, damageBonus: 2 })
//     （加值只在成功时并入伤害，与印刷「如果本次攻击成功」同口径）。
//   · 「失去控制并附属到所在地点」= api.attachSelfToLocation(source, inv.location, { ownerSeat: null })：
//     leaveAsset 把支援移出控制区，attachCardTo 写 location.attachments（04270 骷髅钥匙的同一原语）。
//     ownerSeat 写 null（而不是原控制者）是为了让「任意调查员都可以触发取回能力」成立：
//     moves.js 的地点附属行动枚举对 ownerSeat !== 自己 的附属会跳过。
//   · 「附属地点获得 [action]：控制草叉」= 条目级 detachAction: true。引擎读点：
//     moves.js 枚举 detachLocationAttachment（1 行动），movement.js#doDetachLocationAttachment 把附属
//     从地点取下并在行动者控制区新建实例（即「控制草叉」）。文案是引擎的「解除……并放回游戏区域」。
//   · 已知近似：地点离场时 locations.js#removeLocation 只把 ALL_TREACHIES 推进遭遇弃牌堆，
//     location.attachments 里的玩家卡会随地点一起消失（不会进弃牌堆）；hosted 附属（hostedPlayerAsset）
//     才走 discardHostedAssets。取回行动本身是真实引擎路径。
const CODE = '10110'

export default {
  code: CODE,
  name: 'Pitchfork',
  // 地点附属上的「取回」行动读点（moves.js / movement.js#doDetachLocationAttachment）。
  detachAction: true,
  simplified: true,
  note: 'approximation: 成功后的「附属到你所在地点」用 attachSelfToLocation 实现（ownerSeat:null 让任意调查员都能取回）；「控制草叉」由引擎的 detachLocationAttachment 行动结算（1 行动、新建实例），日志文案是「解除……并放回游戏区域」。地点离场时该玩家附属不会走 discardHostedAssets（会随地点消失）。见 primitive-requests/10110.json。',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { action: true },
      label: '攻击：战斗 +1、伤害 +2；成功后草叉失去控制并附属到所在地点（任意调查员可花 1 行动取回）',
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const result = api.fight(inv.seat, enemy.id, { combatBonus: 1, damageBonus: 2 })
        if (!result?.success || !source) return
        const covered = api.attachSelfToLocation(source, inv.location, { ownerSeat: null })
        if (!covered) {
          api.info('🍴 草叉：无法附属到所在地点，草叉留在你的控制下。')
          return
        }
        api.info(`🍴 草叉：攻击成功，失去控制并附属到「${api.locationName(inv.location)}」；该地点的任意调查员可以花 1 行动控制草叉。`)
      },
    },
  ],
  modifiers: [],
}
