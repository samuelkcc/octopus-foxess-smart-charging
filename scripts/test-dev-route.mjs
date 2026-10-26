import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dev/default-route.js', import.meta.url), 'utf8');
function route(path) {
  let destination = null;
  vm.runInNewContext(source, {
    URL,
    location: { href: `https://example.test${path}`, replace: value => { destination = value; } }
  });
  return destination && new URL(destination);
}

for (const path of ['/', '/index.html', '/?client=1', '/?view=history#month']) {
  const target = route(path);
  assert.equal(target.pathname, '/dev/index.html');
  assert.equal(target.searchParams.get('client'), '1');
}
assert.equal(route('/?view=history#month').hash, '#month');
assert.equal(route('/?view=history').searchParams.get('view'), 'history');
for (const path of ['/?worker=1', '/?worker=1&client=1', '/?original=1&client=1', '/dev/index.html', '/api/runtime']) {
  assert.equal(route(path), null, `Do not redirect ${path}`);
}
assert.equal(route('/?worker=0').searchParams.has('worker'), false);
console.log('DEV entry routing passed; worker and original view preserved.');
