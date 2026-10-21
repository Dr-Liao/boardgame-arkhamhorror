// 01038 屏障
// 卡面：附属到你所在地点。
// 卡面：非[[精英]]敌人不能移动进入附属的地点。
// 卡面：强制 - 在一位调查员离开附属地点时：弃掉屏障。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01038',
  abilities: [
    // Phase 5（5a-18）：附属卡号随效果数据走（引擎读 effect.code）。
    { kind: 'played', label: '屏障', effect: { type: 'attachBarricade', code: '01038' } },
  ],
  keepOnPlay: true,
  modifiers: [

  ],
}
