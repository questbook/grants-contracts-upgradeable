import { ethers } from "hardhat";
import type { WorkspaceRegistry } from "../src/types";

export async function randomWallet() {
  const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
  // fund the wallet so it can make transactions
  await ethers.provider.send("hardhat_setBalance", [wallet.address, "0x10000000000000000000000"]);

  return wallet;
}

export const DUMMY_IPFS_HASH = "dummyIpfsHash";

export function creatingWorkpsace(contract: WorkspaceRegistry, safeAddress?: Buffer, safeChainId?: number) {
  safeAddress = safeAddress || Buffer.alloc(32);
  safeChainId = safeChainId || 0;
  return contract.createWorkspace(DUMMY_IPFS_HASH, safeAddress, safeChainId);
}
