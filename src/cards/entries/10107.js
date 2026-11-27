// 10107 黄铜仆从（Servant of Brass · 魔鬼家臣）· 晨曦 · 神秘者支援 · 0 费 · 无槽位 · [[召唤]] ·
//   独一无二 · 绑定（上古封印 10105）· 生命 4
// 卡面：
//   绑定（上古封印）。
//   [reaction] 在你地点的技能检定期间揭示 [curse] 标记时：对黄铜仆从造成 1 点伤害并对你所在地点或
//   一个连接地点的一个敌人造成 2 点伤害。
//   强制 - 在黄铜仆从将要离场时：将其放在一边，位于场外。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 绑定关系来自卡面数据 `bondedTo: 'Seal of the Elders'`（src/engine/bonded.js），条目不需要字段。
//   · 「在你地点的技能检定期间揭示 [curse] 标记时」= reaction + trigger:'chaosTokenResolved'
//     （tests.js ST.4 之后的窗口；与 10106/07191 同一读点），criteria 核对 token 与「你的地点」。
//   · 同一次揭示只触发一次：resolve 里写一条 endOfTest 标记效果（sourceInstanceId 带 tokenIndex），
//     criteria 见到该标记就不再列出（能力窗口会在同一窗口内重新枚举候选）。
//   · 「对黄铜仆从造成 1 点伤害」= api.placeAssetHarm(source, { damage: 1 })（支援伤恐的唯一入口，
//     达到生命上限会走 checkAssetDefeated 离场）。
//   · 「对你所在地点或一个连接地点的一个敌人造成 2 点伤害」= api.damageEnemy(enemy, 2, seat)
//     （敌人伤害的唯一入口，含击败结算）。
// 离场时通过绑定区的回收入口放在一边。
const CODE = '10107'
const CURSE = 'curse'

const markedThisToken = (state, tokenIndex) => (state.effects || []).some(effect =>
  effect.sourceCode === CODE && effect.sourceInstanceId === `${CODE}:token:${tokenIndex}`)

const markToken = (api, inv, tokenIndex) => api.addEffect({
  duration: 'endOfTest',
  sourceCode: CODE,
  sourceInstanceId: `${CODE}:token:${tokenIndex}`,
  controllerSeat: inv.seat,
  label: '黄铜仆从：本次揭示的诅咒标记已结算',
})

// 「你所在地点或一个连接地点」的敌人。
function reachableEnemies(state, inv) {
  const here = (state.locations || []).find(location => location.id === inv.location)
  const ids = new Set([inv.location, ...(here?.connections || [])])
  return (state.enemies || []).filter(enemy => ids.has(enemy.location)
    && !enemy.defeated && !enemy.removedFromGame)
}

export default {
  code: CODE,
  name: '黄铜仆从',
  zoneReplacement: { discard: 'bonded' },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'chaosTokenResolved',
      label: '揭示诅咒标记后：对黄铜仆从造成 1 点伤害，对你地点或连接地点的一个敌人造成 2 点伤害',
      criteria: [({ state, inv, source, context }) => {
        if (!source || context?.when !== 'chaosTokenResolved') return false
        if (context.token !== CURSE || context.location !== inv.location) return false
        return !markedThisToken(state, context.tokenIndex ?? 0)
      }],
      resolve: ({ state, inv, source, context, api }) => {
        api.placeAssetHarm(source, { damage: 1 })
        api.info(`🔥 「黄铜仆从」：受到 1 点伤害（${source.damage || 0}/${source.health ?? 4}）。`)
        markToken(api, inv, context?.tokenIndex ?? 0)
        const enemies = reachableEnemies(state, inv)
        if (!enemies.length) {
          api.info('🔥 「黄铜仆从」：你所在地点与连接地点都没有敌人。')
          return
        }
        const id = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「黄铜仆从」：选择要造成 2 点伤害的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === id) || enemies[0]
        if (!enemy) return
        api.damageEnemy(enemy, 2, inv.seat, CODE)
        api.info(`🔥 「黄铜仆从」：对「${enemy.name}」造成 2 点伤害。`)
      },
    },
    {
      kind: 'leavesPlay',
      label: '离场：放在一边，位于场外（收回场外绑定集合）',
      resolve: ({ inv, source, api }) => {
        if (!api.bonded.returnAsset(inv.seat, source)) return
        api.info('🔥 「黄铜仆从」：放在一边，位于场外。')
      },
    },
  ],
  modifiers: [],
}
