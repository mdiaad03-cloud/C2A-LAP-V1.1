const http = require('http');
const fs = require('fs');

function checkUrl(port, urlPath, outputName) {
  const options = {
    hostname: 'localhost',
    port: port,
    path: urlPath,
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(`URL http://localhost:${port}${urlPath} -> Status: ${res.statusCode}`);
      fs.writeFileSync(outputName, `Status: ${res.statusCode}\nHeaders: ${JSON.stringify(res.headers, null, 2)}\n\nBody: ${data.substring(0, 1000)}`, 'utf-8');
    });
  });

  req.on('error', (e) => {
    console.error(`Error requesting http://localhost:${port}${urlPath}: ${e.message}`);
    fs.writeFileSync(outputName, `Error: ${e.message}`, 'utf-8');
  });

  req.end();
}

checkUrl(5000, '/admin', 'test_admin_result.txt');
checkUrl(5000, '/assets/index-DovMaNYC.js', 'test_admin_js_result.txt');
checkUrl(5001, '/admin', 'test_store_admin_result.txt');
