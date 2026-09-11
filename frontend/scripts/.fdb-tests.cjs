const fs = require('fs');
const p = 'src/components/dashboard/overviewLandingSections.test.tsx';
const raw = fs.readFileSync(p, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
if (!/^describe\('today action board RTR verdict'/.test(lines[337])) {
  throw new Error('anchor338 ' + lines[337]);
}
if (!/^}\);$/.test(lines[459])) throw new Error('anchor460 ' + lines[459]);
const body = fs.readFileSync('scripts/.fdb-tests-body.txt', 'utf8').split(/\r?\n/);
const next = lines.slice(0, 337).concat(body, lines.slice(460));
fs.writeFileSync(p, next.join(nl), 'utf8');
console.log('tests', lines.length, '->', next.length);
