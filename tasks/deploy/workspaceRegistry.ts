import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { getAnonAuthoriserAddress } from "@questbook/anon-authoriser";

import { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { WorkspaceRegistry__factory } from "../../src/types/factories/WorkspaceRegistry__factory";

import fs from "fs";

task("deploy:WorkspaceRegistry").setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
  const workspaceRegistryFactory: WorkspaceRegistry__factory = <WorkspaceRegistry__factory>(
    await ethers.getContractFactory("WorkspaceRegistry")
  );
  const workspaceRegistry: WorkspaceRegistry = <WorkspaceRegistry>(
    await upgrades.deployProxy(workspaceRegistryFactory, { kind: "uups" })
  );
  const tx = await workspaceRegistry.deployed();
  const res = await tx.deployTransaction.wait();
  // @ts-expect-error events
  const implAddress = res.events[0].args[0];
  // @ts-expect-error events
  console.log("WorkspaceRegistry Implementation deployed to:", res.events[0].args[0]);
  console.log("WorkspaceRegistry Proxy deployed to: ", workspaceRegistry.address);
  console.log("Block number", res.blockNumber);
  const workspaceRegistryAddress = {
    workspaceRegistryAddress: {
      proxy: workspaceRegistry.address,
      implementation: implAddress,
      blockNumber: res.blockNumber,
    },
  };
  const jsonData = JSON.stringify(workspaceRegistryAddress);

  if (fs.existsSync("config.json")) {
    const contractsData = fs.readFileSync("config.json", "utf-8");
    let contractAddresses = JSON.parse(contractsData);
    contractAddresses = { ...contractAddresses, ...workspaceRegistryAddress };
    fs.writeFileSync("config.json", JSON.stringify(contractAddresses));
  } else {
    fs.writeFileSync("config.json", jsonData);
  }
});

task("upgrade:WorkspaceRegistry")
  .addParam("address", "address of the implementation instance")
  .setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
    const networkName = process.env.NETWORK;
    const anonAuthoriserAddress = getAnonAuthoriserAddress(networkName as any);
    if (!anonAuthoriserAddress) {
      throw new Error(`Anon authoriser is not deployed on this "${networkName}"`);
    }

    const { address } = taskArguments;
    console.log("upgrading WorkspaceRegistry at address: ", address);
    const workspaceRegistryFactoryV2: WorkspaceRegistry__factory = <WorkspaceRegistry__factory>(
      await ethers.getContractFactory("WorkspaceRegistry")
    );
    const workspaceRegistry: WorkspaceRegistry = <WorkspaceRegistry>(
      await upgrades.upgradeProxy(address, workspaceRegistryFactoryV2)
    );
    await workspaceRegistry.deployed();
    if (anonAuthoriserAddress !== (await workspaceRegistry.anonAuthoriserAddress())) {
      const tx = await workspaceRegistry.updateAnonAuthoriserAddress(anonAuthoriserAddress);
      await tx.wait();

      console.log(`updated WorkpsaceRegistry anon authoriser address to: ${anonAuthoriserAddress}`);
    }
    console.log("WorkspaceRegistryV2 Proxy deployed to: ", workspaceRegistry.address);
  });
