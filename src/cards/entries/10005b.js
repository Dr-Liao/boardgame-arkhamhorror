// 10005b 磁通量稳定器（Flux Stabilizer）· 开启面 · 永久 · 凯特·温斯罗普牌组专用
// 卡面：
//   永久。凯特·温斯罗普牌组专用。
//   [reaction] 在你将线索放到你控制的支援上时：本阶段你下一次技能检定得到技能值 +2。
//
// 读点（卡面 → 引擎读点）：
//   · 触发：窗口 `assetCluesPlaced`（api-clue.js#transferControlledClues 唯一派发点）；
//     一次触发条件只结算一次（`limit: perWindow/instance`，避免引擎反应询问循环对同一窗口重复提供）。
//   · +2「本阶段下一次技能检定」：api.addEffect 创建 `duration: 'endOfTest'` 的持续修正
//     `skill:* +2`（与 08013a「演武·战斗」/08053「红色闹钟」同一个 Lead 已验证模式）：
//     tests.js 只在其控制者本人的检定结束时让这条效果过期，未用掉时由阶段结束的
//     expireEffects('endOfPhase') 清理，因此等价于「本阶段下一次技能检定 +2」；
//     多次触发各自生成一条效果记录，数值叠加（卡面没有「仅限一次」）。
//   · 翻面由 10005 的强制负责；开启面的条目只在 10005b 朝上时被引擎枚举
//     （physical-faces.js 后按 registeredEntry(source.originalCode || source.code) 读取当前面）。
export default {
  code: '10005b',
  name: '磁通量稳定器（开启）',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetCluesPlaced',
      // 每次触发条件（一次「把线索放到支援上」）只能触发一次；引擎的反应询问循环会对没有上限的
      // 描述子反复提供同一候选，因此用 perWindow 去重（卡面没有跨窗口的次数限制）。
      limit: { scope: 'perWindow', owner: 'instance' },
      label: '你放置线索到受控支援上后：本阶段下一次技能检定 +2',
      criteria: [({ inv, source, context }) => Boolean(source)
        && context?.seat === inv.seat
        && (Number(context?.amount) || 0) > 0],
      resolve: ({ inv, source, api }) => {
        api.addEffect({
          duration: 'endOfTest',
          sourceCode: '10005b',
          sourceInstanceId: source?.id ?? null,
          controllerSeat: inv.seat,
          label: '磁通量稳定器（开启）：下一次技能检定 +2',
          modifiers: [{ target: 'skill:*', amount: 2 }],
        })
        api.info('🧲 磁通量稳定器（开启）：本阶段下一次技能检定 +2。')
      },
    },
  ],
  modifiers: [],
}
