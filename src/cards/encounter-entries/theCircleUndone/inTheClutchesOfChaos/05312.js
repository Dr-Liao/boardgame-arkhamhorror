// 05312 不惮辛劳不惮烦
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：险境 - 选择一项：结算遭遇弃牌堆最顶部的力量诡计，或结算你所在地点的入侵一次。
// 一卡一文件：两项都需要章节的裂口/入侵结算流程：条目声明 resolveRule，behavior 按通用 rule id 分派。
export default {
  code: '05312',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { resolveRule: 'toilAndTrouble' },
}
