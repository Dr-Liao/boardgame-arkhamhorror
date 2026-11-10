// 09009「抓钩」（Grappling Hook）· 支援 · 基玛尼专属签名
// 卡面：基玛尼牌库专用。
//   使用「抓钩」进行的行动不会引发借机攻击。
//   [action][action] 横置「抓钩」：以任意顺序进行最多 3 个不同的基础行动（交战、躲避、调查或移动）。
//   若你进行「调查」，使用 [agility] 代替 [intellect]。
//
// 读点：api.beginImmediateAction（通用「立即进行一次行动」原语，支持 actionKinds 过滤）。
//   「调查用敏捷」在 P5 先按普通调查结算（approx，记录于本注释）。
export default {
  code: '09009',
  abilities: [
    {
      kind: 'action',
      label: '[行动][行动] 横置抓钩：至多 3 个不同的基础行动（交战/躲避/调查/移动）',
      cost: { action: 2, exhaust: true },
      resolve: ({ inv, api }) => {
        for (let i = 0; i < 3; i++) {
          const started = api.beginImmediateAction(inv.seat, {
            source: '09009', actionKinds: ['engage', 'evade', 'investigate', 'move'],
          })
          if (!started) break
        }
      },
    },
  ],
  modifiers: [],
}
