// 多子线开局面板的纯数据模型（P5 批次 3 / 交互第 1 条）。
//
// 只把 `legalMoves` 里的 `hubSetMode` / `hubSetSeatPart` 整理成界面可直接渲染的结构：
//   · 四个开局模式（单线 A/B、分选、并行）与置灰原因；
//   · 分选模式下每个座位的线归属与跨线重复校验原因；
//   · 当前模式与「先选模式再准备」的提示。
// 这里不碰 DOM、不发请求：浏览器与 Node 测试共用同一份口径。
export const MODE_ORDER = ['singleA', 'singleB', 'pick', 'parallel']
// 选定模式后 hubSetMode 就不再下发；仍要显示“当前模式”与座位分线，所以留一份展示名。
const MODE_NAMES = { singleA: '单线 A', singleB: '单线 B', pick: '分选双线', parallel: '并行双线' }

/**
 * @param {object} state 大厅拿到的权威 state（只用 campaign.mode / campaign.seatParts）
 * @param {object[]} moves 当前 legalMoves
 */
export function modePanelModel(state, moves = []) {
  const campaign = state?.campaign || {}
  const modeMoves = moves.filter(move => move?.action === 'hubSetMode')
  const seatMoves = moves.filter(move => move?.action === 'hubSetSeatPart')
  const modes = MODE_ORDER
    .map(mode => modeMoves.find(move => move.mode === mode) || null)
    .filter(Boolean)
    .map(move => ({
      mode: move.mode,
      label: move.label || move.mode,
      disabled: !!move.disabled,
      reason: move.disabled ? (move.explanation || '') : '',
    }))
  const seats = seatMoves.map(move => ({
    seat: move.seat,
    part: move.part,
    label: move.label || `座位 ${Number(move.seat) + 1} → ${move.part} 线`,
    disabled: !!move.disabled,
    reason: move.disabled ? (move.explanation || '') : '',
  }))
  const seatParts = Array.isArray(campaign.seatParts) ? [...campaign.seatParts] : []
  // 只有声明 parts 的战役带 requiresMode（引擎投影）；模式未定时先给首屏门。
  const hasParts = campaign.requiresMode === true || modes.length > 0 || seats.length > 0
  const assignments = seatParts.map((part, seat) => ({ seat, part, label: `座位 ${seat + 1} → ${part} 线` }))
  const laneCounts = {
    A: seatParts.filter(part => part === 'A').length,
    B: seatParts.filter(part => part === 'B').length,
  }
  const balanced = laneCounts.A > 0 && laneCounts.A === laneCounts.B
  return {
    // 未选模式时显示四个模式；选定后 hubSetMode 不再下发，但座位分线/当前模式仍要显示。
    visible: hasParts && (!campaign.mode || modes.length > 0 || seats.length > 0),
    selected: campaign.mode || null,
    selectedLabel: campaign.mode ? (MODE_NAMES[campaign.mode] || campaign.mode) : '',
    modes,
    // 分选模式下按座位换线；并行/单线不显示座位行。
    seats,
    seatParts,
    assignments,
    laneCounts,
    // 并行开始前必须两组人数相等；其它模式这个字段不参与判断（恒 true）。
    balanced,
    seatHint: seats.length > 0,
    // 非房主席位在首屏拿不到 hubSetMode（引擎只给座位 1），显示等待房主选择。
    hostChooses: hasParts && !campaign.mode && modes.length === 0,
    // 先选模式、再准备：未选模式时提示，选了模式但还没进准备页也提示。
    needsMode: hasParts && !campaign.mode,
    // 首屏门只属于声明了 parts 的战役；其它战役没有 requiresMode，不能被模式门拦截。
    firstScreen: hasParts && !campaign.mode,
    ready: !!campaign.mode,
  }
}
