// 99002 神秘乐曲（Mystifying Song）· 中立 · 事件 · 费用 3 · 法术/歌曲 · 玛丽·朗博。
// cards-data 的 99002 与 05018 同文同面（推广印刷），行为沿用 canonical 实现：
// 本文件只覆盖 code；「快速。在密谋将要因毁灭阈值推进时打出 → api.lockAgendaDoomThisPhase() →
// 放逐自身」的读点仍由 05018 维护（played 描述子的 fast/trigger/exileAfterPlay + act-agenda.js 的
// agendaWouldAdvance 窗口与 state.agendaDoomLock）。
// 若 Lead 后续把 99002 标为 05018 的 duplicateOfCode，应改走 REPRINT_ALIASES 并删除本文件。
import base from './05018.js'

export default { ...base, code: '99002' }
