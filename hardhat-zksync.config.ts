import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";

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

    return {
      accounts: [privateKey!],
      chainId: chains[network].id,
      url: rpcUrl,
    };
  }
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },

  zksolc: {
    version: "0.1.0",
    compilerSource: "docker",
    settings: {
      compilerPath: "",
      optimizer: {
        enabled: true,
      },
      experimental: {
        dockerImage: "matterlabs/zksolc",
      },
    },
  },
  zkSyncDeploy: {
    zkSyncNetwork: "https://zksync2-testnet.zksync.dev",
    ethNetwork: "rinkeby", // Can also be the RPC URL of the network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
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
      zksync: true,
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
    apiKey: process.env.OPT_ETHERSCAN_KEY,
  },
};

export default config;
