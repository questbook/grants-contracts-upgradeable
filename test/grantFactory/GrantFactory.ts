import { ethers, upgrades } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { GrantFactory } from "../../src/types/GrantFactory";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";

import { Signers } from "../types";
import { shouldBehaveLikeGrantFactory } from "./GrantFactory.behavior";
import { expect } from "chai";
import { ApplicationReviewRegistry } from "../../src/types/ApplicationReviewRegistry";

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.nonAdmin = signers[1];
    this.signers.reviewer = signers[2];
    this.signers.otherAdmin = signers[3];
  });

  describe("GrantFactory", function () {
    beforeEach(async function () {
      this.workspaceRegistryFactory = await ethers.getContractFactory("WorkspaceRegistry");
      this.workspaceRegistry = <WorkspaceRegistry>(
        await upgrades.deployProxy(this.workspaceRegistryFactory, { kind: "uups" })
      );

      await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");

      this.applicationReviewRegistryFactory = await ethers.getContractFactory("ApplicationReviewRegistry");
      this.applicationReviewRegistry = <ApplicationReviewRegistry>(
        await upgrades.deployProxy(this.applicationReviewRegistryFactory, { kind: "uups" })
      );

      await this.applicationReviewRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);

      this.grantFactoryFactory = await ethers.getContractFactory("GrantFactory");
      this.grantFactory = <GrantFactory>await upgrades.deployProxy(this.grantFactoryFactory, { kind: "uups" });

      await this.grantFactory
        .connect(this.signers.admin)
        .setApplicationReviewReg(this.applicationReviewRegistry.address);

      await this.applicationReviewRegistry.connect(this.signers.admin).setGrantFactory(this.grantFactory.address);

      const applicationRegistryFactory = await ethers.getContractFactory("ApplicationRegistry");
      this.applicationRegistry = <ApplicationRegistry>(
        await upgrades.deployProxy(applicationRegistryFactory, { kind: "uups" })
      );
      this.grantFactoryV1 = await ethers.getContractFactory("Grant");
      this.grantFactoryV2 = await ethers.getContractFactory("GrantV2");
      this.grantFactoryFactoryV2 = await ethers.getContractFactory("GrantFactoryV2");
    });

    it("test proxy deployment", async function () {
      const grantFactoryv2 = await upgrades.upgradeProxy(this.grantFactory.address, this.grantFactoryFactoryV2);
      expect(await grantFactoryv2.version()).to.equal("v2!");
    });

    shouldBehaveLikeGrantFactory();
  });
});
