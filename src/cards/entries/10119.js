// 10119 “恶魔”（"Devil"）· 生存者资产 · 2 经验 · 盟友槽 · 独特
// 卡面：强制 - 在你的回合开始时：从你的调查员身上将 1 点伤害移动到“恶魔”上。
//       强制 - 在“恶魔”被击败时：对你所在地点的每个敌人和每位调查员各造成 2 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「在你的回合开始时」：`turnBegins` 窗口（turn.js#turnBeginningWindow 的 reactionWindow），
//     context.seat 是被开始回合的调查员；「你的」= context.seat === inv.seat。
//   · 「移动 1 点伤害到恶魔」：`api.moveHarm(from, to, { damage: 1 })`（P6 原语 harm.moveBetween；
//     不触发受伤窗口、受目标容量限制、目标达到上限时走 asset-defeat.js 的唯一击败判定）。
//   · 「被击败时对每个敌人与每位调查员造成 2 点伤害」：`api.damageEnemy` + `api.harm`。
//     标准的「被击败时」时机是 `assetDefeated` 窗口（asset-defeat.js#checkAssetDefeated）。
//     注意：该窗口在另一个能力窗口内部（回合开始的强制能力就是如此）会被 openAbilityWindow 的
//     嵌套保护吞掉；因此回合开始这条路径在移动伤害后自己补一次判定（见下方 blastIfDefeated），
//     两条路径互斥（窗口触发时资产仍在场；窗口被吞时资产已离场），不会重复结算。
//
// 没有原语缺口：伤害移动与被击败判定都走已登记入口。
const CODE = '10119'
const BLAST = 2

function everyoneHere(state, inv) {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === inv.location)
  const investigators = (state.investigators || []).filter(other => !other.defeated && !other.resigned
    && other.location === inv.location)
  return { enemies, investigators }
}

// 「对你所在地点的每个敌人和每位调查员各造成 2 点伤害」。
function blastAtLocation(state, inv, api) {
  const { enemies, investigators } = everyoneHere(state, inv)
  for (const enemy of enemies) api.damageEnemy(enemy, BLAST, inv.seat)
  for (const other of investigators) api.harm(other.seat, { damage: BLAST })
  api.info(`👹 “恶魔”被击败：对「${inv.name}」所在地点的 ${enemies.length} 个敌人与 ${investigators.length} 位调查员各造成 ${BLAST} 点伤害。`)
}

export default {
  code: CODE,
  name: '"Devil"',
  note: '回合开始把伤害移动到自己身上时，assetDefeated 窗口在能力窗口内被引擎的嵌套保护吞掉，所以该路径在移动后按同一条规则补一次死亡反噬；普通伤害分配路径仍由 assetDefeated 强制能力结算。',
  abilities: [
    {
      kind: 'forced',
      trigger: 'turnBegins',
      label: '回合开始：从你身上移动 1 点伤害到“恶魔”',
      criteria: [({ inv, context }) => context?.seat === inv.seat && (inv.damage || 0) > 0],
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const moved = api.moveHarm({ seat: inv.seat }, { seat: inv.seat, assetId: source.id }, { damage: 1 })
        if (!moved?.damage) return
        api.info(`👹 “恶魔”：从「${inv.name}」身上移动 1 点伤害到“恶魔”上。`)
        // 「被击败时」窗口在这个强制能力内部会被嵌套保护吞掉；资产已离场时在这里补结算。
        const owner = state.investigators[inv.seat]
        if (owner && (owner.assets || []).includes(source)) return
        blastAtLocation(state, owner || inv, api)
      },
    },
    {
      kind: 'forced',
      trigger: 'assetDefeated',
      label: '“恶魔”被击败时：对你所在地点的每个敌人和每位调查员造成 2 点伤害',
      criteria: [({ source, context }) => Boolean(source) && context?.assetId === source.id],
      resolve: ({ state, inv, source, context, api }) => {
        if (!source) return
        const owner = state.investigators[context?.ownerSeat ?? inv.seat] || inv
        blastAtLocation(state, owner, api)
      },
    },
  ],
  modifiers: [],
}
