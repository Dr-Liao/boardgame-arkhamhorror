import fs from 'node:fs'
let b = fs.readFileSync('build-findings.mjs', 'utf8')
b = b.split('${P}/definition.js:218-232').join('${P}/definition.js:196-227')
b = b.replace("${P}/definition.js:199-216（resolutions/SCENARIO_TEXT）", "${P}/definition.js:180-194（resolutions/SCENARIO_TEXT）")
b = b.replace("${C}/definition.js:199-234；${C}/texts.js", "${C}/definition.js:205-234；${C}/texts.js")
fs.writeFileSync('build-findings.mjs', b, 'utf8')
