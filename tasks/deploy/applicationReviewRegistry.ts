import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { ApplicationReviewRegistry } from "../../src/types/ApplicationReviewRegistry";
import { ApplicationReviewRegistry__factory } from "../../src/types/factories/ApplicationReviewRegistry__factory";

task("deploy:ApplicationReviewRegistry").setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
  const applicationReviewRegistryFactory: ApplicationReviewRegistry__factory = <ApplicationReviewRegistry__factory>(
    await ethers.getContractFactory("ApplicationReviewRegistry")
  );
  const applicationReviewRegistry: ApplicationReviewRegistry = <ApplicationReviewRegistry>(
    await upgrades.deployProxy(applicationReviewRegistryFactory, { kind: "uups" })
  );
  const tx = await applicationReviewRegistry.deployed();
  const res = await tx.deployTransaction.wait();
  // @ts-expect-error events
  console.log("ApplicationReviewRegistry Implementation deployed to:", res.events[0].args[0]);
  console.log("ApplicationReviewRegistry Proxy deployed to: ", applicationReviewRegistry.address);
});

task("upgrade:ApplicationReviewRegistry")
  .addParam("address", "address of the ApplicationReviewRegistry implementation instance")
  .setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
    const { address } = taskArguments;
    console.log("upgrading ApplicationReviewRegistry at address: ", address);
    const applicationRegistryFactoryV2: ApplicationReviewRegistry__factory = <ApplicationReviewRegistry__factory>(
      await ethers.getContractFactory("ApplicationRegistry")
    );
    const applicationReviewRegistry: ApplicationReviewRegistry = <ApplicationReviewRegistry>(
      await upgrades.upgradeProxy(address, applicationRegistryFactoryV2)
    );
    await applicationReviewRegistry.deployed();
    console.log("ApplicationRegistryV2 Proxy deployed to: ", applicationReviewRegistry.address);
  });
