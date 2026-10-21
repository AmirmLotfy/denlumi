// Connection-string query parameters can override the parsed URL authority in pg.
// An explicit unambiguous loopback locator is required before constructing a pool.
export function localDatabaseUrl(raw:string|undefined):URL {
 try{
  if(!raw)throw Error();
  const url=new URL(raw);
  if(!['postgresql:','postgres:'].includes(url.protocol)||!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='55432'||url.search||url.hash||!url.username||url.pathname.length<2)throw Error();
  return url;
 }catch{throw Error('LOCAL_DENLUMI_DATABASE_REQUIRED');}
}
