// 01156 仪式地
// 归属：关卡专用 · theDevourerBelow（夜之狂热 · 第三幕：地底噬魔）
// 遭遇组：tentacles
// 卡面：强制 - 当一轮结束时，如果仪式地上的线索数量少于调查员人数的2倍：在仪式地上增加线索，直到其数量等于调查员人数的2倍。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 仪式地（01156）：回合结束时线索补至调查员人数的 2 倍。

export default {
  code: '01156',
  name: '仪式地',
  scope: 'location',
  text: '强制 - 回合结束时，若线索少于调查员人数的 2 倍，补至 2 倍。',
  locationRule: { onRoundEnd: { cluesPerInvestigator: 2 } },
}
