const AUTH_ID = 'MA_937EKWJ9';
const AUTH_TOKEN = 'rxkkt1fCSffzmiXybX0aN3BoD229NrKuSLa10IXQ3qGIhCW6PtigpByD6kmZZAoh';

// Try to list all recordings from Vobiz API
async function listRecordings() {
  const headers = {
    'X-Auth-ID': AUTH_ID,
    'X-Auth-Token': AUTH_TOKEN,
    'Content-Type': 'application/json'
  };

  // Try different Vobiz API endpoints
  const endpoints = [
    'https://media.vobiz.ai/v1/Account/MA_937EKWJ9/Recording/',
    'https://api.vobiz.ai/v1/Account/MA_937EKWJ9/Recording/',
    'https://api.vobiz.ai/v1/Recording/',
    'https://media.vobiz.ai/v1/Recording/',
  ];

  for (const url of endpoints) {
    try {
      console.log(`\nTrying: GET ${url}`);
      const res = await fetch(url, { method: 'GET', headers });
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      console.log(`Response: ${text.substring(0, 500)}`);
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

listRecordings();
