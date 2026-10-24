// 05170 · 恶罪报应（theWagesOfSin）
// 绞刑架（170）：隐藏值 X = 场上灵怪敌人数量（卡面 X 占位在 definition 归零）；幽灵面闹鬼弃幽灵遭遇牌库顶 3 张，灵怪敌人改为抽出交战。规则在 behavior.locationShroudModifier/hauntedScript。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05170',
  scope: 'location',
  implemented: true,
}
