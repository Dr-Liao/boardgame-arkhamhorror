// 06142 无以达愿之庙（theSearchForKadath）· 地点（欧斯-纳尔盖 / 神庙，掩藏，线索1，帷幕3，胜利1）
// 卡面：掩藏。
// 卡面：进入神庙的道路被封死了。你不能进入无以达愿之庙，除非有调查员「向王祈求帮助」了。
//
// 一卡一文件：规则数据在这里声明；章节 behavior.investigatorEntryError 读取并接线。
export default {
  code: '06142', scope: 'location', implemented: true,
  locationRule: {
    entryRequirement: {
      flag: 'beseechedTheKing',
      message: '进入神庙的道路被封死了：除非有调查员「向王祈求帮助」，否则不能进入无以达愿之庙。',
    },
  },
}
