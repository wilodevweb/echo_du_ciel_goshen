/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');
const req = http.request('http://localhost:3000/api/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.write(JSON.stringify({
  mode: 'sync-v2',
  l: null,
  kc: [],
  ka: [],
  c: [],
  a: []
}));
req.end();
