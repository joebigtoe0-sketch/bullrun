import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

export interface BuildPurchaseTxArgs {
  connection: Connection;
  buyer: PublicKey;
  sellerWallet: string;
  treasuryWallet: string;
  mint: string;
  sellerBaseUnits: bigint;
  feeBaseUnits: bigint;
}

export async function buildPurchaseTx(args: BuildPurchaseTxArgs): Promise<Transaction> {
  const mint = new PublicKey(args.mint);
  const seller = new PublicKey(args.sellerWallet);
  const treasury = new PublicKey(args.treasuryWallet);

  const mintInfo = await args.connection.getAccountInfo(mint);
  const tokenProgramId = mintInfo?.owner ?? TOKEN_PROGRAM_ID;

  const buyerAta = await getAssociatedTokenAddress(mint, args.buyer, false, tokenProgramId);
  const sellerAta = await getAssociatedTokenAddress(mint, seller, false, tokenProgramId);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury, false, tokenProgramId);

  const tx = new Transaction();

  const [sellerInfo, treasuryInfo] = await Promise.all([
    args.connection.getAccountInfo(sellerAta),
    args.connection.getAccountInfo(treasuryAta),
  ]);

  if (!sellerInfo) {
    tx.add(createAssociatedTokenAccountInstruction(args.buyer, sellerAta, seller, mint, tokenProgramId));
  }
  if (!treasuryInfo) {
    tx.add(createAssociatedTokenAccountInstruction(args.buyer, treasuryAta, treasury, mint, tokenProgramId));
  }

  tx.add(createTransferInstruction(buyerAta, sellerAta, args.buyer, args.sellerBaseUnits, [], tokenProgramId));
  tx.add(createTransferInstruction(buyerAta, treasuryAta, args.buyer, args.feeBaseUnits, [], tokenProgramId));

  const { blockhash } = await args.connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = args.buyer;

  return tx;
}

export function toBaseUnits(uiAmount: number, decimals: number): bigint {
  const [whole, frac = ''] = uiAmount.toFixed(decimals).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}
