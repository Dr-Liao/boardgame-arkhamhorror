// 09024 黑曜石手串（Obsidian Bracelet）· 守卫者资产 · 0 经验。
// 卡面：黑曜石手串只可以分配诡计效果造成的伤害和/或恐惧。
//       你所在地点其他调查员受到的伤害和/或恐惧，可以分配给黑曜石手串。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 第二条（同地点其他调查员的伤害/恐惧可以分配给它）由条目 passive.assignHarmAtLocation 声明，
//     读点是 harm-threat.js#assignHarm 的跨调查员承接枚举（与 05109 同一读点）；
//   · 第一条（只承接诡计效果）没有「按来源过滤承接」的读点：passive 声明是静态的，无法区分
//     承接来源。因此只声明「可承接」这一半，并在 note 里披露（见 primitive-requests/09024.json）。
export default {
  code: '09024',
  note: 'approximation: 「只可以分配诡计效果造成的伤害/恐惧」缺按来源过滤的承接读点（passive.assignHarmAtLocation 为无条件声明），只实现「可承接同地点其他调查员的伤害/恐惧」',
  passive: { assignHarmAtLocation: true },
  abilities: [],
  modifiers: [],
}
