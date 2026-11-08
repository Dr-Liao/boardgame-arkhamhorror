import fs from 'node:fs'
let src = fs.readFileSync('findings-data.mjs', 'utf8')
src = src.replace("note: '按卡号字面量分支实现，声明的 roundEnd:'moveDownToBelow' 无读点（medium）'", "note: '按卡号字面量分支实现，声明的 roundEnd: moveDownToBelow 无读点（medium）'")
fs.writeFileSync('findings-data.mjs', src, 'utf8')
