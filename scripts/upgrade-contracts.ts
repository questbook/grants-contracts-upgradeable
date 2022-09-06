import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";
import { load } from "js-yaml";

const CHAINS_JSON_URL = "https://raw.githubusercontent.com/questbook/chains/main/chains/{{network}}.yaml";

async function main() {
  const network = process.env.NETWORK;
  if (!network) {
    throw new Error("NETWORK environment variable is not set");
  }

  console.log(`upgrading contracts on ${network}`);

  console.log("compiling contracts first...");
  await execPromise("yarn compile");

  console.log("fetching proxy addresses...");

  const url = CHAINS_JSON_URL.replace("{{network}}", network);
  const { data: yamlStr } = await axios.get(url, { responseType: "text" });
  const chainYaml: any = load(yamlStr);

  const contractAddresses = chainYaml.qbContracts;
  console.log(`fetched ${Object.keys(contractAddresses).length} contract addresses`);

  // check we've the mapping for all the contract addresses
  for (const contract in contractAddresses) {
    const name = CONTRACT_MAP[contract];
    if (!name) {
      throw new Error(`do not have mapping for "${contract}"`);
    }
  }

  for (const contract in contractAddresses) {
    const name = CONTRACT_MAP[contract];
    const address = contractAddresses[contract].address;
    const appAddress = contractAddresses.applications.address;
    const shouldAddAppAddress = contract === "workspace";

    console.log(`upgrading ${contract} (${name}) on ${address}`);
    await execPromise(
      `yarn hardhat upgrade:${name} --address ${address} ${shouldAddAppAddress ? `--appregistry ${appAddress}` : ""}`,
    );
    console.log(`upgraded ${name}`);
  }
}

const CONTRACT_MAP: { [_: string]: string } = {
  workspace: "WorkspaceRegistry",
  grantFactory: "GrantFactory",
  reviews: "ApplicationReviewRegistry",
  applications: "ApplicationRegistry",
};

const execPromise = promisify(exec);

main();
