// 10096 催眠作用：投入时允许执行检定的调查员选择忽略期间触发的关键词和地点效果。
export default {
  code: '10096',
  abilities: [{
    kind: 'commit',
    label: '本次检定可忽略触发的关键词和地点效果',
    skill: { onCommit: ({ api }) => api.allowIgnoreTestTriggers() },
  }],
}
