// 03299 修道院塔楼（另一条路线）
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 背面：通往修道院塔楼的门上了锁。除非你“找到了塔楼的钥匙”，否则你不能进入。
// 正面没有文字。揭示后由引擎停用 entryError。

export default {
  code: '03299', scope: 'location',
  locationRule: {
    entryError(state) {
      return state.scenarioFlags?.foundTowerKey ? null : '需要先在骑士大厅找到塔楼钥匙'
    },
  },
}
