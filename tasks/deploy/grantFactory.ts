import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { GrantFactory } from "../../src/types/GrantFactory";
import { GrantFactory__factory } from "../../src/types/factories/GrantFactory__factory";

const fs = require("fs");

task("deploy:GrantFactory").setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
  const grantFactoryFactory: GrantFactory__factory = <GrantFactory__factory>(
    await ethers.getContractFactory("GrantFactory")
  );
  const grantFactory: GrantFactory = <GrantFactory>await upgrades.deployProxy(grantFactoryFactory, { kind: "uups" });
  const tx = await grantFactory.deployed();
  const res = await tx.deployTransaction.wait();
  // @ts-expect-error events
  const implAddress = res.events[0].args[0];
  // @ts-expect-error events
  console.log("GrantFactory Implementation deployed to:", res.events[0].args[0]);
  console.log("GrantFactory Proxy deployed to: ", grantFactory.address);
  const grantFactoryAddress = {
    grantFactoryAddress: {
      proxy: grantFactory.address,
      implementation: implAddress,
    },
  };
  const jsonData = JSON.stringify(grantFactoryAddress);

  if (fs.existsSync("config.json")) {
    let contractsData = fs.readFileSync("config.json");
    let contractAddresses = JSON.parse(contractsData);
    contractAddresses = { ...contractAddresses, ...grantFactoryAddress };
    fs.writeFileSync("config.json", JSON.stringify(contractAddresses));
  } else {
    fs.writeFileSync("config.json", jsonData);
  }
});

task("upgrade:GrantFactory")
  .addParam("address", "address of the implementation instance")
  .setAction(async function (taskArguments: TaskArguments, { ethers, upgrades }) {
    const { address } = taskArguments;
    console.log("upgrading GrantFactory at address: ", address);
    const grantFactoryFactoryV2: GrantFactory__factory = <GrantFactory__factory>(
      await ethers.getContractFactory("GrantFactory")
    );
    const grantFactory: GrantFactory = <GrantFactory>await upgrades.upgradeProxy(address, grantFactoryFactoryV2);
    await grantFactory.deployed();
    console.log("GrantFactoryV2 Proxy deployed to: ", grantFactory.address);
  });
