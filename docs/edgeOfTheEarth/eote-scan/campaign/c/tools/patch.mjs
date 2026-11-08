import fs from 'node:fs'
const file = 'findings-data.mjs'
let src = fs.readFileSync(file, 'utf8')
const pairs = [
  ['behavior.js:460-469（act1BackV1 只设 hiddenTunnelRevealed + 日志）', 'behavior.js:462-467（act1BackV1 只设 hiddenTunnelRevealed + 日志）'],
  ['behavior.js:470-478（act1BackV2 只设 flag + frost）', 'behavior.js:469-475（act1BackV2 只设 flag + frost）'],
  ['behavior.js:479-488（act1BackV3 只设 flag + drawEncounter）', 'behavior.js:476-483（act1BackV3 只设 flag + drawEncounter）'],
  ['behavior.js:544-560（tunnelInvestigate', 'behavior.js:544-558（tunnelInvestigate'],
  ['behavior.js:562-573（planetariumStudy', 'behavior.js:560-566（planetariumStudy'],
  ['behavior.js:575-590（固定 combat 4', 'behavior.js:568-581（固定 combat 4'],
  ['behavior.js:591-607（取第一个其他石桥', 'behavior.js:582-590（取第一个其他石桥'],
  ['behavior.js:608-623（towerStudy', 'behavior.js:592-601（towerStudy'],
  ['behavior.js:624-637（mapRoomStudy', 'behavior.js:603-610（mapRoomStudy'],
  ['behavior.js:638-653（rampartStudy', 'behavior.js:612-622（rampartStudy'],
  ['behavior.js:654-665（streetsReactionClue', 'behavior.js:624-632（streetsReactionClue'],
  ['behavior.js:666-681（moveKeyToSpires', 'behavior.js:634-648（moveKeyToSpires'],
  ['behavior.js:682-698（moveClueToHidden', 'behavior.js:650-663（moveClueToHidden'],
  ['behavior.js:699-712（swapKeys', 'behavior.js:665-678（swapKeys'],
  ['behavior.js:485-563（TREACHERY_HANDLERS 实现）', 'behavior.js:485-540（TREACHERY_HANDLERS 实现）'],
  ['behavior.js:485-500（只计控制钥匙', 'behavior.js:487-502（只计控制钥匙'],
  ['behavior.js:501-514（只设置', 'behavior.js:504-518（只设置'],
  ['behavior.js:375-397,505-533', 'behavior.js:375-397,520-540'],
  ['${e}:41-51；${C}/behavior.js:453-457', '${e}:12-25；${C}/behavior.js:453-457'],
]
for (const [a, b] of pairs) {
  if (!src.includes(a)) console.log('MISS:', a.slice(0, 60))
  src = src.split(a).join(b)
}
// 修正 08633/08635/08636 的 ${e}:48（这些 location 条目没有第 48 行）
src = src.replace("${e}:48；${C}/behavior.js:592-601", "${e}:12-25；${C}/behavior.js:592-601")
src = src.replace("${e}:48；${C}/behavior.js:603-610", "${e}:12-25；${C}/behavior.js:603-610")
src = src.replace("${e}:48；${C}/behavior.js:612-622", "${e}:12-25；${C}/behavior.js:612-622")
fs.writeFileSync(file, src, 'utf8')
console.log('patched')
