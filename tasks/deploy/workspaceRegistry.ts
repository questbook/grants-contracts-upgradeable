import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { WorkspaceRegistry__factory } from "../../src/types/factories/WorkspaceRegistry__factory";

task("deploy:WorkspaceRegistry").setAction(async function (taskArguments: TaskArguments, { ethers }) {
  const workspaceRegistryFactory: WorkspaceRegistry__factory = <WorkspaceRegistry__factory>(
    await ethers.getContractFactory("WorkspaceRegistry")
  );
  const workspaceRegistry: WorkspaceRegistry = <WorkspaceRegistry>await workspaceRegistryFactory.deploy();
  await workspaceRegistry.deployed();
  console.log("WorkspaceRegistry deployed to: ", workspaceRegistry.address);
});
