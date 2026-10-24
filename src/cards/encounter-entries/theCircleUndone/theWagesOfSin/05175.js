// 05175 · 恶罪报应（theWagesOfSin）
// 教堂阁楼（175）：强制 - 在此地抽到非弱点卡后把它正面朝下放在阁楼底下；[reaction] 成功调查后把底下卡牌加入所有者手牌；幽灵面闹鬼随机弃掉底下一张。规则在 behavior.cardDrawn/investigateResult/hauntedScript。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05175',
  scope: 'location',
  implemented: true,
}
