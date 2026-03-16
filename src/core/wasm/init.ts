import type * as WasmModule from './pkg/practicebuddy_core.js'

type WasmExports = typeof WasmModule

let wasmModule: WasmExports | null = null
let initPromise: Promise<void> | null = null

export async function initWasm(): Promise<WasmExports> {
  if (wasmModule) return wasmModule

  if (!initPromise) {
    initPromise = (async () => {
      const module = await import('./pkg/practicebuddy_core.js')
      wasmModule = module
    })()
  }

  await initPromise
  return wasmModule!
}

export function getWasm(): WasmExports {
  if (!wasmModule) {
    throw new Error('WASM not initialized. Call initWasm() first.')
  }
  return wasmModule
}
