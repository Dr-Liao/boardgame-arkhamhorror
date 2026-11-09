// 05306 混沌幽现
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：显现 - 意志(3) 检定；失败且每低于难度 1 点，在 1 个不同的随机地点放置 1 个裂口（顺序由失败者选择）。
// 一卡一文件：随机地点采样与放置顺序由章节规则实现：条目声明 resolveRule，behavior 按通用 rule id 分派。
export default {
  code: '05306',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { resolveRule: 'chaosManifest' },
}
