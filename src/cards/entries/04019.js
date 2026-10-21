// 04019 肝胆相照
// 卡面：快速。只能在你回合期间打出。
// 卡面：附属到你控制的一个[[盟友]]支援。
// 卡面：附属的支援得到+1生命值和+1神智值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04019',
  attachTo: {"kind":"asset","trait":"ally"},
  fast: true,
  passive: {"hostHealth":1,"hostSanity":1},
  abilities: [

  ],
  modifiers: [

  ],
}
