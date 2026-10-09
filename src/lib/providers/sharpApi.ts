export async function fetchSharpSnapshot(
  apiKey:string
):Promise<SharpSnapshot>{

  const response = await fetch(
    ENDPOINT,
    {
      method:'GET',
      headers:{
        'X-API-Key':apiKey,
        'Accept':'application/json'
      }
    }
  );


  if(!response.ok){

    throw new Error(
      `SharpAPI HTTP ${response.status}`
    );

  }


  const json =
    await response.json() as Record<string,unknown>;


  console.log(
    'SHARP RAW KEYS:',
    Object.keys(json)
  );


  console.log(
    'SHARP RAW SAMPLE:',
    JSON.stringify(json).slice(0,3000)
  );


  let rows:unknown[] = [];


  // Handle common SharpAPI response formats

  if(Array.isArray(json.data)){

    rows = json.data;

  }
  else if(Array.isArray(json.odds)){

    rows = json.odds;

  }
  else if(Array.isArray(json.results)){

    rows = json.results;

  }
  else if(Array.isArray(json.markets)){

    rows = json.markets;

  }
  else if(Array.isArray(json.events)){

    rows = json.events;

  }
  else if(Array.isArray(json.response)){

    rows = json.response;

  }
  else if(Array.isArray(json.items)){

    rows = json.items;

  }


  console.log(
    'SHARP ROW COUNT:',
    rows.length
  );


  if(rows.length){

    console.log(
      'SHARP FIRST ROW:',
      JSON.stringify(rows[0]).slice(0,2000)
    );

  }


  return {

    schema:1,

    rows,

    receivedAt:
      Date.now(),

    delaySeconds:
      60,

    pages:
      1,

    truncated:
      false

  };

}
