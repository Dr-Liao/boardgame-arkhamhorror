// 10575 阿克望（Akwan）· 起始地点
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[action]：撤退。你放弃了搜寻。
//       如果是第一日或第二日，阿克望获得：「[action]：谈判。你问遍村里人海岸洞穴的事。
//       查看岩穴牌库顶 3 张，以任意顺序放回岩穴牌库顶。」
//
// 一张卡一个文件：撤退由 definition 的 resign 标记（引擎既有撤退入口）承担；
// 谈判行动在 behavior.actions/performAction（lostSisterAkwanParley，读 lookAtCavernsTop）。
export default {
  code: '10575',
  scope: 'location',
  implemented: true,
  abilities: [],
  flags: {
    resign: true,
    startLocation: true,
    parleyOnDay1Or2: true,
    lookAtCavernsTop: 3,
    coastal: true,
  },
  note: '谈判印刷为「看过之后按任意顺序放回」，本实现按原顺序放回（重排面板留给 P8），已在 behavior 披露。',
}
