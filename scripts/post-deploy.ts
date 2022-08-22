import { getAnonAuthoriserAddress } from "@questbook/anon-authoriser";
import { readFile } from "fs/promises";
import { ethers } from "hardhat";
import type {} from "../src/types";

async function main() {
  const network = process.env.NETWORK;
  if (!network) {
    throw new Error("NETWORK environment variable is not set");
  }

  const address = getAnonAuthoriserAddress(network as any);
  if (!address) {
    throw new Error("Anon authoriser is not deployed on this network");
  }

  const configStr = await readFile("./config.json", "utf-8");
  const config = JSON.parse(configStr);

  const WorkspsaceRegistryFactory = await ethers.getContractFactory("WorkspaceRegistry");
  const WorkspaceRegistryContract = await WorkspsaceRegistryFactory.attach(config.workspaceRegistryAddress.proxy);
  let tx = await WorkspaceRegistryContract.updateAnonAuthoriserAddress(address);
  await tx.wait();

  const GrantFactory = await ethers.getContractFactory("GrantFactory");
  const GrantFactoryContract = await GrantFactory.attach(config.grantFactoryAddress.proxy);
  tx = await GrantFactoryContract.setApplicationReviewReg(config.applicationReviewRegistryAddress.proxy);
  await tx.wait();

  const ApplicationRegistryFactory = await ethers.getContractFactory("ApplicationRegistry");
  const ApplicationRegistryContract = await ApplicationRegistryFactory.attach(config.applicationRegistryAddress.proxy);
  tx = await ApplicationRegistryContract.setWorkspaceReg(config.workspaceRegistryAddress.proxy);
  await tx.wait();
  tx = await ApplicationRegistryContract.setApplicationReviewReg(config.applicationReviewRegistryAddress.proxy);
  await tx.wait();

  const ApplicationReviewRegistryFactory = await ethers.getContractFactory("ApplicationReviewRegistry");
  const ApplicationReviewRegistryContract = await ApplicationReviewRegistryFactory.attach(
    config.applicationReviewRegistryAddress.proxy,
  );
  tx = await ApplicationReviewRegistryContract.setApplicationReg(config.applicationRegistryAddress.proxy);
  await tx.wait();

  tx = await ApplicationReviewRegistryContract.setGrantFactory(config.grantFactoryAddress.proxy);
  await tx.wait();

  tx = await ApplicationReviewRegistryContract.setWorkspaceReg(config.workspaceRegistryAddress.proxy);
  await tx.wait();
}

main();
