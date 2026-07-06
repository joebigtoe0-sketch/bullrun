const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL ?? 'https://mainnet.helius-rpc.com';
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS ?? '';
export const TREASURY_WALLET = process.env.TREASURY_WALLET ?? '';
export const MINT_ADDRESS = TOKEN_ADDRESS;
export const MIN_PLAY_TOKENS = Number(process.env.MIN_PLAY_TOKENS ?? '1000');

export function isTokenGateConfigured(): boolean {
  return Boolean(TOKEN_ADDRESS && HELIUS_RPC_URL);
}

export function paymentsConfigured(): boolean {
  return isTokenGateConfigured() && Boolean(TREASURY_WALLET);
}

function rpcUrl(): string {
  if (HELIUS_RPC_URL.startsWith('http')) return HELIUS_RPC_URL;
  return HELIUS_RPC_URL;
}

interface TokenAccountsResponse {
  value?: Array<{
    account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } } } };
  }>;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  if (!isTokenGateConfigured()) {
    console.warn(`[solana] rpc(${method}) skipped — TOKEN_ADDRESS / HELIUS_RPC_URL not configured`);
    return null;
  }
  try {
    const res = await fetch(rpcUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
    });
    if (!res.ok) {
      console.warn(`[solana] rpc(${method}) HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { result?: T; error?: { message?: string } };
    if (json.error) {
      console.warn(`[solana] rpc(${method}) error: ${json.error.message}`);
    }
    return json.result ?? null;
  } catch (err) {
    console.warn(`[solana] rpc(${method}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getTokenBalance(walletAddress: string): Promise<number> {
  if (!walletAddress || !TOKEN_ADDRESS) return 0;
  const result = await rpc<TokenAccountsResponse>('getTokenAccountsByOwner', [
    walletAddress,
    { mint: TOKEN_ADDRESS },
    { encoding: 'jsonParsed' },
  ]);
  const accounts = result?.value ?? [];
  let total = 0;
  for (const acc of accounts) {
    total += acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
  }
  return total;
}

export async function walletHasAccess(walletAddress: string): Promise<boolean> {
  if (!isTokenGateConfigured()) return true;
  const balance = await getTokenBalance(walletAddress);
  return balance >= MIN_PLAY_TOKENS;
}

let cachedDecimals: number | null = null;
interface TokenSupplyResponse {
  value?: { decimals?: number };
}

export async function getMintDecimals(): Promise<number> {
  if (cachedDecimals !== null) return cachedDecimals;
  const result = await rpc<TokenSupplyResponse>('getTokenSupply', [TOKEN_ADDRESS]);
  const dec = result?.value?.decimals;
  cachedDecimals = typeof dec === 'number' ? dec : 6;
  return cachedDecimals;
}

interface ParsedTxResponse {
  meta?: {
    err?: unknown;
    preTokenBalances?: TokenBalanceEntry[];
    postTokenBalances?: TokenBalanceEntry[];
  };
  transaction?: {
    message?: {
      accountKeys?: Array<{ pubkey: string; signer?: boolean }> | string[];
    };
  };
}

interface TokenBalanceEntry {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount?: { amount?: string };
}

export interface VerifyArgs {
  buyer: string;
  sellerWallet: string;
  treasury: string;
  sellerBaseUnits: bigint;
  feeBaseUnits: bigint;
}

export async function verifyPurchaseTx(signature: string, args: VerifyArgs): Promise<boolean> {
  if (!signature) return false;
  const tx = await rpc<ParsedTxResponse>('getTransaction', [
    signature,
    { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
  ]);
  if (!tx?.meta) {
    console.warn(`[solana] verify ${signature.slice(0, 8)}… not found on RPC yet (retryable)`);
    return false;
  }
  if (tx.meta.err != null) {
    console.warn(`[solana] verify ${signature.slice(0, 8)}… on-chain tx FAILED:`, JSON.stringify(tx.meta.err));
    return false;
  }

  const keys = tx.transaction?.message?.accountKeys ?? [];
  const signerSet = new Set<string>();
  let feePayer: string | null = null;
  keys.forEach((k, i) => {
    if (typeof k === 'string') {
      if (i === 0) feePayer = k;
    } else {
      if (k.signer) signerSet.add(k.pubkey);
      if (i === 0) feePayer = k.pubkey;
    }
  });
  const buyerIsSigner = signerSet.has(args.buyer) || feePayer === args.buyer;
  if (!buyerIsSigner) return false;

  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];

  const deltaFor = (owner: string): bigint => {
    let before = 0n;
    let after = 0n;
    for (const b of pre) {
      if (b.mint === TOKEN_ADDRESS && b.owner === owner) before += BigInt(b.uiTokenAmount?.amount ?? '0');
    }
    for (const b of post) {
      if (b.mint === TOKEN_ADDRESS && b.owner === owner) after += BigInt(b.uiTokenAmount?.amount ?? '0');
    }
    return after - before;
  };

  const sellerDelta = deltaFor(args.sellerWallet);
  const treasuryDelta = deltaFor(args.treasury);
  if (sellerDelta < args.sellerBaseUnits) return false;
  if (treasuryDelta < args.feeBaseUnits) return false;
  return true;
}

export function toBaseUnits(uiAmount: number, decimals: number): bigint {
  const [whole, frac = ''] = uiAmount.toFixed(decimals).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}
