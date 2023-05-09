import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { UtilityRegistry } from "../../src/types/UtilityRegistry";
import { UtilityRegistry__factory } from "../../src/types/factories/UtilityRegistry__factory";

const fs = require("fs");

task("deploy:UtilityRegistry").setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
  const UtilityRegistryFactory: UtilityRegistry__factory = <UtilityRegistry__factory>(
    await ethers.getContractFactory("UtilityRegistry")
  );
  const UtilityRegistry: UtilityRegistry = <UtilityRegistry>(
    await upgrades.deployProxy(UtilityRegistryFactory, { kind: "uups" })
  );
  const tx = await UtilityRegistry.deployed();
  const res = await tx.deployTransaction.wait();
  // @ts-expect-error events
  const implAddress = res.events[0].args[0];
  // @ts-expect-error events
  console.log("UtilityRegistry Implementation deployed to:", res.events[0].args[0]);
  console.log("UtilityRegistry Proxy deployed to: ", UtilityRegistry.address);
  const UtilityRegistryAddress = {
    UtilityRegistryAddress: {
      proxy: UtilityRegistry.address,
      implementation: implAddress,
      blockNumber: res.blockNumber,
    },
  };
  const jsonData = JSON.stringify(UtilityRegistryAddress);

  if (fs.existsSync("config.json")) {
    const contractsData = fs.readFileSync("config.json");
    let contractAddresses = JSON.parse(contractsData);
    contractAddresses = { ...contractAddresses, ...UtilityRegistryAddress };
    fs.writeFileSync("config.json", JSON.stringify(contractAddresses));
  } else {
    fs.writeFileSync("config.json", jsonData);
  }
});

task("upgrade:UtilityRegistry")
  .addParam("address", "address of the Communication implementation instance")
  .setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
    const { address } = taskArguments;
    console.log("upgrading Communication at address: ", address);
    const UtilityRegistryV2: UtilityRegistry__factory = <UtilityRegistry__factory>(
      await ethers.getContractFactory("UtilityRegistry")
    );
    const UtilityRegistry: UtilityRegistry = <UtilityRegistry>await upgrades.upgradeProxy(address, UtilityRegistryV2);
    await UtilityRegistry.deployed();
    console.log("UtilityRegistryV2 Proxy deployed to: ", UtilityRegistry.address);
  });
