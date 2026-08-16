/**
 * Test helper: replace the `electron` module with a stub before anything
 * requires it.
 *
 * Import this module *first* in a test that loads main-process or preload code,
 * so the stub is in the require cache by the time that code runs.
 */

 
const Module = require('module');

type Listener = (event: unknown, ...args: unknown[]) => void;

/** Everything the stub records, for assertions. */
export interface ElectronStub {
  /** APIs handed to contextBridge.exposeInMainWorld, keyed by name. */
  exposed: Record<string, Record<string, unknown>>;
  /** Channels sent through ipcRenderer.send. */
  sent: Array<{ channel: string; args: unknown[] }>;
  /** Deliver a message as if the main process had sent it. */
  emit(channel: string, ...args: unknown[]): void;
}

const listeners: Record<string, Listener[]> = {};

export const electronStub: ElectronStub = {
  exposed: {},
  sent: [],
  emit(channel: string, ...args: unknown[]): void {
    for (const listener of listeners[channel] || []) {
      listener({}, ...args);
    }
  },
};

const stub = {
  contextBridge: {
    exposeInMainWorld(name: string, api: Record<string, unknown>): void {
      electronStub.exposed[name] = api;
    },
  },
  ipcRenderer: {
    on(channel: string, listener: Listener): void {
      (listeners[channel] ||= []).push(listener);
    },
    send(channel: string, ...args: unknown[]): void {
      electronStub.sent.push({ channel, args });
    },
    invoke(): Promise<unknown> {
      return Promise.resolve(undefined);
    },
  },
};

const electronPath = require.resolve('electron', { paths: [process.cwd()] });
const stubModule = new Module(electronPath, null);
stubModule.exports = stub;
stubModule.loaded = true;
require.cache[electronPath] = stubModule;
