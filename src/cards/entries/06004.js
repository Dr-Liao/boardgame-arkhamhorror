// 06004 卢克·罗宾逊
// 卡面：你以门之匣在场上开始游戏。
//       你每回合可以打出 1 张事件卡牌，如同你位于一个连接地点并且与该地点的每个敌人交战。
// 卡面：[elder_sign] 效果：+1。在门之匣上放置 1 充能。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「以门之匣开始游戏」走 setup.js 既有的 `investigator.startsWith`（签名的资产直接入场）。
//   · 旧印走 api.addUses（门之匣的充能）。
//   · ⚠️ 显式简化：「每回合 1 张事件如同位于连接地点并与该地点的敌人交战」需要「虚拟地点」
//     原语（事件结算期间的所在地点覆盖 + 交战关系），当前引擎没有该读点；见
//     docs/tde-investigators.md 的待实现清单。

export default {
  code: '06004',
  kind: 'investigator',
  simplified: true,
  note: '「每回合 1 张事件如同位于连接地点并与该地点的敌人交战」尚未接线（缺虚拟地点原语）；「以门之匣开始游戏」与旧印已实现。',
  investigator: {
    startsWith: '06013',
    elderSign: { bonus: 1 },
  },
  elderSign: {
    id: '06004-eldersign',
    label: '旧印：+1，在门之匣上放置 1 充能',
    resolve: ({ inv, api }) => {
      const gateBox = (inv.assets || []).find(asset => asset.code === '06013')
      if (gateBox) api.addUses(gateBox, 1)
      return { delta: 1 }
    },
  },
  abilities: [],
  modifiers: [],
}
