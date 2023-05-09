import { ethers, upgrades } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import type { Grant } from "../../src/types/Grant";
import { Signers } from "../types";
import { shouldBehaveLikeApplicationRegistry } from "./ApplicationRegistry.behavior";
import { expect } from "chai";
import { creatingWorkpsace } from "../utils";
import { UtilityRegistry } from "../../src/types";

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
      this.utilityRegistryFactory = await ethers.getContractFactory("UtilityRegistry");
      this.utilityRegistry = <UtilityRegistry>await upgrades.deployProxy(this.utilityRegistryFactory, { kind: "uups" });

      this.workspaceRegistryFactory = await ethers.getContractFactory("WorkspaceRegistry");
      this.workspaceRegistry = <WorkspaceRegistry>(
        await upgrades.deployProxy(this.workspaceRegistryFactory, { kind: "uups" })
      );
      await this.workspaceRegistry.connect(this.signers.admin).setUtilityRegistry(this.utilityRegistry.address);

      await creatingWorkpsace(this.workspaceRegistry.connect(this.signers.admin));

      this.applicationRegistryFactory = await ethers.getContractFactory("ApplicationRegistry");
      this.applicationRegistry = <ApplicationRegistry>(
        await upgrades.deployProxy(this.applicationRegistryFactory, { kind: "uups" })
      );

      this.applicationReviewRegistryFactory = await ethers.getContractFactory("ApplicationReviewRegistry");
      this.applicationReviewRegistry = <ApplicationRegistry>(
        await upgrades.deployProxy(this.applicationReviewRegistryFactory, { kind: "uups" })
      );
      await this.applicationReviewRegistry.setApplicationReg(this.applicationRegistry.address);

      await this.applicationRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .setApplicationReviewReg(this.applicationReviewRegistry.address);
      await this.applicationRegistry.connect(this.signers.admin).setUtilityRegistry(this.utilityRegistry.address);

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
            this.signers.admin.address,
          ],
          { kind: "uups" },
        )
      );

      this.applicationRegistryFactoryV2 = await ethers.getContractFactory("ApplicationRegistryV2");
    });

    it("test proxy deployment", async function () {
      const applicationRegistyV2 = await upgrades.upgradeProxy(
        this.applicationRegistry.address,
        this.applicationRegistryFactoryV2,
      );
      expect(await applicationRegistyV2.version()).to.equal("v2!");
    });

    shouldBehaveLikeApplicationRegistry();
  });
});
