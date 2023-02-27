import { randomBytes } from "crypto";
import { Signer } from "ethers";
import { ethers, upgrades } from "hardhat";
import { WorkspaceRegistry } from "../src/types";

export function randomEthAddress() {
  const addr = randomBytes(20); // random address
  const addrHex = `0x${addr.toString("hex")}`;
  return addrHex;
}

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
  return contract.createWorkspace(DUMMY_IPFS_HASH, safeAddress, "", safeChainId);
}

export async function deployWorkspaceContract(signer?: Signer) {
  const factory = await ethers.getContractFactory("WorkspaceRegistry");
  let workspaceRegistry = (await upgrades.deployProxy(factory, { kind: "uups" })) as WorkspaceRegistry;
  if (signer) {
    workspaceRegistry = workspaceRegistry.connect(signer);
  }

  return workspaceRegistry;
}
