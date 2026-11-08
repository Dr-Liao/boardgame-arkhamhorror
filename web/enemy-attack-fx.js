import { ENEMY_ATTACK_GROUPS, ENEMY_ATTACK_FAMILIES } from './enemy-attack-themes.js'
const NS='http://www.w3.org/2000/svg'
// Deliberately abstract silhouettes, not literal weapon/species claims.
const SHAPES={
  fist:'M-25 18V-8L-18-15-10-6V-24H0V-9-28H10V-8-23H20V-1L29-5 34 5 20 28H-14Z',
  claw:'M-24-32-15 12-28 30M-4-36 5 10-8 34M17-30 25 12 12 30',
  fang:'M-30-20Q0-35 30-20L17 24 8-8H-8L-17 24ZM-24 30Q0 42 24 30',
  swarm:'M-25-15h6m10-10h6m15 5h6m-8 16h6m-39 9h6m9 12h6m14-9h6m-24-15h6',
  coil:'M-25-22C45-55 48 25-5 28S-48-10-5-10 24 12 0 12',
  shock:'M-34 18-16-4-9 8 3-30 14 7 25-2 36 20M-32 30H32',
  eye:'M-36 0Q0-35 36 0Q0 35-36 0ZM0-12A12 12 0 1 0 .1-12',
  ghost:'M-26 30V-6Q0-47 26-6V30L13 19 0 30-13 19ZM-11-3h2m18 0h2',
  sigil:'M0-35 30 18H-30ZM0 34-30-18H30ZM-8 0H8M0-8V8',
  wings:'M0 26Q-8-18-40-25L-25 3-14 2-6 18M0 26Q8-18 40-25L25 3 14 2 6 18',
  vehicle:'M-30 20V-9L-18-27H18L30-9V20ZM-22-5H22M-20 10h8m24 0h8M-24 20v10m48-10v10',
  skull:'M-25 15V-9Q0-44 25-9V15L12 20V31H-12V20ZM-17-3-5 2-15 10ZM17-3 5 2 15 10ZM-4 27V20m8 7V20',
  mask:'M-29-28Q0-16 29-28L24 12 0 33-24 12ZM-20-4-7 0M7 0 20-4M-9 18Q0 9 9 18',
  abyss:'M-35-28Q0-5 35-28L24 26 0 38-24 26ZM-20-10 0 30 20-10M-9 0H9',
  mutation:'M-30 15-23-14-8-23 1-8 16-28 29-12 22 17 7 29-11 22ZM-25 2 25 2M-8-20 10 27',
  dragon:'M0 30-8-8-37-30-30 0-16-4-8 16M0 30 8-8 37-30 30 0 16-4 8 16M0 30 0-27 12-16',
  branches:'M0 33V-8L-18-28M0 4 22-18M-5-12-27-7M14-9 12-29M0 20-26 10',
  invisible:'M-30-20-12-30M0-32 23-20M32-9 26 14M17 25-4 31M-17 26-30 8M-29-3-30-10M-16 2Q0-20 16 2',
  gates:'M-30 30V-12Q0-48 30-12V30M-20 25V-10Q0-32 20-10V25M-7 18A8 8 0 1 0 9 18M-28 7H28',
  organ:'M-30 24V-9H-20V24M-10 24V-26H0V24M10 24V-36H20V24M30 24V-16H36V24M-32 32H36',
  yellowSign:'M0-3C-35-31-36 23-8 18S24 36 20 12-3-4-24-8 0-40 5-30 14-12-4 0 32 2 34-14',
  serpentRune:'M-20-28H20L0-6 20 10 0 31-20 10 0-6ZM-29-20H29M-29 20H29',
  serpent:'M-25 30C35 40 22-12-7-7S-31-35-1-32L24-21 10-5M13-20l18 3-12 9',
  amorphous:'M-31-8C-40-40-2-20 14-32S43-1 24 11 18 43-4 28-40 30-31-8Z',
  watch:'M-36 0Q0-35 36 0Q0 35-36 0ZM0-18V18M-14-28V-38M14-28V-38M-14 28V38M14 28V38',
  witch:'M0-36 12-12 31-5 13 6 18 32 0 19-18 32-13 6-31-5-12-12ZM-5 0H5',
  cosmos:'M-34 0A34 14 0 1 0 34 0A34 14 0 1 0-34 0M0-34A14 34 0 1 0 0 34A14 34 0 1 0 0-34M-8-8 8 8M8-8-8 8',
  fracture:'M-25-30 7-17-18-1 28 5-5 19 22 33M-32 20-13 5M16-24 32-32',
  masks:'M-34-27-9-20-12 8-24 18-36 8ZM-12-8 13-1 10 27-2 37-14 27ZM12-30 37-23 34 5 22 15 10 5',
  web:'M0-36V36M-36 0H36M-27-27 27 27M27-27-27 27M0-25 18-18 25 0 18 18 0 25-18 18-25 0-18-18ZM0-12 9-9 12 0 9 9 0 12-9 9-12 0-9-9Z',
  flesh:'M-28-21Q-8-38 0-12Q32-36 30-5Q42 22 12 20Q-9 41-18 17Q-41 10-28-21ZM-12-8 10 8M-7 12 17-6',
  seaBeast:'M-32 12-20-9-5-30 7-8 20-18 32 12M-35 24Q-18 5 0 24T35 24M-35 34Q-18 15 0 34T35 34',
  tideCrown:'M-28-28-15-12 0-34 15-12 28-28 22 2H-22ZM-34 15Q-17-2 0 15T34 15M-34 31Q-17 14 0 31T34 31',
  manyLimbs:'M0-22V28M0-12Q-28-42-33-8M0 0Q-35-18-34 18M0 12Q-22 4-24 35M0-12Q28-42 33-8M0 0Q35-18 34 18M0 12Q22 4 24 35',
  webLeg:'M-36-30-10-23 15-4 24 34 7 12-4-10-28-14M-35 20 34-25M-10-31 12 31M-26-8 20-16 19 11-10 16Z',
}
const fade=[{opacity:0,scale:'.4'},{opacity:1,scale:'1',offset:.35},{opacity:0,scale:'1.4'}]
export function enemyAttackChoreography(c,g) {
  const group=Object.hasOwn(ENEMY_ATTACK_GROUPS,c.attackStyle)?c.attackStyle:'uncertain'
  const theme=ENEMY_ATTACK_GROUPS[group], family=ENEMY_ATTACK_FAMILIES[c.enemyFamily]
  const color=c.presentationStage==='harm'&&!(c.damage>0)&&c.horror>0?'#b89bdb':family?.color||theme.color, elements=[]
  const mark=(glyph,x,y,cls='')=>{
    const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','-44 -44 88 88')
    svg.setAttribute('class','ah-enemy-mark '+cls);svg.style.left=x+'px';svg.style.top=y+'px'
    const path=document.createElementNS(NS,'path');path.setAttribute('d',SHAPES[glyph]||SHAPES.shock);svg.append(path);elements.push(svg);return svg
  }
  const harm=c.presentationStage==='harm'
  const variant=c.enemyVariant||''
  const signatureGlyph=c.enemyFamily==='atlach'&&/^leg-[1-4]$/.test(variant)?'webLeg'
    :c.enemyFamily==='nyarlathotep'&&variant==='trueShape'?'abyss':family?.glyph
  const signature=family?mark(signatureGlyph,g.start.x,g.start.y,'is-signature'):null
  const rotation=/^(leg|mask)-[1-5]$/.test(variant)?Number(variant.at(-1))*12:0
  const count=group==='swarm'?9:group==='claw'?3:group==='spectral'?3:1
  const travelers=harm?[]:Array.from({length:count},(_,i)=>mark(theme.glyph,g.start.x,g.start.y,`is-${group}`))
  const impact=mark(harm?(c.damage>0?'shock':'eye'):theme.glyph,g.end.x,g.end.y,'is-contact'+(harm?' is-harm':''))
  if(harm) {
    if(signature){signature.remove();elements.splice(elements.indexOf(signature),1)}
    const amount=g.node('div','ah-enemy-harm-number',`${c.damage>0?'−'+c.damage+' ♥':''}${c.damage>0&&c.horror>0?'  ':''}${c.horror>0?'−'+c.horror+' ◉':''}`)
    Object.assign(amount.style,{left:g.end.x+'px',top:(g.end.y-35)+'px'});elements.push(amount)
    if(c.horror>0)mark('eye',g.end.x,g.end.y,'is-fear')
  }
  return {style:group,family:'enemy',color,elements,
    strikeSound:harm?{}:{sample:theme.sound}, impactSound:harm?{sample:c.damage>0?'directImpact':'enemyFear'}:{},
    strike:source=>harm?[]:[
      ...(source?[[source,[{translate:'0 0'},{translate:`${g.ux*16}px ${g.uy*16}px`,offset:.6},{translate:'0 0'}],420]]:[]),
      ...(signature?[[signature,[{opacity:0,scale:'.2',rotate:(rotation-20)+'deg'},{opacity:1,scale:'1.3',rotate:rotation+'deg',offset:.5},{opacity:0,scale:'1.8'}],620]]:[]),
      ...travelers.map((el,i)=>[el,[{opacity:0,translate:`${i*3}px ${i*4}px`,scale:'.3'},
        {opacity:.85,translate:`${(g.end.x-g.start.x)*.45-i*6}px ${(g.end.y-g.start.y)*.45+(group==='flying'?-65:i*4)}px`,scale:group==='heavy'?'1.8':'.9',offset:.5},
        {opacity:0,translate:`${g.end.x-g.start.x+(i-count/2)*5}px ${g.end.y-g.start.y}px`,scale:group==='bind'?'1.8':'1.2'}],540+i*22])],
    impact:target=>[
      ...elements.filter(el=>el===impact||el.classList.contains('is-fear')||el.classList.contains('ah-enemy-harm-number')).map(el=>[el,fade,harm?700:340]),
      ...(harm&&target?[[target,c.damage>0?[{translate:'0 0'},{translate:'-5px 0',filter:'brightness(1.3)',offset:.25},{translate:'5px 0',offset:.5},{translate:'0 0',filter:'none'}]
        :[{filter:'none'},{filter:'hue-rotate(45deg) brightness(.7)',offset:.5},{filter:'none'}],380]]:[])] }
}
