/* global describe it before ethers */

const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets,
} = require("../../scripts/libraries/diamond.js");

const { deployDiamond } = require("../../scripts/deploy.js");

const { assert } = require("chai");

describe("DiamondTest", async function () {
  let diamondAddress;
  let diamondCutFacet;
  // let applicationRegistryFacet;
  // let applicationReviewRegistryFacet;
  // let grantFactoryFacet;
  // let workspaceRegistryFacet;
  let diamondLoupeFacet;
  let ownershipFacet;
  let tx;
  let receipt;
  let result;
  const addresses = [];

  before(async function () {
    diamondAddress = await deployDiamond();
    diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", diamondAddress);
    diamondLoupeFacet = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);
    ownershipFacet = await ethers.getContractAt("OwnershipFacet", diamondAddress);
    // applicationRegistryFacet = await ethers.getContractAt("ApplicationRegistryFacet", diamondAddress);
    // applicationReviewRegistryFacet = await ethers.getContractAt("ApplicationReviewRegistryFacet", diamondAddress);
    // grantFactoryFacet = await ethers.getContractAt("GrantFactoryFacet", diamondAddress);
    // workspaceRegistryFacet = await ethers.getContractAt("WorkspaceRegistryFacet", diamondAddress);
  });

  it("should have three facets -- call to facetAddresses function", async () => {
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address);
    }

    assert.equal(addresses.length, 3);
  });

  it("facets should have the right function selectors -- call to facetFunctionSelectors function", async () => {
    let selectors = getSelectors(diamondCutFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0]);
    assert.sameMembers(result, selectors);
    selectors = getSelectors(diamondLoupeFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1]);
    assert.sameMembers(result, selectors);
    selectors = getSelectors(ownershipFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2]);
    assert.sameMembers(result, selectors);
    // result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3]);
    // assert.sameMembers(result, selectors);
    // result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4]);
    // assert.sameMembers(result, selectors);
    // result = await diamondLoupeFacet.facetFunctionSelectors(addresses[5]);
    // assert.sameMembers(result, selectors);
    // result = await diamondLoupeFacet.facetFunctionSelectors(addresses[6]);
    // assert.sameMembers(result, selectors);
  });

  it("selectors should be associated to facets correctly -- multiple calls to facetAddress function", async () => {
    assert.equal(addresses[0], await diamondLoupeFacet.facetAddress("0x1f931c1c"));
    assert.equal(addresses[1], await diamondLoupeFacet.facetAddress("0xcdffacc6"));
    assert.equal(addresses[1], await diamondLoupeFacet.facetAddress("0x01ffc9a7"));
    assert.equal(addresses[2], await diamondLoupeFacet.facetAddress("0xf2fde38b"));
    // assert.equal(addresses[3], await diamondLoupeFacet.facetAddress("0x689b748f"));
    // assert.equal(addresses[4], await diamondLoupeFacet.facetAddress("0x013a9d81"));
    // assert.equal(addresses[5], await diamondLoupeFacet.facetAddress("0x3f4ba83a"));
    // assert.equal(addresses[6], await diamondLoupeFacet.facetAddress("0xfcdd9280"));
  });

  it("should add ApplicationRegistryFacet functions", async () => {
    const ApplicationRegistryFacet = await ethers.getContractFactory("ApplicationRegistryFacet");
    const applicationRegistryFacet = await ApplicationRegistryFacet.deploy();
    await applicationRegistryFacet.deployed();
    addresses.push(applicationRegistryFacet.address);
    console.log(applicationRegistryFacet.address);
    const selectors = getSelectors(applicationRegistryFacet).remove(["getApplicationOwner(uint96)"]);
    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: applicationRegistryFacet.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 },
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(applicationRegistryFacet.address);
    assert.sameMembers(result, selectors);
  });

  it("should test function call", async () => {
    const applicationRegistryFacet = await ethers.getContractAt("ApplicationRegistryFacet", diamondAddress);
    await applicationRegistryFacet.test1Func10();
  });

  it("should replace getApplicationOwner function", async () => {
    const applicationRegistryFacet = await ethers.getContractFactory("ApplicationRegistryFacet");
    const selectors = getSelectors(applicationRegistryFacet).get(["getApplicationOwner(uint96)"]);
    console.log(addresses[3]);

    const applicationRegistryFacetAddress = addresses[3];
    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: applicationRegistryFacetAddress,
          action: FacetCutAction.Replace,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 },
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(applicationRegistryFacetAddress);
    assert.sameMembers(result, getSelectors(applicationRegistryFacet));
  });

  it("should add test2 functions", async () => {
    const Test2Facet = await ethers.getContractFactory("Test2Facet");
    const test2Facet = await Test2Facet.deploy();
    await test2Facet.deployed();
    addresses.push(test2Facet.address);
    const selectors = getSelectors(test2Facet);
    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: test2Facet.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 },
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(test2Facet.address);
    assert.sameMembers(result, selectors);
  });

  it("should remove some test2 functions", async () => {
    const test2Facet = await ethers.getContractAt("Test2Facet", diamondAddress);
    const functionsToKeep = ["test2Func1()", "test2Func5()", "test2Func6()", "test2Func19()", "test2Func20()"];
    const selectors = getSelectors(test2Facet).remove(functionsToKeep);
    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 },
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4]);
    assert.sameMembers(result, getSelectors(test2Facet).get(functionsToKeep));
  });

  it("should remove some test1 functions", async () => {
    const test1Facet = await ethers.getContractAt("ApplicationRegistryFacet", diamondAddress);
    const functionsToKeep = ["getApplicationOwner(uint96)", "getApplicationWorkspace(uint96)"];
    const selectors = getSelectors(test1Facet).remove(functionsToKeep);
    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 },
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3]);
    assert.sameMembers(result, getSelectors(test1Facet).get(functionsToKeep));
  });

  it("remove all functions and facets except 'diamondCut' and 'facets'", async () => {
    let selectors = [];
    let facets = await diamondLoupeFacet.facets();
    for (let i = 0; i < facets.length; i++) {
      selectors.push(...facets[i].functionSelectors);
    }
    selectors = removeSelectors(selectors, ["facets()", "diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)"]);
    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 },
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    facets = await diamondLoupeFacet.facets();
    assert.equal(facets.length, 2);
    assert.equal(facets[0][0], addresses[0]);
    assert.sameMembers(facets[0][1], ["0x1f931c1c"]);
    assert.equal(facets[1][0], addresses[1]);
    assert.sameMembers(facets[1][1], ["0x7a0ed627"]);
  });

  it("add most functions and facets", async () => {
    const diamondLoupeFacetSelectors = getSelectors(diamondLoupeFacet).remove(["supportsInterface(bytes4)"]);
    const Test1Facet = await ethers.getContractFactory("Test1Facet");
    const Test2Facet = await ethers.getContractFactory("Test2Facet");
    // Any number of functions from any number of facets can be added/replaced/removed in a
    // single transaction
    const cut = [
      {
        facetAddress: addresses[1],
        action: FacetCutAction.Add,
        functionSelectors: diamondLoupeFacetSelectors.remove(["facets()"]),
      },
      {
        facetAddress: addresses[2],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(ownershipFacet),
      },
      {
        facetAddress: addresses[3],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test1Facet),
      },
      {
        facetAddress: addresses[4],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test2Facet),
      },
    ];
    tx = await diamondCutFacet.diamondCut(cut, ethers.constants.AddressZero, "0x", { gasLimit: 8000000 });
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    const facets = await diamondLoupeFacet.facets();
    const facetAddresses = await diamondLoupeFacet.facetAddresses();
    assert.equal(facetAddresses.length, 5);
    assert.equal(facets.length, 5);
    assert.sameMembers(facetAddresses, addresses);
    assert.equal(facets[0][0], facetAddresses[0], "first facet");
    assert.equal(facets[1][0], facetAddresses[1], "second facet");
    assert.equal(facets[2][0], facetAddresses[2], "third facet");
    assert.equal(facets[3][0], facetAddresses[3], "fourth facet");
    assert.equal(facets[4][0], facetAddresses[4], "fifth facet");
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[0], facets)][1], getSelectors(diamondCutFacet));
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[1], facets)][1], diamondLoupeFacetSelectors);
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[2], facets)][1], getSelectors(ownershipFacet));
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[3], facets)][1], getSelectors(Test1Facet));
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[4], facets)][1], getSelectors(Test2Facet));
  });
});
