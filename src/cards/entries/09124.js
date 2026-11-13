// 09124 暗处潜伏者（Lurker in the Dark）· 基础弱点 · 敌人
// 卡面：[guardian] 调查员专用。
//       猎手。
//       生成 - 任意连接地点。
//       暗处潜伏者只能用[[武器]]支援或[[策略]]事件攻击或造成伤害，且从每个来源受到的伤害减少 1 点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 敌人型弱点：弱点描述子带 resolve 时接管整段显现（weakness.js 先找 descriptor.resolve），
//     因此可在 resolve 里用 api.spawnEnemyAt 选择连接地点生成（不与该调查员交战）；
//   · 猎手：条目级 enemyWeakness（card-lookup.js#enemyDef 合并）；
//   · 每次受伤 -1：条目级 enemyRule.damageReductionExceptSourceTraits（combat.js 攻击伤害段唯一读点）。
//     该原语要求 traits 非空：武器/策略来源豁免减伤，其余来源伤害 -1（最低 0）。
// approximation: ①「只能用[[武器]]支援或[[策略]]事件攻击/造成伤害」没有来源特性过滤的攻击/伤害写点
//   （enemyRule.damageOnlyFrom 只接受单个卡号），未实现；②「从每个来源受到的伤害减少 1 点」在
//   该原语下只能表达为「非武器/策略来源 -1」，武器与策略来源不减伤。见 primitive-request 09124.json。
const code = '09124'

export default {
  code,
  note: '引擎读点：enemyRule.damageOnlyFromSourceTraits 限制攻击/伤害来源必须是 [[Weapon]] 支援或 [[Tactic]] 事件（combat.js#attack / enemies.js#canDamageEnemy）；enemyRule.damageReductionFromAllSources: 1 对每个来源（含武器/策略）减 1 点。',
  enemyWeakness: { hunter: true },
  enemyRule: {
    damageOnlyFromSourceTraits: { traits: ['Weapon', 'Tactic'], sourceTypes: ['asset', 'event'] },
    damageReductionFromAllSources: 1,
  },
  abilities: [
    {
      kind: 'weakness',
      label: '显现：在任意连接地点生成暗处潜伏者',
      weakness: { type: 'enemy' },
      resolve: ({ state, inv, api }) => {
        const here = (state.locations || []).find(location => location.id === inv.location)
        const connections = [...new Set(here?.connections || [])]
          .filter(id => (state.locations || []).some(location => location.id === id))
        let locationId = inv.location
        if (connections.length === 1) locationId = connections[0]
        else if (connections.length > 1) {
          locationId = api.choice({
            kind: 'location', source: code, seat: inv.seat,
            prompt: '「暗处潜伏者」：选择生成地点（任意连接地点）。',
            options: connections.map(id => ({ id, label: api.locName(id) })),
          })
        }
        if (!connections.length) {
          api.info('「暗处潜伏者」：没有连接地点，改为在所在地点生成。')
        }
        const enemy = api.spawnEnemyAt(code, locationId)
        if (enemy) {
          // 弱点敌人不与抽到它的调查员交战（生成在连接地点，由猎手关键词自行追击）。
          api.info(`👹 「暗处潜伏者」在「${api.locName(locationId)}」生成（猎手）。`)
        }
      },
    },
  ],
  modifiers: [],
}
