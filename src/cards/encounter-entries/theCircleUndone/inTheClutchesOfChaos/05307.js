// 05307 元初通道
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：显现 - 附属到随机地点并把该地点裂口补到正好 3 个；该地点获得「智识或意志(4) 关闭通道」行动。
// 一卡一文件：裂口补齐与关闭行动读取生成的真实附属实例；条目声明 resolveRule，behavior 按通用 rule id 分派。
export default {
  code: '05307',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { resolveRule: 'primordialGateway' },
}
