const path = require('path');
const fs = require('fs');

const serverSrcDir = __dirname;
const resolvedClientDist = path.resolve(serverSrcDir, '../client/dist');
const resolvedClientDist2 = path.resolve(serverSrcDir, '../../client/dist');

console.log('__dirname:', __dirname);
console.log('resolvedClientDist (../client/dist):', resolvedClientDist);
console.log('resolvedClientDist2 (../../client/dist):', resolvedClientDist2);

const absoluteClientDist = 'C:\\Users\\mdiaa\\.gemini\antigravity\\scratch\\c2a-lap-fixed\\client\\dist';
console.log('Exists resolvedClientDist:', fs.existsSync(resolvedClientDist));
console.log('Exists resolvedClientDist2:', fs.existsSync(resolvedClientDist2));
console.log('Exists index.html in resolved2:', fs.existsSync(path.join(resolvedClientDist2, 'index.html')));
