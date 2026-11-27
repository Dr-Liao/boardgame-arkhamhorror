// 08501 亡命冰原 I–III 共用混乱标记参考卡；各幕的标记修正与失败后果由当前剧本提供。
export default {
  code: '08501', scope: 'scenario', implemented: true,
  flags: {
    tokenModifiers: {
      standard: { cultist: -2, tablet: -3 },
      hard: { cultist: -2, tablet: -4 },
    },
  },
}
