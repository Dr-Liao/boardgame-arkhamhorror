// 05342 · 诡计 05342 究极混沌：意志(4)、附属计时与 3 张触发在 behavior.resolveEncounter。
// 两条「Cannot be canceled」需要引擎级取消免疫（见 artifacts/tcu-fix/primitive-requests/fix-c5c6.json
// 的 engine-treachery-cancel-immunity）：encounterDrawn 的取消窗口目前对本卡开放，
// 内容层没有可用读点。除此之外的规则实现位置见注释；本文件负责归属与 implemented 审计读点。
export default {
  code: '05342',
  scope: 'treachery',
  implemented: true,
}
