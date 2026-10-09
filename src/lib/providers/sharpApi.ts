export async function fetchSharpApiBoard(
  config:ProviderConfig
):Promise<ProviderFetchResult<unknown>>{

  const started=Date.now();

  if(!config.apiKey){
    return {
      providerId:config.id,
      providerName:config.name,
      capability:config.capability,
      receivedAt:new Date(started).toISOString(),
      ok:false,
      status:503,
      error:'SharpAPI key missing',
      latencyMs:Date.now()-started
    };
  }

  return {
    providerId:config.id,
    providerName:config.name,
    capability:config.capability,
    receivedAt:new Date(started).toISOString(),
    ok:false,
    status:503,
    error:'SharpAPI mapper repair in progress',
    latencyMs:Date.now()-started
  };
}
