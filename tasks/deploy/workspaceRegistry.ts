import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { WorkspaceRegistry__factory } from "../../src/types/factories/WorkspaceRegistry__factory";

const fs = require("fs");

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
    let contractsData = fs.readFileSync("config.json");
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
    const { address } = taskArguments;
    console.log("upgrading WorkspaceRegistry at address: ", address);
    const workspaceRegistryFactoryV2: WorkspaceRegistry__factory = <WorkspaceRegistry__factory>(
      await ethers.getContractFactory("WorkspaceRegistry")
    );
    const workspaceRegistry: WorkspaceRegistry = <WorkspaceRegistry>(
      await upgrades.upgradeProxy(address, workspaceRegistryFactoryV2)
    );
    await workspaceRegistry.deployed();
    console.log("WorkspaceRegistryV2 Proxy deployed to: ", workspaceRegistry.address);
  });
