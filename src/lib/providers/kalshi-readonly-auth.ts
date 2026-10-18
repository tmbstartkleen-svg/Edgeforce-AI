import {constants,sign} from 'node:crypto';

// Kalshi signs timestamp + uppercase method + path, excluding URL query parameters.
// Only GET is accepted here; orders and trading are deliberately unsupported.
export function kalshiReadOnlyHeaders(url:URL,keyId:string,privateKey:string,now=Date.now()):Record<string,string>{
 if(url.protocol!=='https:'||url.hostname!=='external-api.kalshi.com'||!url.pathname.startsWith('/trade-api/v2/'))
  throw new Error('KALSHI_HOST_NOT_APPROVED');
 if(!keyId?.trim()||!privateKey?.includes('PRIVATE KEY-----'))throw new Error('KALSHI_CREDENTIALS_INVALID');
 if(!Number.isSafeInteger(now)||now<1)throw new Error('KALSHI_TIMESTAMP_INVALID');
 const timestamp=String(now);
 const message=Buffer.from(timestamp+'GET'+url.pathname);
 const signature=sign('sha256',message,{key:privateKey.replace(/\\n/g,'\n'),padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64');
 return {'KALSHI-ACCESS-KEY':keyId.trim(),'KALSHI-ACCESS-TIMESTAMP':timestamp,'KALSHI-ACCESS-SIGNATURE':signature};
}
