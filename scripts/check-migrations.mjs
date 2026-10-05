import fs from 'node:fs/promises';
import path from 'node:path';

const dir=path.resolve(process.cwd(),'db');
const files=(await fs.readdir(dir))
 .filter(name=>/^v\d+\.sql$/.test(name))
 .sort((a,b)=>Number(a.match(/\d+/)?.[0]||0)-Number(b.match(/\d+/)?.[0]||0));

const versions=files.map(name=>Number(name.match(/\d+/)?.[0]||0));
const latest=versions.at(-1)||0;
const expected=88;
const gaps=[];
for(let i=6;i<=expected;i++)if(!versions.includes(i))gaps.push(i);

const result={ok:latest>=expected&&gaps.length===0,latest,expected,gaps,files};
console.log(JSON.stringify(result));
if(!result.ok)process.exit(1);
