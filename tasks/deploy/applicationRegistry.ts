import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import { ApplicationRegistry__factory } from "../../src/types/factories/ApplicationRegistry__factory";

const fs = require("fs");

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
  const implAddress = res.events[0].args[0];
  // @ts-expect-error events
  console.log("ApplicationRegistry Implementation deployed to:", res.events[0].args[0]);
  console.log("ApplicationRegistry Proxy deployed to: ", applicationRegistry.address);
  const applicationRegistryAddress = {
    applicationRegistryAddress: {
      proxy: applicationRegistry.address,
      implementation: implAddress,
    },
  };
  const jsonData = JSON.stringify(applicationRegistryAddress);

  if (fs.existsSync("config.json")) {
    let contractsData = fs.readFileSync("config.json");
    let contractAddresses = JSON.parse(contractsData);
    contractAddresses = { ...contractAddresses, ...applicationRegistryAddress };
    fs.writeFileSync("config.json", JSON.stringify(contractAddresses));
  } else {
    fs.writeFileSync("config.json", jsonData);
  }
});

task("upgrade:ApplicationRegistry")
  .addParam("address", "address of the ApplicationRegistry implementation instance")
  .setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
    const { address } = taskArguments;
    console.log("upgrading ApplicationRegistry at address: ", address);
    const applicationRegistryFactoryV2: ApplicationRegistry__factory = <ApplicationRegistry__factory>(
      await ethers.getContractFactory("ApplicationRegistry")
    );
    const applicationRegistry: ApplicationRegistry = <ApplicationRegistry>(
      await upgrades.upgradeProxy(address, applicationRegistryFactoryV2)
    );
    await applicationRegistry.deployed();
    console.log("ApplicationRegistryV2 Proxy deployed to: ", applicationRegistry.address);
  });
