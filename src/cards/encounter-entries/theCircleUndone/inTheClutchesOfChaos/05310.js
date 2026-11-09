// 05310 异界之秘
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：显现 - 找出毁灭标记最多的异教徒敌人，按其毁灭数在此处放裂口；未放置裂口则获得涌动。
// 一卡一文件：裂口上限/入侵级联由章节规则实现：条目声明 resolveRule，behavior 按通用 rule id 分派。
export default {
  code: '05310',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { resolveRule: 'secretsOfTheBeyond' },
}
