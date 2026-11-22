// 90061 击退邪恶（Smite the Wicked）· 中立 · 诡计/弱点 · 进阶（佐伊·萨马拉斯）。
// 卡面（cards-data 90061）：
//   进阶。所附属的敌人得到 +2 攻击值与 +2 生命值。
//   显现 - 从遭遇牌库顶弃牌，直到弃掉一个敌人。将击退邪恶附属到该敌人上，并将其生成在离你最远的地点。
//   强制 - 在游戏结束时，如果所附属的敌人在场上：佐伊·萨马拉斯承受 1 点精神创伤。
//
// 引擎读点（与 02007 原版同一套原语）：
//   · 显现 = weakness 描述子的自定义 resolve：
//     api.encounterTopEnemy（遭遇牌库顶逐张弃到敌人）、api.farthestLocations（最远地点）、
//     api.spawnEnemyAt（生成）、api.markSmiteTheWicked（smiteTheWickedSeat 标记：引擎在
//     campaign-flow.js 结局段按该标记结算 1 点精神创伤）。
//   · 「所附属敌人 +2 攻击值/+2 生命值」= api.addEnemyStatModifier(enemy, { fight: 2, health: 2 })
//     （不带 until = 持续；读点见 entityModifierTotal 的 enemyFight/enemyHealth）。
// 近似：敌人被击败时引擎的 leaveEnemyPlay 固定把 SMITE_THE_WICKED_CODE（02007）推进弃牌堆，
//   不读本卡号 → 进阶版被击败时应弃 90061 而当前会弃 02007；已在
//   primitive-requests/core-cards-a-90061-advanced-smite-code.json 请求（把卡号随标记保存）。
const code = '90061'

export default {
  code,
  storyRole: 'smiteTheWicked',
  abilities: [
    {
      kind: 'weakness',
      label: '击退邪恶（进阶）：从遭遇牌库顶弃到敌人，附属并生成在离你最远的地点',
      weakness: { type: 'attachedEnemy' },
      resolve: ({ inv, api }) => {
        const enemyCode = api.encounterTopEnemy()
        if (!enemyCode) { api.putIntoDiscard(inv.seat, code); return }
        const farthest = api.farthestLocations(inv.seat)
        if (!farthest.length) { api.putIntoDiscard(inv.seat, code); return }
        const locationId = farthest.length === 1 ? farthest[0] : api.choice({
          kind: 'location', source: code, seat: inv.seat,
          prompt: '选择距离你最远的地点，生成被惩戒的敌人。',
          options: farthest.map(id => ({ id, label: api.locName(id) })),
        })
        if (!locationId) return
        const enemy = api.spawnEnemyAt(enemyCode, locationId)
        if (!enemy) return
        api.markSmiteTheWicked(enemy, inv.seat)
        api.addEnemyStatModifier(enemy, { fight: 2, health: 2 })
        api.info(`⚔️ 「击退邪恶」附着于「${enemy.name}」（+2 攻击值/+2 生命值）。`)
      },
    },
  ],
  modifiers: [],
  note: '近似：所附属敌人的 +2 攻击值/+2 生命值已用 addEnemyStatModifier 接线；「所附属敌人被击败时弃掉本卡」引擎固定弃 02007（SMITE_THE_WICKED_CODE 常量），需把进阶卡号随标记保存 → primitive-requests/core-cards-a-90061-advanced-smite-code.json。',
}
