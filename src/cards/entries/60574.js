// 60574 猎人直觉 · 支援（2 费，2 经验，敏捷/战斗/万用图标，才能）
// 卡面：每位调查员仅限 1 张。使用（3 补给）。
//       [reaction]你与敌人交战后，花费 1 补给并横置本卡：将一张等级 0-2 的事件从弃牌堆加入手牌。
const CODE = '60574'

export default {
  code: CODE,
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  limitPerInvestigator: 1,
  abilities: [{
    kind: 'reaction',
    trigger: 'enemyEngaged',
    label: '花费 1 补给并横置：把一张等级 0-2 的事件从弃牌堆加入手牌',
    cost: { exhaust: true, uses: 1 },
    criteria: [({ inv, context }) => !context?.seat || context.seat === inv.seat],
    resolve: ({ inv, api }) => {
      const candidates = [...new Set(inv.discard || [])].filter(code => {
        if (typeof api.cardType(code) !== 'function') return false
        const level = Number(api.cardDef?.(code)?.xp ?? 0)
        return api.cardType(code) === 'event' && level <= 2
      })
      if (!candidates.length) return
      const options = candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))
      const picked = options.length === 1 ? options[0].id : api.choice({
        kind: 'card', source: CODE, seat: inv.seat, canSkip: true,
        prompt: '猎人直觉：选择弃牌堆中一张等级 0-2 的事件加入手牌。',
        options: [{ id: 'skip', label: '不加入' }, ...options],
      })
      if (picked && picked !== 'skip' && api.moveCard({ code: picked, from: 'discard', to: 'hand' })) {
        api.info(`猎人直觉：${inv.name} 将「${api.cardName(picked)}」加入手牌。`)
      }
    },
  }],
  modifiers: [],
}

// criteria 阶段拿不到 api，用占位函数在 resolve 内重新筛选；这里始终允许窗口出现。
function apiTypeLevel() { return true }
