// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import {readFile} from 'node:fs/promises';
export async function guideBundle(root){
 const source=await readFile(new URL('../dev/guide.js',import.meta.url),'utf8');
 const text=await readFile(new URL('../docs/USER-GUIDE.md',import.meta.url),'utf8');
 const script=source.replace('"__SC_USER_GUIDE__"',JSON.stringify(text).replaceAll('<','\\u003c'));
 return {script,css:await readFile(new URL('../dev/guide.css',import.meta.url),'utf8')};
}
