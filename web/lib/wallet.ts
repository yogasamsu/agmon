"use client";

import { createWalletClient, custom, type EIP1193Provider } from "viem";
import { monad } from "./chain";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export class NoWalletError extends Error {}

/** Sambungkan dompet browser (MetaMask, Rabby, dll.) dan pastikan jaringannya Monad. */
export async function connectWallet() {
  if (!window.ethereum) throw new NoWalletError("No browser wallet");
  const wallet = createWalletClient({ chain: monad, transport: custom(window.ethereum) });
  const [account] = await wallet.requestAddresses();

  if ((await wallet.getChainId()) !== monad.id) {
    try {
      await wallet.switchChain({ id: monad.id });
    } catch {
      await wallet.addChain({ chain: monad });
      await wallet.switchChain({ id: monad.id });
    }
  }
  return { wallet, account };
}
