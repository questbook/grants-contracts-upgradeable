import { readFile, writeFile } from "fs/promises";

async function main() {
  const list = [
    "ApplicationReviewRegistry",
    "ApplicationRegistry",
    "GrantFactory",
    "Grant",
    "WorkspaceRegistry",
    "Communication",
  ];

  for (const path of list) {
    const configStr = await readFile(`./artifacts/contracts/${path}.sol/${path}.json`, "utf-8");
    const json = JSON.parse(configStr);

    await writeFile(`./abis/${path}.json`, `${JSON.stringify(json["abi"], null, 2)}\n`);
  }
}

main();
