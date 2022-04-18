import { ethers, upgrades } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import type { ApplicationReviewRegistry } from "../../src/types/ApplicationReviewRegistry";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import type { Grant } from "../../src/types/Grant";
import { Signers } from "../types";
import { shouldBehaveLikeApplicationReviewRegistry } from "./ApplicationReviewRegistry.behavior";
import { expect } from "chai";
import { GrantFactory } from "../../src/types/GrantFactory";

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
    beforeEach(async function () {
      this.workspaceRegistryFactory = await ethers.getContractFactory("WorkspaceRegistry");
      this.workspaceRegistry = <WorkspaceRegistry>(
        await upgrades.deployProxy(this.workspaceRegistryFactory, { kind: "uups" })
      );

      await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyWorkspaceIpfsHash");

      this.applicationRegistryFactory = await ethers.getContractFactory("ApplicationRegistry");
      this.applicationRegistry = <ApplicationRegistry>(
        await upgrades.deployProxy(this.applicationRegistryFactory, { kind: "uups" })
      );

      await this.applicationRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);

      this.grantFactory = await ethers.getContractFactory("Grant");
      this.grant = <Grant>(
        await upgrades.deployProxy(
          this.grantFactory,
          [
            0,
            "dummyGrantIpfsHash",
            this.workspaceRegistry.address,
            this.applicationRegistry.address,
            this.signers.admin.address,
          ],
          { kind: "uups" },
        )
      );

      await this.applicationRegistry
        .connect(this.signers.nonAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");

      this.grantFactoryFactory = await ethers.getContractFactory("GrantFactory");
      this.grantFactoryContract = <GrantFactory>await upgrades.deployProxy(this.grantFactoryFactory, { kind: "uups" });

      this.applicationReviewRegistryFactory = await ethers.getContractFactory("ApplicationReviewRegistry");
      this.applicationReviewRegistry = <ApplicationReviewRegistry>(
        await upgrades.deployProxy(this.applicationReviewRegistryFactory, { kind: "uups" })
      );

      await this.applicationReviewRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .setApplicationReg(this.applicationRegistry.address);
      await this.grantFactoryContract
        .connect(this.signers.admin)
        .setApplicationReviewReg(this.applicationReviewRegistry.address);

      this.applicationReviewRegistryFactoryV2 = await ethers.getContractFactory("ApplicationReviewRegistryV2");
    });

    it("test proxy deployment", async function () {
      const applicationReviewRegistyV2 = await upgrades.upgradeProxy(
        this.applicationReviewRegistry.address,
        this.applicationReviewRegistryFactoryV2,
      );
      expect(await applicationReviewRegistyV2.version()).to.equal("v2!");
    });

    shouldBehaveLikeApplicationReviewRegistry();
  });
});
