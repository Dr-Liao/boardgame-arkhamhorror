import fs from 'node:fs';
const root='content/campaigns/edgeOfTheEarth/scenarios';
for (const dir of fs.readdirSync(root)) {
  const f=`${root}/${dir}/behavior.js`; if(!fs.existsSync(f)) continue;
  const t=fs.readFileSync(f,'utf8');
  const lines=t.split('\n');
  const objStart=lines.findIndex(l=>/^export const behavior\s*=\s*\{/.test(l));
  if(objStart<0) continue;
  const props=[];
  for(let i=objStart+1;i<lines.length;i++){
    const line=lines[i];
    if(/^\}/.test(line)) break;
    const m=line.match(/^\s{2}([A-Za-z_$][\w$]*)\s*[:,]/);
    if(m) props.push(m[1]+':'+(i+1));
  }
  console.log('\n'+dir+' behavior props: '+props.join(', '));
}
