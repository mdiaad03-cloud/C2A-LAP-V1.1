const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('client/dist/index.html');
const output = {
  targetPath,
  exists: fs.existsSync(targetPath)
};

if (output.exists) {
  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
    output.readable = true;
    output.content = fs.readFileSync(targetPath, 'utf-8');
  } catch (err) {
    output.readable = false;
    output.error = err.message;
  }
} else {
  output.error = 'File does not exist';
}

fs.writeFileSync('test_read_error.txt', JSON.stringify(output, null, 2), 'utf-8');
console.log('Done test_read_error.txt written');
