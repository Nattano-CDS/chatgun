// Read the installed canonical source dependency; never mutate original NEAR.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire((process.env.NEAR_SOURCE||'/tmp/chatgun-near-v91.b02HqR')+'/package.json');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),lucide=require('lucide-react');
const names={back:'ArrowLeft',next:'ChevronRight',previous:'ChevronLeft',close:'X',pin:'MapPin',heart:'Heart',flag:'Flag',trash:'Trash2',camera:'Camera',upload:'Upload',chat:'MessageCircle',badge:'BadgeCheck',verification:'ShieldCheck'};
const icons=Object.fromEntries(Object.entries(names).map(([key,name])=>[key,renderToStaticMarkup(React.createElement(lucide[name],{size:19,'aria-hidden':true,...(key==='badge'?{fill:'#7750e5',color:'white'}:{})}))]));
await writeFile('app/near-icons.js','/* Canonical NEAR v91 Lucide component SVGs; scripts/port-near-icons.mjs */\nwindow.ChatgunNearIcons='+JSON.stringify(icons)+';\n');
