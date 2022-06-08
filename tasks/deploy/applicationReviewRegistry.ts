import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { ApplicationReviewRegistry } from "../../src/types/ApplicationReviewRegistry";
import { ApplicationReviewRegistry__factory } from "../../src/types/factories/ApplicationReviewRegistry__factory";

const fs = require("fs");

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
  const implAddress = res.events[0].args[0];
  // @ts-expect-error events
  console.log("ApplicationReviewRegistry Implementation deployed to:", res.events[0].args[0]);
  console.log("ApplicationReviewRegistry Proxy deployed to: ", applicationReviewRegistry.address);

  const applicationReviewRegistryAddress = {
    applicationReviewRegistryAddress: {
      proxy: applicationReviewRegistry.address,
      implementation: implAddress,
      blockNumber: tx.deployTransaction.blockNumber,
    },
  };
  const jsonData = JSON.stringify(applicationReviewRegistryAddress);
  if (fs.existsSync("config.json")) {
    let contractsData = fs.readFileSync("config.json");
    let contractAddresses = JSON.parse(contractsData);
    contractAddresses = { ...contractAddresses, ...applicationReviewRegistryAddress };
    fs.writeFileSync("config.json", JSON.stringify(contractAddresses));
  } else {
    fs.writeFileSync("config.json", jsonData);
  }
});

task("upgrade:ApplicationReviewRegistry")
  .addParam("address", "address of the ApplicationReviewRegistry implementation instance")
  .setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
    const { address } = taskArguments;
    console.log("upgrading ApplicationReviewRegistry at address: ", address);
    const applicationReviewRegistryFactoryV2: ApplicationReviewRegistry__factory = <ApplicationReviewRegistry__factory>(
      await ethers.getContractFactory("ApplicationReviewRegistry")
    );
    const applicationReviewRegistry: ApplicationReviewRegistry = <ApplicationReviewRegistry>(
      await upgrades.upgradeProxy(address, applicationReviewRegistryFactoryV2)
    );
    await applicationReviewRegistry.deployed();
    console.log("ApplicationReviewRegistryV2 Proxy deployed to: ", applicationReviewRegistry.address);
  });
