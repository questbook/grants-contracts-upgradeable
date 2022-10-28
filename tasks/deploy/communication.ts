import { TaskArguments } from "hardhat/types";
import { task } from "hardhat/config";

task("deploy:Communication").setAction(async function (taskArguments: TaskArguments, { ethers }) {
  const contract = await ethers.getContractFactory("Communication");
  const communication = await contract.deploy();

  console.log("Communication deployed to:", communication.address);
});
