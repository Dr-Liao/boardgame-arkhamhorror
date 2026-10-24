// 05183 · 恶罪报应（theWagesOfSin）
// 凶兆：险境二选一——抽幽灵遭遇牌库顶（获险境、不可取消）或意志(3)失败 2 恐惧。规则在 behavior 的 encounterResolve（drawExtra）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05183',
  scope: 'treachery',
  implemented: true,
  flags: { resolveRule: 'ominousPortents' },
}
