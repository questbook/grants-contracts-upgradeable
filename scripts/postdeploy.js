const config = require("../config.json");
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const GrantFactory = await hre.ethers.getContractFactory("GrantFactory");
  const GrantFactoryContract = await GrantFactory.attach(config.grantFactoryAddress.proxy);
  let tx = await GrantFactoryContract.setApplicationReviewReg(config.applicationReviewRegistryAddress.proxy);
  await tx.wait();

  const ApplicationRegistryFactory = await hre.ethers.getContractFactory("ApplicationRegistry");
  const ApplicationRegistryContract = await ApplicationRegistryFactory.attach(config.applicationRegistryAddress.proxy);
  tx = await ApplicationRegistryContract.setWorkspaceReg(config.workspaceRegistryAddress.proxy);
  await tx.wait();

  const ApplicationReviewRegistryFactory = await hre.ethers.getContractFactory("ApplicationReviewRegistry");
  const ApplicationReviewRegistryContract = await ApplicationReviewRegistryFactory.attach(
    config.applicationReviewRegistryAddress.proxy,
  );
  tx = await ApplicationReviewRegistryContract.setApplicationReg(config.applicationRegistryAddress.proxy);
  tx.wait();

  tx = await ApplicationReviewRegistryContract.setGrantFactory(config.grantFactoryAddress.proxy);
  await tx.wait();

  tx = await ApplicationReviewRegistryContract.setWorkspaceReg(config.workspaceRegistryAddress.proxy);
  await tx.wait();
  console.log(config);
}

main()
  .then(() => {
    fs.unlinkSync("./config.json");
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
