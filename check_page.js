const http = require('http');
const fs = require('fs');

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/store',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const result = {
      statusCode: res.statusCode,
      headers: res.headers,
      body: data.substring(0, 500)
    };
    fs.writeFileSync('check_page_result.txt', JSON.stringify(result, null, 2), 'utf-8');
    console.log('Success check_page_result.txt written');
  });
});

req.on('error', (e) => {
  fs.writeFileSync('check_page_result.txt', 'Error: ' + e.message, 'utf-8');
  console.error('Error check_page_result.txt written: ' + e.message);
});

req.end();
