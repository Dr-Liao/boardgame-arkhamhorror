import fs from 'node:fs'
const zh = JSON.parse(fs.readFileSync('参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json', 'utf8'))
const byCode = new Map(zh.map((z) => [z.code, z]))
const codes = ['01105','01106','01107','01108','01109','01110','01111','01112','01113','01114','01115','01116','01117','01118','01119','01159','01160','01161','01162','01163','01164','01165','01166','01167','01168']
for (const code of codes) {
  const z = byCode.get(code)
  if (!z) { console.log(code, 'NOT FOUND'); continue }
  const text = (z.text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  console.log(`${code} | ${z.name} | enc=${z.encounter_code}/${z.encounter_position} | qty=${z.quantity} | ${z.type_code} | ${(z.traits||'')} | ${text.slice(0,220)}`)
}
