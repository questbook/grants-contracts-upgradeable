import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { GrantFactory } from "../../src/types/GrantFactory";
import { GrantFactory__factory } from "../../src/types/factories/GrantFactory__factory";

task("deploy:GrantFactory").setAction(async function (taskArguments: TaskArguments, { ethers }) {
  const grantFactoryFactory: GrantFactory__factory = <GrantFactory__factory>(
    await ethers.getContractFactory("GrantFactory")
  );
  const grantFactory: GrantFactory = <GrantFactory>await grantFactoryFactory.deploy();
  await grantFactory.deployed();
  console.log("GrantFactory deployed to: ", grantFactory.address);
});
