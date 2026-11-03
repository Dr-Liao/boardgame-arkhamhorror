// 06199 三条A
// 卡面：多重。
//       如果你将 3 张三条A 投入到一次技能检定中，该检定自动成功（不要从混乱袋抽取混乱标记）。
//       然后，抽取 3 张卡牌并获得 3 资源（本效果每次检定最多 1 次）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 已实现：多重卡的「可把同名多张投入同一次检定」由 commit 档案的 maxPerTest 声明，
//   每张投入时按印刷的 1 个万能图标计入本次检定（图标来自 cards-data）。
// 第三张投入时设置本次检定自动成功且不抽标记；收尾只由最后一张结算一次奖励。

export default {
  code: '06199',
  abilities: [
    {
      kind: 'commit',
      label: '三条A（多重，可同名多张同时投入）',
      skill: {
        maxPerTest: 3,
        onCommit: ({ test, api }) => {
          if ((test.committed || []).filter(item => item.code === '06199').length === 3) api.setTestAutoSuccess()
        },
        afterTest: ({ inv, source, test, result, api }) => {
          const copies = (test.committed || []).filter(item => item.code === '06199')
          if (copies.length !== 3 || copies.at(-1) !== source || !result?.success) return
          api.drawCards(inv.seat, 3)
          api.gainResources(inv.seat, 3)
        },
      },
    },
  ],
  modifiers: [],
}
