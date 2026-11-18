// 10014 恸哭怨魂（Weeping Yurei）· 敌人 · 怪物/灵怪 · 鸣神琥珀专属弱点
// 卡面：冷漠。逃逸。猎手。
//   猎物 - 仅对鸣神琥珀。
//   强制 - 在恸哭怨魂地点的技能检定期间，调查员揭示 [bless] 标记或 [curse] 标记后，
//   如果恸哭怨魂处于重整状态：恸哭怨魂攻击该调查员。（每次检定仅限一次。）
//
// 读点：
//   · 冷漠/猎手/猎物：条目级 `enemyWeakness`，由 card-lookup.js#enemyDef 合并进弱点敌人定义
//     （prey = bearer，bearerSeat 即抽到它的调查员；与 09010/06025 同形）。
//   · 逃逸：`enemyRule.elusive` 由 enemy-keyword-movement.js#resolveElusiveAfterAttack 读取，
//     攻击结算后横置并移动到连接地点（P2 逃逸原语）。
//   · 强制触发：`chaosTokenRevealed` 窗口（tests.js 在每次揭示标记后开窗，
//     context = { when, seat, location, token, tokenIndex }），非玩家实体强制能力由
//     openAbilityWindow 的实体块自动结算；`limit.perTest` 用 skillTest.id 记账，保证每次检定仅一次。
//   · 攻击：`api.enemyAttackByCard(enemy, label, seat)`（卡牌效果造成的敌人攻击的唯一入口）。

const BLESS = 'bless'
const CURSE = 'curse'

export default {
  code: '10014',
  scope: 'enemy',
  enemyWeakness: { aloof: true, hunter: true, prey: true },
  enemyRule: { elusive: true },
  abilities: [
    {
      kind: 'forced',
      trigger: 'chaosTokenRevealed',
      id: 'weepingYureiAttack',
      silent: true,
      limit: { scope: 'perTest', owner: 'instance' },
      label: '同地点检定揭示祝福或诅咒后：攻击该调查员（每次检定仅限一次）',
      criteria: [({ state, source, context }) => {
        if (!source || source.exhausted || !state.enemies?.includes(source)) return false
        if (![BLESS, CURSE].includes(context?.token)) return false
        if (context.location == null || source.location !== context.location) return false
        const target = state.investigators?.[context.seat]
        return Boolean(target) && !target.defeated && !target.resigned && target.location === source.location
      }],
      resolve: ({ source, context, api, inv }) => {
        const seat = Number.isInteger(context?.seat) ? context.seat : inv.seat
        api.enemyAttackByCard(source, `👻 强制 - 「${source.name}」攻击 ${inv.name}。`, seat)
      },
    },
  ],
  modifiers: [],
}
