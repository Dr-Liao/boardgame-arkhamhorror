// 05164 · 恶罪报应（theWagesOfSin）
// 幕 1 追寻死者：团队共付 3×人数线索（objective 在 definition.js）；地点不能被翻到幽灵面；背面在 4 处地点生成放一边的异端者、加线索、Memento≥3 发幽灵迷网。规则在 behavior.actReveal 的 advanceInPursuitOfTheDead。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05164',
  scope: 'act',
  implemented: true,
  flags: { advanceRule: 'inPursuitOfTheDead' },
}
