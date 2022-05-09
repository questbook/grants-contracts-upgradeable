import { ethers, upgrades } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import type { Grant } from "../../src/types/Grant";
import { Signers } from "../types";
import { shouldBehaveLikeApplicationRegistry } from "./ApplicationRegistry.behavior";
import { expect } from "chai";

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.nonAdmin = signers[1];
    this.signers.applicantAdmin = signers[2];
    this.signers.reviewer = signers[3];
  });

  describe("ApplicationRegistry", function () {
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
      applicationRegistryFacet = await ethers.getContractAt("ApplicationRegistryFacet", diamondAddress);
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

    // it("test proxy deployment", async function () {
    //   const applicationRegistyV2 = await upgrades.upgradeProxy(
    //     this.applicationRegistry.address,
    //     this.applicationRegistryFactoryV2,
    //   );
    //   expect(await applicationRegistyV2.version()).to.equal("v2!");
    // });

    shouldBehaveLikeApplicationRegistry();
  });
});
