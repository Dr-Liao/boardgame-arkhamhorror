// 06131 萨尔纳斯（theSearchForKadath）· 地点（米纳尔 / 古代 / 遗迹，掩藏，线索1，帷幕3，胜利1）
// 卡面：掩藏。萨尔纳斯不能被翻面，除非调查员「知道伊伯发生的事情」。
// 卡面：强制 - 在你成功调查萨尔纳斯且至多超过难度1点后：受到1点恐惧。
//
// 一卡一文件：规则数据在这里声明；章节 behavior 读取：
//   · actions：翻面门槛额外要求 scenarioFlags.knowWhatHappenedToIb；
//   · afterTest：调查成功且成功差值 ≤1 时受 1 点恐惧。
export default {
  code: '06131', scope: 'location', implemented: true,
  locationRule: {
    flipRequirement: {
      flag: 'knowWhatHappenedToIb',
      message: '萨尔纳斯不能被翻面：调查员还不知道伊伯发生的事情。',
    },
    afterTest(state, location, inv, result, api) {
      if (!result?.success) return
      if (String(result.source?.label || '') !== '调查') return
      if (Number(result.successBy) > 1) return
      api.horror?.(inv.seat, 1)
      api.info?.('🏛️ 萨尔纳斯：成功调查且至多超过难度 1 点，受到 1 点恐惧。')
    },
  },
}
