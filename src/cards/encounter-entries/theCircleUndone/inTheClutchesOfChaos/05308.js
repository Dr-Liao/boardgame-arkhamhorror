// 05308 猛鬼出笼
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：显现 - 先在此处放 1 个裂口，再按「裂口 + 毁灭」总数受到伤害或恐惧（由你分配）。
// 一卡一文件：裂口结算走章节规则（入侵级联）；条目声明 resolveRule，behavior 按通用 rule id 分派。
export default {
  code: '05308',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { resolveRule: 'terrorUnleashed' },
}
