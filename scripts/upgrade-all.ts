import CHAINS from "../chains.json";
import { exec } from "child_process";
import { promisify } from "util";

async function main() {
  const chainsList = Object.keys(CHAINS);
  for (const chain of chainsList) {
    console.log(`upgrading contracts on ${chain}`);
    await execPromise("yarn upgrade:contracts", { env: { ...process.env, NETWORK: chain } });
    console.log(`upgraded contracts on ${chain}`);
  }
}

const execPromise = promisify(exec);

main();
