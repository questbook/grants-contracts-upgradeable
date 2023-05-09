import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";
import { load } from "js-yaml";
import CHAINS from "../chains.json";

const CHAINS_JSON_URL = "https://raw.githubusercontent.com/questbook/chains/main/chains/{{network}}.yaml";

async function main() {
  const contract = process.env.CONTRACT;
  if (!contract) {
    throw new Error("CONTRACT environment variable is not set");
  }

  const chainsList = Object.keys(CHAINS);
  for (const chain of chainsList) {
    try {
      console.log(`upgrading ${contract} contract on ${chain}`);
      const url = CHAINS_JSON_URL.replace("{{network}}", chain);
      const { data: yamlStr } = await axios.get(url, { responseType: "text" });
      const chainYaml: any = load(yamlStr);

      if (!chainYaml.qbContracts[contract] || !CONTRACT_MAP[contract]) {
        throw new Error(`do not have mapping for "${contract}"`);
      }

      const name = CONTRACT_MAP[contract];
      const address = chainYaml.qbContracts[contract].address;
      const appAddress = chainYaml.qbContracts.applications.address;
      const shouldAddAppAddress = contract === "workspace";
      if (!address) {
        throw new Error(`do not have address for "${contract}"`);
      }
      await execPromise(
        `yarn hardhat upgrade:${name} --address ${address} ${shouldAddAppAddress ? `--appregistry ${appAddress}` : ""}`,
        { env: { ...process.env, NETWORK: chain } },
      );
      console.log(`upgraded ${name} contract on ${chain}`);
    } catch (e) {
      console.log(`failed to upgrade ${contract} contract on ${chain} - Error: ${e}`);
    }
  }
}

const CONTRACT_MAP: { [_: string]: string } = {
  workspace: "WorkspaceRegistry",
  grantFactory: "GrantFactory",
  reviews: "ApplicationReviewRegistry",
  applications: "ApplicationRegistry",
  communication: "Communication",
  utility: "UtilityRegistry",
};

const execPromise = promisify(exec);

main();
