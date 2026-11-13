// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const configs=new Map();
const D={$:id=>({id,offsetParent:{}}),history:()=>[]};
vm.runInNewContext(await readFile('esp32/dashboard/charts.js','utf8'),{
 window:{esp32Dashboard:D},document:{documentElement:{dataset:{theme:'dark'}}},
 Intl,Date,Chart:class{constructor(canvas,config){configs.set(canvas.id,config);}destroy(){}}
});
const hour=1793977200;
const row=(at,interval_seconds)=>({at,interval_seconds,storage:interval_seconds===3600?'flash':'ram',solar:1,home:.5,grid:.2,battery:-.3,soc:80});
const points=()=>configs.get('esp-history-home').data.datasets[0];
D.drawHistory([row(hour,3600),row(hour+3600,3600),row(hour+7200,3600)]);
assert.deepEqual(Array.from(points().data,p=>[p.x,p.y]),[[hour*1000,1],[(hour+3600)*1000,1],[(hour+7200)*1000,1]],'Adjacent saved hourly records must form a visible series after restart');
D.drawHistory([row(hour,3600),row(hour+7200,3600),row(hour+10800,900),row(hour+11700,900),row(hour+13500,900)]);
assert.deepEqual(Array.from(points().data,p=>[p.x,p.y]),[[hour*1000,1],[(hour+3600)*1000,null],[(hour+7200)*1000,1],[(hour+10800)*1000,1],[(hour+11700)*1000,1],[(hour+12600)*1000,null],[(hour+13500)*1000,1]],'Only missing hourly or RAM intervals must remain gaps');
assert.equal(points().spanGaps,false);
assert(points().pointRadius>0,'Isolated observations must remain visible');
assert.equal(configs.get('esp-history-home').data.datasets[1].data[0].y,-.5);
assert.equal(configs.get('esp-history-battery').data.datasets[1].data[0].y,-.3);
assert.equal(configs.get('esp-history-soc').options.scales.y.max,100);
D.drawHistory([row(hour,3600)]);assert.equal(points().data.length,1);assert(points().pointRadius>=3);
console.log('ESP32 History charts: restored hourly series, mixed RAM intervals, genuine gaps, isolated points, signed series and SOC scale passed.');
