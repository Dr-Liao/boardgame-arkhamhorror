import fs from 'node:fs'
const zh = JSON.parse(fs.readFileSync('参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json', 'utf8'))
const byCode = new Map(zh.map((z) => [z.code, z]))
const z = byCode.get('01116')
console.log(JSON.stringify(z, null, 2))
