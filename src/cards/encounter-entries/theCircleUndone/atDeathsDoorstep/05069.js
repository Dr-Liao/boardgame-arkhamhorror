// 05069 · 死亡门前（atDeathsDoorstep）
// 幕 2 幽灵国度：团队共同支付 4×人数线索（objective 在 definition.js）；背面由 behavior.actReveal 的 advanceTheSpectralRealm 结算（揭示入口大厅、洗回遭遇弃牌堆）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05069',
  scope: 'act',
  implemented: true,
  flags: { advanceRule: 'spectralRealm' },
}
