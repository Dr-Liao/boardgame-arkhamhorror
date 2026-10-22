// 03184 阴魂不散的病人
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：生成 - 最近的疯人院大厅。
// 卡面：猎物 - 剩余神智值最高。
// 卡面：强制 - 在你攻击阴魂不散的病人时：受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 阴魂不散的病人（03184）：强制 — 在你攻击它时受到 1 点恐惧。

export default {
  code: '03184', scope: 'enemy', implemented: true,
  name: '阴魂不散的病人',
  text: '猎物 - 剩余神智最高。强制 - 在你攻击阴魂不散的病人时：受到 1 点恐惧。',
  enemyRule: { prey: 'mostRemainingSanity', onAttackedHorror: 1 },
}
