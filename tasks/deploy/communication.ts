import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { Communication } from "../../src/types/Communication";
import { Communication__factory } from "../../src/types/factories/Communication__factory";

const fs = require("fs");

task("deploy:Communication").setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
  const CommunicationFactory: Communication__factory = <Communication__factory>(
    await ethers.getContractFactory("Communication")
  );
  const Communication: Communication = <Communication>(
    await upgrades.deployProxy(CommunicationFactory, { kind: "uups" })
  );
  const tx = await Communication.deployed();
  const res = await tx.deployTransaction.wait();
  // @ts-expect-error events
  const implAddress = res.events[0].args[0];
  // @ts-expect-error events
  console.log("Communication Implementation deployed to:", res.events[0].args[0]);
  console.log("Communication Proxy deployed to: ", Communication.address);
  const CommunicationAddress = {
    CommunicationAddress: {
      proxy: Communication.address,
      implementation: implAddress,
      blockNumber: res.blockNumber,
    },
  };
  const jsonData = JSON.stringify(CommunicationAddress);

  if (fs.existsSync("config.json")) {
    const contractsData = fs.readFileSync("config.json");
    let contractAddresses = JSON.parse(contractsData);
    contractAddresses = { ...contractAddresses, ...CommunicationAddress };
    fs.writeFileSync("config.json", JSON.stringify(contractAddresses));
  } else {
    fs.writeFileSync("config.json", jsonData);
  }
});

task("upgrade:Communication")
  .addParam("address", "address of the Communication implementation instance")
  .setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
    const { address } = taskArguments;
    console.log("upgrading Communication at address: ", address);
    const CommunicationFactoryV2: Communication__factory = <Communication__factory>(
      await ethers.getContractFactory("Communication")
    );
    const Communication: Communication = <Communication>await upgrades.upgradeProxy(address, CommunicationFactoryV2);
    await Communication.deployed();
    console.log("CommunicationV2 Proxy deployed to: ", Communication.address);
  });
