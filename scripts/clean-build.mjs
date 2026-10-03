import fs from 'node:fs';

for(const path of ['dist','.next','.vinext']){
 try{
  fs.rmSync(path,{recursive:true,force:true});
  console.log('removed '+path);
 }catch(error){
  console.error('failed to remove '+path+': '+(error instanceof Error?error.message:String(error)));
  process.exit(1);
 }
}
