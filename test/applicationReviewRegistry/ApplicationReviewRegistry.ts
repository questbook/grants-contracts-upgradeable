import { artifacts, ethers, upgrades, waffle } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import type { ApplicationReviewRegistry } from "../../src/types/ApplicationReviewRegistry";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import type { Grant } from "../../src/types/Grant";
import { Signers } from "../types";
import { shouldBehaveLikeApplicationReviewRegistry } from "./ApplicationReviewRegistry.behavior";
import { expect } from "chai";
import { GrantFactory } from "../../src/types/GrantFactory";
import { Artifact } from "hardhat/types";
import { creatingWorkpsace } from "../utils";

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.nonAdmin = signers[1];
    this.signers.applicantAdmin = signers[2];
    this.signers.reviewer = signers[3];
    this.signers.erc20 = signers[4];
    this.signers.autoAssignReviewers = signers.slice(5, 10);
    this.signers.randomApplicants = signers.slice(11);
  });

  describe("ApplicationReviewRegistry", function () {
    beforeEach(async function () {
      this.workspaceRegistryFactory = await ethers.getContractFactory("WorkspaceRegistry");
      this.workspaceRegistry = <WorkspaceRegistry>(
        await upgrades.deployProxy(this.workspaceRegistryFactory, { kind: "uups" })
      );

      await creatingWorkpsace(this.workspaceRegistry.connect(this.signers.admin));

      this.applicationRegistryFactory = await ethers.getContractFactory("ApplicationRegistry");
      this.applicationRegistry = <ApplicationRegistry>(
        await upgrades.deployProxy(this.applicationRegistryFactory, { kind: "uups" })
      );

      this.applicationReviewRegistryFactory = await ethers.getContractFactory("ApplicationReviewRegistry");
      this.applicationReviewRegistry = <ApplicationReviewRegistry>(
        await upgrades.deployProxy(this.applicationReviewRegistryFactory, { kind: "uups" })
      );

      await this.applicationRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .setApplicationReviewReg(this.applicationReviewRegistry.address);

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

      await this.applicationRegistry
        .connect(this.signers.nonAdmin)
        .submitApplication(
          this.grant.address,
          0,
          "dummyApplicationIpfsHash",
          "1",
          this.signers.nonAdmin.address.toString(),
        );

      this.grantFactoryFactory = await ethers.getContractFactory("GrantFactory");
      this.grantFactoryContract = <GrantFactory>await upgrades.deployProxy(this.grantFactoryFactory, { kind: "uups" });

      await this.applicationReviewRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .setApplicationReg(this.applicationRegistry.address);
      await this.grantFactoryContract
        .connect(this.signers.admin)
        .setApplicationReviewReg(this.applicationReviewRegistry.address);

      this.applicationReviewRegistryFactoryV2 = await ethers.getContractFactory("ApplicationReviewRegistryV2");

      const erc20Artifact: Artifact = await artifacts.readArtifact("MyToken");
      this.myToken = await waffle.deployContract(this.signers.erc20, erc20Artifact, []);

      // transfer 10000 tokens to admin
      await this.myToken.connect(this.signers.erc20).mint(this.signers.admin.address, 10000);
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
