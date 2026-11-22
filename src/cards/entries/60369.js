// 60369 股实无忧（Easy Street，André Patel）
// 卡面：只能投入你正在执行的技能检定。每次技能检定最多投入 1 张。
//       你每有 3 资源，股实无忧获得 1 个[wild]（最多 3 个[wild]）。
export default {
  code: '60369',
  abilities: [{
    kind: 'commit',
    label: '投入时每 3 资源获得 1 个万能图标（最多 3 个）',
    skill: {
      selfTestOnly: true,
      maxPerTest: 1,
      onCommit: ({ inv, api }) => {
        api.addTestValue(Math.min(3, Math.max(0, Math.floor((inv.resources || 0) / 3))))
      },
    },
  }],
}
