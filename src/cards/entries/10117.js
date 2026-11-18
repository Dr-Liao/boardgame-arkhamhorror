// 10117 飞斧（Hatchet）· 潜袭者支援 · 1 经验 · 2 资源 · 手部 · 道具/工具/武器/远程
// 卡面：[action]：攻击。本次攻击将你的[敏捷]加入你的技能值。本次攻击造成 +1 伤害。
//       如果本次攻击击败了敌人，弃掉飞斧。否则，失去对飞斧的控制并将其附属到被攻击的敌人。
//       所附属敌人获得：「[reaction] 在所附属敌人被击败时：控制飞斧。飞斧所在地点的任意调查员均可以触发此能力。」
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「将[敏捷]加入技能值」= api.fight(seat, enemyId, { addSkill: 'agility' })（combat.js 的
//     skillBonus 读点 getStat(state, inv, opts.addSkill)）；「+1 伤害」= damageBonus: 1。
//   · 「击败敌人 → 弃掉飞斧」= 攻击后敌人已不在 state.enemies（damageEnemy 的真实结算结果），
//     api.discardAsset 走离场 + 弃牌堆唯一写点。
//   · 「否则失去控制并附属到被攻击的敌人」= api.attachControlledAsset(seat, assetId, 'enemy', enemyId)
//     （hosted-assets.js 的唯一写点：支援移出控制区、写 enemy.attachments 并标 hostedPlayerAsset）。
//   · 缺读点：所附属敌人的「被击败时 → 控制飞斧」是敌方身上的玩家卡反应，引擎的
//     nonPlayerAbilitySources 只枚举 scope 非玩家 的条目（ability.js#hasNonPlayerBehavior），
//     enemy.attachments 里的玩家卡不会成为窗口来源；敌人被击败时 discardHostedAssets 把飞斧
//     交还控制者弃牌堆而不是控制区。已在 primitive-requests/10117.json 登记。
const CODE = '10117'

export default {
  code: CODE,
  name: 'Hatchet',
  simplified: true,
  note: 'approximation: 「附属敌人被击败时控制飞斧」缺读点——玩家卡不是非玩家能力来源（enemy.attachments 不参与窗口枚举），敌人离场时引擎把 hosted 玩家附属弃到控制者弃牌堆（hosted-assets.js#discardHostedAssets），而不是让任意调查员取回。攻击加敏捷、+1 伤害、击败即弃、否则附属到敌人均已按印刷实现。见 primitive-requests/10117.json。',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { action: true },
      label: '攻击：把[敏捷]加入技能值、伤害 +1；击败敌人则弃掉飞斧，否则失去控制并附属到被攻击的敌人',
      resolve: ({ state, inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy || !source) return
        const result = api.fight(inv.seat, enemy.id, { addSkill: 'agility', damageBonus: 1 })
        if (!result?.success) return
        if (!state.enemies.includes(enemy)) {
          api.discardAsset(inv.seat, source)
          api.info('🪓 飞斧：本次攻击击败了敌人，弃掉飞斧。')
          return
        }
        const attached = api.attachControlledAsset(inv.seat, source.id, 'enemy', enemy.id)
        if (attached) {
          api.info(`🪓 飞斧：攻击未击败「${enemy.name}」，失去对飞斧的控制并附属到它身上。`)
        } else {
          api.info('🪓 飞斧：无法附属到被攻击的敌人，飞斧留在你的控制下。')
        }
      },
    },
  ],
  modifiers: [],
}
