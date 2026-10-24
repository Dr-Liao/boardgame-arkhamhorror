// 05169 · 恶罪报应（theWagesOfSin）
// 绞刑架（169）：隐藏值 +1×场上女巫敌人数量；幽灵面闹鬼弃基础遭遇牌库顶 3 张，女巫敌人改为抽出交战。规则在 behavior.locationShroudModifier/hauntedScript。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05169',
  scope: 'location',
  implemented: true,
}
