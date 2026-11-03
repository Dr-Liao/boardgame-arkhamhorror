// 06266 · 《无归之地》剧情支援「理查德·厄普顿·皮克曼」（Richard Upton Pickman · Venerable Ghoul · 生命 3）。
// 卡面：[fast] Exhaust Richard Upton Pickman: Choose a [[Ghoul]] enemy at your location and attach it
//   to him, facedown.
//   [action] Exhaust Richard Upton Pickman: Fight. You attack with a base [combat] of 5. Instead of its
//   standard damage, this attack deals damage equal to the number of facedown encounter cards attached
//   to Richard Upton Pickman.
//
// 受控剧情支援的行动由章节 behavior.actions / performAction 提供：
//   · 快速能力：通用原语把所在地点的[[食尸鬼]]敌人正面朝下附属到本卡；
//   · 战斗行动：完整 Fight 检定，基础战斗值 5，伤害替换为正面朝下遭遇附件数。
// 本卡离场时，通用资产离场流程把遭遇附件送入遭遇弃牌堆。

export default {
  code: '06266',
  scope: 'storyAsset',
  implemented: true,
}
