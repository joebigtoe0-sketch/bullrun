// Must be imported before any Solana wallet-adapter code — those deps
// expect a Node Buffer global in the browser.
import { Buffer } from 'buffer';

(window as unknown as { Buffer?: typeof Buffer }).Buffer ??= Buffer;
