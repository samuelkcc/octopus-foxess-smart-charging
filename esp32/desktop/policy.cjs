// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
function sameOrigin(value,origin){try{return new URL(value).origin===origin;}catch{return false;}}
function externalUrl(value){
  try{
    const url=new URL(value);if(url.username||url.password)return false;
    if(url.protocol==='https:')return true;
    if(url.protocol!=='http:')return false;
    if(url.hostname==='smart-charging-esp32.local')return true;
    const p=url.hostname.split('.').map(Number);
    return p.length===4&&p.every(x=>Number.isInteger(x)&&x>=0&&x<=255)&&(p[0]===10||(p[0]===192&&p[1]===168)||(p[0]===172&&p[1]>=16&&p[1]<=31));
  }catch{return false;}
}
function portLabel(port){return String(port.displayName||port.portName||'USB serial port').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,160);}
function isUsbSerial(port){
  const name=String(port.portName||'')+' '+String(port.displayName||'');
  if(/bluetooth|incoming.port|debug.console/i.test(name))return false;
  return !!(port.vendorId&&port.productId)||/usbserial|usbmodem|wchusbserial|SLAB_USBtoUART|USB[- ]?(Serial|UART)/i.test(name);
}
module.exports={sameOrigin,externalUrl,portLabel,isUsbSerial};
