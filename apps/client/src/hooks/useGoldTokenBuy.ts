import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { api } from '../api/client';
import { buildPurchaseTx, toBaseUnits } from '../lib/solanaPay';

export type GoldBuyPhase = 'idle' | 'reserving' | 'signing' | 'confirming' | 'done' | 'error';

const CONFIRM_ATTEMPTS = 20;
const CONFIRM_INTERVAL_MS = 3000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useGoldTokenBuy() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [phase, setPhase] = useState<GoldBuyPhase>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setMessage('');
    setError(null);
  }, []);

  const buyGoldListing = useCallback(async (listingId: string) => {
    if (!publicKey || !sendTransaction) {
      const err = 'Connect your wallet to pay with tokens';
      setPhase('error');
      setError(err);
      return { success: false as const, error: err };
    }

    try {
      setPhase('reserving');
      setMessage('Reserving listing…');
      setError(null);
      const reservation = await api.reserveGoldListing(listingId);

      setPhase('signing');
      setMessage('Approve payment in your wallet…');
      const tx = await buildPurchaseTx({
        connection,
        buyer: publicKey,
        sellerWallet: reservation.sellerWallet,
        treasuryWallet: reservation.treasuryWallet,
        mint: reservation.mint,
        sellerBaseUnits: toBaseUnits(reservation.sellerAmount, reservation.decimals),
        feeBaseUnits: toBaseUnits(reservation.feeAmount, reservation.decimals),
      });

      const signature = await sendTransaction(tx, connection);

      setPhase('confirming');
      setMessage('Confirming on-chain…');
      try {
        await connection.confirmTransaction(signature, 'confirmed');
      } catch {
        /* backend re-verifies */
      }

      for (let i = 0; i < CONFIRM_ATTEMPTS; i++) {
        try {
          const res = await api.confirmGoldListing(listingId, signature);
          if (res.status === 'sold') {
            setPhase('done');
            setMessage('Purchase complete!');
            return { success: true as const, me: res.me };
          }
        } catch (e) {
          const msg = (e as Error).message ?? '';
          if (!/not confirmed|pending/i.test(msg)) {
            setPhase('error');
            setError(msg || 'Purchase failed');
            return { success: false as const, error: msg };
          }
        }
        await sleep(CONFIRM_INTERVAL_MS);
      }

      const err = 'Could not confirm transaction in time';
      setPhase('error');
      setError(err);
      return { success: false as const, error: err };
    } catch (e) {
      const err = (e as Error).message ?? 'Purchase failed';
      setPhase('error');
      setError(err);
      return { success: false as const, error: err };
    }
  }, [connection, publicKey, sendTransaction]);

  return { phase, message, error, buyGoldListing, reset };
}
