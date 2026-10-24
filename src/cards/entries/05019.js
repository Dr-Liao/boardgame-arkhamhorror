// 05019 安息日男爵
// 卡面：显现 - 将安息日男爵放置入场。他身上有少于3个毁灭标记时，他不能离场。
// 卡面：强制 - 在任意数量的伤害被放置到安息日男爵所在地点的调查员上时：在该调查员上放置额外1点伤害。
// 卡面：[free]横置安息日男爵：在安息日男爵上放置1个毁灭标记。如果他身上有至少3个毁灭标记，将他弃掉。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 修复（task-22）：
//   · 「强制 - 同地点调查员受到伤害时额外 1 点」→ 挂在引擎的 harmDealt 窗口（src/engine/enemies.js:469
//     开窗，openAbilityWindow 结算 forced）；把 context.damage +1，走正常的分配/承伤管线（可被支援吸收，
//     与「放置额外 1 点伤害」的语义一致）。旧实现完全缺失该强制。
//   · 「少于 3 个毁灭标记时不能离场」→ 现有引擎只支持「有 counters 时不能离场」
//     （src/engine/harm-threat.js:93-103 读 threatCannotLeaveWhileCounters）。本条目把离场保护镜像到
//     counters（counters = 3 − doom），并在补给阶段开始与每次放毁灭后同步；doom 到 3 时 counters 归零、
//     随即弃掉。
//   · 威胁区卡的重整已由引擎修复（src/engine/phases.js:80 现在也复位 inv.threat），[free] 横置能力
//     每回合可用一次。
//
// 剩余未实现（引擎原语，见 artifacts/tcu-fix/primitive-requests/fix-investigator.json）：
//   · 「显现 - 放置入场」应进入支援区而不是威胁区（weakness.js 对所有弱点资产先 replaceAssets 再进威胁）；
//     威胁区还缺少「任意玩家窗口的 [fast] 免费触发」语义。需要引擎原语（弱点资产放入支援区 + 威胁区 [fast] 窗口）。
//   · 进入威胁区的瞬间无法同步 counters（弱点结算不经过条目 resolve），保护要到第一个补给阶段才生效。

const BARON_CODE = '05019'

const syncLeaveProtection = card => {
  if (!card) return 0
  // threatCannotLeaveWhileCounters 的读点是 counters>0；镜像成 3−doom。
  card.counters = Math.max(0, 3 - (card.doom || 0))
  return card.counters
}

export default {
  code: '05019',
  simplified: true,
  threatCannotLeaveWhileCounters: true,
  note: '「显现放置入场（支援区）」与「[fast] 任意窗口」需要引擎原语；「少于 3 毁灭不能离场」用 counters 镜像 + 补给阶段同步实现；强制额外伤害已实现。',
  abilities: [
    {
      kind: 'weakness',
      label: '安息日男爵进入你的威胁区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'forced',
      trigger: 'harmDealt',
      silent: true,
      label: '同地点调查员受到伤害时额外受到 1 点伤害',
      criteria: [({ inv, state, context, source }) => {
        if (source?.code !== BARON_CODE) return false
        if (!(Number(context?.damage) > 0)) return false
        if (!Number.isInteger(context?.seat)) return false
        const harmed = state.investigators?.[context.seat]
        // 卡面「安息日男爵所在地点」= 其控制者所在地点（男爵在控制者区域）。
        return Boolean(harmed) && harmed.location === inv.location
      }],
      resolve: ({ inv, state, context, api }) => {
        context.damage = Math.max(0, Number(context.damage) || 0) + 1
        const harmed = state.investigators?.[context.seat]
        api.info(`「安息日男爵」强制：${harmed?.name || '该调查员'} 额外受到 1 点伤害。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'phaseBegins',
      silent: true,
      label: '补给阶段开始时同步毁灭标记的离场保护',
      criteria: [({ state, source }) => source?.code === BARON_CODE && state.phase === 'upkeep'],
      resolve: ({ source }) => {
        if (!source) return
        syncLeaveProtection(source)
      },
    },
    {
      kind: 'action',
      cost: { action: false, exhaust: true },
      label: '在安息日男爵上放置 1 个毁灭标记',
      resolve: ({ api, source }) => {
        const card = source?.code === BARON_CODE ? source : null
        if (!card) return
        api.placeDoomOnCard(card, 1)
        syncLeaveProtection(card)
        if ((card.doom || 0) >= 3) {
          // 先把 counters 归零，解除「不能离场」保护，再弃掉。
          syncLeaveProtection(card)
          api.removeThreat(card)
          api.info('安息日男爵身上有 3 个毁灭标记，被弃掉。')
        }
      },
    },
  ],
  modifiers: [],
}
