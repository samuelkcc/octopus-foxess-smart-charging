/*
 * FoxESS web-portal signature wrapper.
 *
 * The signature.wasm asset and the calling convention used here are adapted
 * from nicois/foxess-control (Copyright 2026 Nick Farrell), used under the
 * MIT License. See THIRD_PARTY_NOTICES.md.
 */

import { readFile } from 'node:fs/promises';

let enginePromise;

async function createEngine() {
  const bytes = await readFile(new URL('./foxess-signature.wasm', import.meta.url));
  let memory;
  const imports = {
    env: {
      emscripten_memcpy_big(destination, source, length) {
        const view = new Uint8Array(memory.buffer);
        view.copyWithin(destination, source, source + length);
        return destination;
      },
      emscripten_resize_heap() {
        return 0;
      },
      setTempRet0() {}
    }
  };
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  const exports = instance.exports;
  memory = exports.memory;
  exports.__wasm_call_ctors();

  function writeString(value) {
    const encoded = Buffer.from(`${value}\0`, 'utf8');
    const pointer = exports.stackAlloc(encoded.length);
    new Uint8Array(memory.buffer, pointer, encoded.length).set(encoded);
    return pointer;
  }

  function readString(pointer) {
    const view = new Uint8Array(memory.buffer);
    let end = pointer;
    while (end < view.length && view[end] !== 0) end += 1;
    return Buffer.from(view.subarray(pointer, end)).toString('utf8');
  }

  return {
    generate(path, token, language, timestamp) {
      const stackPointer = exports.stackSave();
      try {
        const resultPointer = exports.begin_signature(
          writeString(path),
          writeString(token),
          writeString(language),
          writeString(timestamp)
        );
        return readString(resultPointer);
      } finally {
        exports.stackRestore(stackPointer);
      }
    }
  };
}

export async function generateFoxWebSignature(path, token, language, timestamp) {
  enginePromise ||= createEngine();
  const engine = await enginePromise;
  return engine.generate(path, token, language, timestamp);
}
