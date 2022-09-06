import { randomBytes } from "crypto";
import { Signer } from "ethers";
import { ethers, upgrades } from "hardhat";
import type { WorkspaceRegistry } from "../src/types";

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

export function isValidDistribution(numOfReviewerPerApplication: number, distribution: number[]): boolean {
  for (let i = 0; i < distribution.length; ++i) distribution[i] %= numOfReviewerPerApplication;
  for (let j = 0; j < numOfReviewerPerApplication; ++j) {
    distribution.sort((a, b) => b - a);
    for (let i = 0; i < numOfReviewerPerApplication; ++i) if (distribution[i] > 0) --distribution[i];
    if (distribution.every(x => x === 0)) return true;
  }
  return false;
}

export function generateAssignment(
  numOfApplications: number,
  numOfReviewers: number,
  numOfReviewerPerApplication: number,
): number[] {
  const distribution = new Array(numOfReviewers).fill(0);
  let lastIndex: number = 0;
  for (let i = 0; i < numOfApplications; ++i) {
    for (let j = 0; j < numOfReviewerPerApplication; ++j) {
      distribution[lastIndex]++;
      lastIndex = (lastIndex + 1) % numOfReviewers;
    }
  }
  return distribution;
}

export function areEqualDistributions(arr1: number[], arr2: number[]) {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < Math.min(arr1.length, arr2.length); ++i) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}
