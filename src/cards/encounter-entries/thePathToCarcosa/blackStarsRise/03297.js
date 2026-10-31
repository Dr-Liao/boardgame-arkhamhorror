// 03297 圣奥伯特礼拜堂（另一条路线）
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 背面：通往圣奥伯特礼拜堂的路是隐藏的。除非你“找到了一个向导”，否则你不能进入。
// 正面没有文字。揭示后由引擎停用 entryError。

export default {
  code: '03297', scope: 'location',
  locationRule: {
    entryError(state) {
      return state.scenarioFlags?.foundGuide ? null : '需要先在回廊找到向导'
    },
  },
}
