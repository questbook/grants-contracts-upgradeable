import { ethers } from "hardhat";

export async function randomWallet() {
  const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
  // fund the wallet so it can make transactions
  await ethers.provider.send("hardhat_setBalance", [wallet.address, "0x10000000000000000000000"]);

  return wallet;
}
