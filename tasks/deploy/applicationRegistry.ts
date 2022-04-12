import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import { ApplicationRegistry__factory } from "../../src/types/factories/ApplicationRegistry__factory";

task("deploy:ApplicationRegistry").setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
  const applicationRegistryFactory: ApplicationRegistry__factory = <ApplicationRegistry__factory>(
    await ethers.getContractFactory("ApplicationRegistry")
  );
  const applicationRegistry: ApplicationRegistry = <ApplicationRegistry>(
    await upgrades.deployProxy(applicationRegistryFactory, { kind: "uups" })
  );
  const tx = await applicationRegistry.deployed();
  const res = await tx.deployTransaction.wait();
  // @ts-expect-error events
  console.log("ApplicationRegistry Implementation deployed to:", res.events[0].args[0]);
  console.log("ApplicationRegistry Proxy deployed to: ", applicationRegistry.address);
});

task("upgrade:ApplicationRegistry")
  .addParam("addressApplicationRegistry", "address of the ApplicationRegistry implementation instance")
  .setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
    const { addressApplicationRegistry } = taskArguments;
    console.log("upgrading ApplicationRegistry at address: ", addressApplicationRegistry);
    const applicationRegistryFactoryV2: ApplicationRegistry__factory = <ApplicationRegistry__factory>(
      await ethers.getContractFactory("ApplicationRegistryV2")
    );
    const applicationRegistry: ApplicationRegistry = <ApplicationRegistry>(
      await upgrades.upgradeProxy(addressApplicationRegistry, applicationRegistryFactoryV2)
    );
    await applicationRegistry.deployed();
    console.log("ApplicationRegistryV2 Proxy deployed to: ", applicationRegistry.address);
  });
