// 10039 转瞬为神（Evanescent Ascension）· 晨星 · 守卫者支援 · 法术槽 · 独一无二 ·
// 绑定（奇迹祝愿）
// 卡面：
//   绑定（奇迹祝愿）。如果转瞬为神没有祝愿，将其放在一旁，位于场外。
//   [reaction] 在你地点的调查员技能检定将要失败时，花费 1 祝愿并横置转瞬为神：
//   结算该调查员的 [elder_sign] 效果（本次检定期间揭示的所有其他标记也要结算）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 绑定关系来自卡面数据 `bondedTo` / `bondedCards`（src/engine/bonded.js），条目不需要额外字段；
//     「放在一旁，位于场外」= 收回场外绑定集合 api.bonded.return(seat, '10038')
//     （bonded.js#returnToSet：扫描手牌/牌库/弃牌堆/场上/威胁区，把副本收进场外集合）。
//   · 祝愿 = 本卡实例上的 uses（usesType 'wishes'）；「没有祝愿 → 放在一旁」是条目级
//     onUsesEmptied（唯一读点 src/engine/uses.js#resolveEmptyUses，由 spendUses / setAssetUses /
//     描述子结算收尾触发）。10038 的「放置至多 X 个资源作为祝愿」应当用 api.addUses 写入同一个 uses。
//   · 「花费 1 祝愿」= 描述子 cost.uses；「横置」= cost.exhaust（ability-rules.js#payAbilityCost）。
//   · 「技能检定将要失败时」= 窗口 testWouldFail（tests.js 在标记揭示、成功判定前开窗，
// 检定将失败时，完整旧印效果写回该检定的结算窗口。
const CODE = '10039'
const PARENT = '10038' // 奇迹祝愿（绑定主卡）

export default {
  code: CODE,
  name: '转瞬为神',
  uses: 0,
  usesType: 'wishes',
  onUsesEmptied: ({ inv, api }) => {
    const returned = api.bonded.return(inv.seat, PARENT)
    api.info(returned.length
      ? `✨ 「转瞬为神」没有祝愿：放在一旁，位于场外（${returned.length} 张收回场外集合）。`
      : '✨ 「转瞬为神」没有祝愿：已放在一旁，位于场外。')
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testWouldFail',
      id: 'evanescentAscensionElderSign',
      label: '花费 1 祝愿并横置：结算该调查员的旧印效果',
      cost: { uses: 1, exhaust: true },
      criteria: [({ state, inv, source, context }) => {
        if (!source) return false
        const tester = state.investigators?.[context?.seat]
        return Boolean(tester) && !tester.defeated && !tester.resigned && tester.location === inv.location
      }],
      resolve: ({ context, api }) => api.resolveElderSignForTest(context.seat, context),
    },
  ],
  modifiers: [],
}
