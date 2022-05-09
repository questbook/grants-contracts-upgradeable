/* global describe it before ethers */

const { getSelectors, FacetCutAction } = require("../../scripts/libraries/diamond.js");
const { deployDiamond, accounts } = require("../../scripts/deploy.js");
const { assert } = require("chai");
// const Signers  = require("@nomiclabs/hardhat-ethers/dist/src/signer-with-address");
const { shouldBehaveLikeApplicationRegistry } = require("./ApplicationRegistry.behavior");

describe("Unit tests", function () {
  before(async function () {
    const accounts = await ethers.getSigners();

    this.signers = {};
    this.signers.admin = accounts[0];
    this.signers.nonAdmin = accounts[1];
    this.signers.applicantAdmin = accounts[2];
    this.signers.reviewer = accounts[3];
  });

  describe("ApplicationRegistry", async function () {
    let diamondAddress;
    let diamondCutFacet;
    // let applicationRegistry;
    // let applicationReviewRegistryFacet;
    // let grantFactoryFacet;
    // let workspaceRegistryFacet;
    let diamondLoupeFacet;
    let ownershipFacet;
    let tx;
    let receipt;
    let result;
    const addresses = [];

    beforeEach(async function () {
      diamondAddress = await deployDiamond();
      diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", diamondAddress);
      diamondLoupeFacet = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);
      ownershipFacet = await ethers.getContractAt("OwnershipFacet", diamondAddress);
      this.applicationRegistry = await ethers.getContractAt("ApplicationRegistryFacet", diamondAddress);
      this.workspaceRegistry = await ethers.getContractAt("WorkspaceRegistryFacet", diamondAddress);
      this.grantFactory = await ethers.getContractAt("GrantFactoryFacet", diamondAddress);
      this.grantPrep = await ethers.getContractFactory("GrantFacet");
    });

    it("should have seven facets -- call to facetAddresses function", async () => {
      for (const address of await diamondLoupeFacet.facetAddresses()) {
        addresses.push(address);
      }
      assert.equal(addresses.length, 7);
    });

    //   it("should test deployed contract has same member functions", async () => {
    //     const ApplicationRegistryFacet = await ethers.getContractFactory("ApplicationRegistryFacet");
    //     const selectors = getSelectors(ApplicationRegistryFacet);
    //     console.log('Address>>>', addresses[3])
    //     result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3]);
    //     assert.sameMembers(result, selectors);
    //   });

    shouldBehaveLikeApplicationRegistry();
  });
});
