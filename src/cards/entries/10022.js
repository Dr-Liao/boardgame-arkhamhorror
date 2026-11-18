// 10022 御札（Ofuda）· 守卫者资产 · 0 经验 · 无槽位
// 卡面：使用(1 充能)。每轮在你的地点第一次有 [bless] 标记揭示时，补满此充能。
//       [fast] 选择你所在地点的一个非 [[精英]] 敌人并花费 1 充能：该敌人失去警戒、冷漠、逃逸和
//       反击关键词，直到本轮结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 使用次数：条目级 `uses: 1` / `usesType: 'charges'`；补满走 `api.addUses(source, n)`
//     （不越过印刷上限 1）。
//   · 「每轮第一次在你所在地点揭示祝福」：`chaosTokenRevealed` 窗口（tests.js 每次揭示标记后开窗，
//     context = { when, seat, location, token, tokenIndex }）；「每轮第一次」由描述子
//     `limit: { scope: 'perRound', owner: 'instance' }` 记账（limits.js 的唯一读点）。
//   · [fast] 敌人目标：`target: { kind: 'enemy', query }`（默认同地点；query 排除精英）。
//   · 失去关键词直到本轮结束：`api.scenario.setEnemyKeywords(enemy, ['alert','aloof','elusive',
//     'retaliate'], { enabled: false })`（enemy-keyword-movement.js 的唯一写点；throughRound 缺省
//     即 state.round，到期自动失效）。
//   · 花费 1 充能 = 描述子 `cost: { action: false, uses: 1 }`（[fast]：不花行动）。
const CODE = '10022'
const MAX_CHARGES = 1
const LOST_KEYWORDS = ['alert', 'aloof', 'elusive', 'retaliate']

export default {
  code: CODE,
  name: 'Ofuda',
  uses: MAX_CHARGES,
  usesType: 'charges',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'chaosTokenRevealed',
      label: '每轮第一次在你所在地点揭示祝福标记后：补满充能',
      limit: { scope: 'perRound', owner: 'instance' },
      criteria: [({ inv, context }) => context?.token === 'bless' && context?.location === inv.location],
      resolve: ({ source, api }) => {
        if (!source) return
        const missing = Math.max(0, MAX_CHARGES - (source.uses || 0))
        if (!missing) return
        api.addUses(source, missing)
        api.info('⛩️ 御札：地点首次揭示祝福标记，补满 1 点充能。')
      },
    },
    {
      kind: 'action',
      label: '[fast] 花 1 充能：同地点一个非精英敌人失去警戒、冷漠、逃逸、反击直到本轮结束',
      target: { kind: 'enemy', query: ({ candidate }) => candidate.entity.elite !== true },
      cost: { action: false, uses: 1 },
      resolve: ({ state, targetId, api }) => {
        const enemy = (state.enemies || []).find(item => item.id === targetId)
        if (!enemy) return
        if (api.scenario.setEnemyKeywords(enemy, LOST_KEYWORDS, { enabled: false })) {
          api.info(`⛩️ 御札：「${enemy.name || enemy.code}」失去警戒、冷漠、逃逸、反击直到本轮结束。`)
        }
      },
    },
  ],
  modifiers: [],
}
