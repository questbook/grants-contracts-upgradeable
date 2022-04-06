import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { WorkspaceRegistry__factory } from "../../src/types/factories/WorkspaceRegistry__factory";

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
  console.log("WorkspaceRegistry Implementation deployed to:", res.events[0].args[0]);
  console.log("WorkspaceRegistry Proxy deployed to: ", workspaceRegistry.address);
});

task("upgrade:WorkspaceRegistry")
  .addParam("addressWorkspaceRegistry", "address of the implementation instance")
  .setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
    const { addressWorkspaceRegistry } = taskArguments;
    console.log("upgrading WorkspaceRegistry at address: ", addressWorkspaceRegistry);
    const workspaceRegistryFactoryV2: WorkspaceRegistry__factory = <WorkspaceRegistry__factory>(
      await ethers.getContractFactory("WorkspaceRegistryV2")
    );
    const workspaceRegistry: WorkspaceRegistry = <WorkspaceRegistry>(
      await upgrades.upgradeProxy(addressWorkspaceRegistry, workspaceRegistryFactoryV2)
    );
    await workspaceRegistry.deployed();
    console.log("WorkspaceRegistryV2 Proxy deployed to: ", workspaceRegistry.address);
  });
