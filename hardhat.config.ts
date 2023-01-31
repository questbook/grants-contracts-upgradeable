import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";

import "./tasks/accounts";
import "./tasks/deploy";

import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";
import chains from "./chains.json";

dotenvConfig({ path: resolve(__dirname, "./.env") });

type Chain = keyof typeof chains;

const HARDHAT_CHAIN_ID = 31337;

// Ensure that we have all the environment variables we need.
// Private key is a must for any deployment
const privateKey = process.env.PRIVATE_KEY!;
// If the network you want to deploy to requires an Infura key
// specify it in the environment variable INFURA_KEY
const infuraApiKey = process.env.INFURA_API_KEY;
// If the network you want to deploy to requires an Alchemy key
// specify it in the environment variable ALCHEMY_API_KEY
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
// If the network to deploy to is specified
// only that specific network will be used in the hardhat config
const selectedNetwork = process.env.NETWORK;
if (!privateKey) {
  throw new Error("Please set your private key in a .env file");
}

const CHAIN_LIST = (selectedNetwork ? [selectedNetwork] : Object.keys(chains)) as Chain[];

function getChainConfig(network: Chain): NetworkUserConfig | undefined {
  const chainData = chains[network];
  if (chainData) {
    let rpcUrl = chains[network].rpcUrl;
    if (rpcUrl.includes("{{infura_key}}")) {
      if (!infuraApiKey) {
        throw new Error("Infura key required to connect to " + network);
      }
      rpcUrl = rpcUrl.replace("{{infura_key}}", infuraApiKey);
    }
    if (rpcUrl.includes("{{alchemy_key}}")) {
      if (!alchemyApiKey) {
        throw new Error("Alchemy key required to connect to " + network);
      }
      rpcUrl = rpcUrl.replace("{{alchemy_key}}", alchemyApiKey);
    }
    console.log(rpcUrl);
    return {
      accounts: [privateKey],
      chainId: chains[network].id,
      url: rpcUrl,
    };
  }
}

const config: HardhatUserConfig = {
  defaultNetwork: selectedNetwork || "hardhat",
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    ...CHAIN_LIST.reduce((dict, chainName) => {
      const config = getChainConfig(chainName);
      if (config) {
        dict[chainName] = config;
      }

      return dict;
    }, {} as { [C in Chain]: NetworkUserConfig }),
    hardhat: {
      chainId: HARDHAT_CHAIN_ID,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.7",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: "src/types",
    target: "ethers-v5",
  },
  etherscan: {
    // apiKey: process.env.POLYGONSCAN_KEY,
    // apiKey: process.env.ETHERSCAN_KEY,
    // apiKey: process.env.OPT_ETHERSCAN_KEY,
    // apiKey: process.env.GOERLI_ETHERSCAN_KEY,
    apiKey: process.env.CELOSCAN_KEY,
    // apiKey: {
    //   "polygon-mainnet": process.env.POLYGONSCAN_KEY ?? "",
    //   "optimism-mainnet": process.env.OPT_ETHERSCAN_KEY ?? "",
    //   "celo-mainnet": process.env.CELOSCAN_KEY ?? "",
    // },
    customChains: [
      {
        network: "celo-mainnet",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io/",
        },
      },
    ],
  },
};

export default config;
