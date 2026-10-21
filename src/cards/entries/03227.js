// 03227 失魂落魄
// 卡面：显现 - 检查剧本日志。
// 卡面：- 如果你的疑惑高于(或等于)确信，检定[intellect](X)，其中X为你的[willpower]。如果你检定失败，受到2点伤害。
// 卡面：- 如果你的确信高于疑惑，检定[willpower](X)，其中X为你的[intellect]。如果你检定失败，受到2点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

const DOUBT_KEY = 'doubt'
const CONVICTION_KEY = 'conviction'

export default {
  code: '03227',
  abilities: [
    {
      kind: 'weakness',
      label: '失魂落魄：按疑惑/确信选择检定，失败受到 2 点伤害',
      weakness: { type: 'lostSoul' },
      resolve: ({ state, inv, api }) => {
        // 剧本日志在独立模式/旧存档里可能不存在，按 0/0（疑惑 ≥ 确信）处理。
        const records = state.campaign?.records || {}
        const doubt = Number(records[DOUBT_KEY] || 0)
        const conviction = Number(records[CONVICTION_KEY] || 0)
        const intellectTest = doubt >= conviction
        const skill = intellectTest ? 'intellect' : 'willpower'
        const difficulty = api.stat(inv.seat, intellectTest ? 'willpower' : 'intellect')
        api.test(inv.seat, skill, difficulty, {
          source: { label: '弱点', name: api.cardName('03227'), code: '03227' },
          resolve: result => { if (!result.success) api.damage(inv.seat, 2) },
        })
      },
    },
  ],
  modifiers: [],
}
