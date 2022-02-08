# Questbook v0

This repository contains the core smart contracts for the Questbook Grants Orchestrator tool.

Any protocol can visit the tool and create a DAO or Workspace which can then be used to create and list grants on the tool. On the other hand developers can visit the platform and apply for grant of their liking.

There are 4 contracts involved with self explanatory names:

- [Workspace Registry](https://github.com/questbook/contracts/blob/main/contracts/WorkspaceRegistry.sol) - Responsible for workspace related operations
- [Grant Factory](https://github.com/questbook/contracts/blob/main/contracts/GrantFactory.sol) - Factory contract which is responsible for creating grants as seperate contracts
- [Grant](https://github.com/questbook/contracts/blob/main/contracts/Grant.sol) - Implementation of grant related operations
- [Application Registry](https://github.com/questbook/contracts/blob/main/contracts/ApplicationRegistry.sol) - Responsible for application related operations

For more details about the product flow, check out below sitemap
![Sitemap](https://github.com/questbook/contracts/blob/main/docs/assets/sitemap.png)

## Scaffolded from - [Solidity Template](https://github.com/PaulRBerg/solidity-template)

## Usage

### Pre Requisites

Before running any command, you need to create a `.env` file and set a BIP-39 compatible mnemonic as an environment
variable. Follow the example in `.env.example`. If you don't already have a mnemonic, use this [website](https://iancoleman.io/bip39/) to generate one.

Then, proceed with installing dependencies:

```sh
yarn install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### TypeChain

Compile the smart contracts and generate TypeChain artifacts:

```sh
$ yarn typechain
```

### Prettify Solidity

Prettify the Solidity code:

```sh
$ yarn prettier:sol
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Prettify Typescript

Prettify the Typescript code:

```sh
$ yarn prettier:ts
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Test

Run the Mocha tests:

```sh
$ yarn test
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Report Gas

See the gas usage per unit test and average gas per method call:

```sh
$ REPORT_GAS=true yarn test
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ yarn clean
```

### Deploy

Deploy the contracts to Hardhat Network:

```sh
$ yarn deploy
```

## Syntax Highlighting

If you use VSCode, you can enjoy syntax highlighting for your Solidity code via the
[vscode-solidity](https://github.com/juanfranblanco/vscode-solidity) extension. The recommended approach to set the
compiler version is to add the following fields to your VSCode user settings:

```json
{
  "solidity.compileUsingRemoteVersion": "v0.8.4+commit.c7e474f2",
  "solidity.defaultCompiler": "remote"
}
```

Where of course `v0.8.4+commit.c7e474f2` can be replaced with any other version.
