import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import { ApplicationRegistry__factory } from "../../src/types/factories/ApplicationRegistry__factory";

task("deploy:ApplicationRegistry").setAction(async function (taskArguments: TaskArguments, { ethers }) {
  const applicationRegistryFactory: ApplicationRegistry__factory = <ApplicationRegistry__factory>(
    await ethers.getContractFactory("ApplicationRegistry")
  );
  const applicationRegistry: ApplicationRegistry = <ApplicationRegistry>await applicationRegistryFactory.deploy();
  await applicationRegistry.deployed();
  console.log("ApplicationRegistry deployed to: ", applicationRegistry.address);
});
