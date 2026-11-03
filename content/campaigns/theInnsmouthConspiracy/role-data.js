// 印刷身份表的唯一实现在非玩家条目的共享窄工具里（条目只允许 import _shared.js），
// 内容层按只读方式再导出同一个对象，避免出现第二份「嫌疑人和藏身处」数据。
export { SUSPECTS,HIDEOUTS,printedRole,suspectCode,suspectRole,hideoutCode,hideoutRole } from '../../../src/cards/encounter-entries/_shared.js'
