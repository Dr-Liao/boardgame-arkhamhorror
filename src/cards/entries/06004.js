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
//   · 「每回合 1 张事件如同位于连接地点」走 as-if-location.js：结算期间改写地点与交战，结束后还原。

export default {
  code: '06004',
  kind: 'investigator',
  asIfEvent: true,
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
