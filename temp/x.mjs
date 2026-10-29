import fs from 'node:fs'
const src = fs.readFileSync('tests/tde-parallel.test.mjs','utf8')
// 只用前半段建局函数，手动打印
console.log('debug via inline test copy')
