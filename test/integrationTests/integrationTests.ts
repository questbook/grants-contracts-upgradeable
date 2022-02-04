import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";

import type { Grant } from "../../src/types/Grant";
import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { Signers } from "../types";

describe("Integration tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.nonAdmin = signers[1];
    this.signers.applicantAdmin = signers[2];
    this.signers.erc20 = signers[3];
  });

  beforeEach(async function () {
    const workspaceRegistryArtifact: Artifact = await artifacts.readArtifact("WorkspaceRegistry");
    this.workspaceRegistry = <WorkspaceRegistry>(
      await waffle.deployContract(this.signers.admin, workspaceRegistryArtifact, [])
    );

    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyWorkspaceIpfsHash");

    const applicationRegistryArtifact: Artifact = await artifacts.readArtifact("ApplicationRegistry");
    this.applicationRegistry = <ApplicationRegistry>(
      await waffle.deployContract(this.signers.admin, applicationRegistryArtifact, [])
    );

    await this.applicationRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);

    const grantArtifact: Artifact = await artifacts.readArtifact("Grant");
    this.grant = <Grant>(
      await waffle.deployContract(this.signers.admin, grantArtifact, [
        0,
        "dummyGrantIpfsHash",
        this.workspaceRegistry.address,
        this.applicationRegistry.address,
      ])
    );

    await this.applicationRegistry
      .connect(this.signers.applicantAdmin)
      .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
    await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 2, "reasonIpfsHash");

    const erc20Artifact: Artifact = await artifacts.readArtifact("MyToken");
    this.myToken = await waffle.deployContract(this.signers.erc20, erc20Artifact, []);

    // transfer 10000 tokens to admin
    await this.myToken.connect(this.signers.erc20).mint(this.signers.admin.address, 10000);
  });

  describe("Deposit funds", function () {
    it("Should not work if amount is not approved", async function () {
      expect(this.grant.connect(this.signers.admin).depositFunds(this.myToken.address, 1000)).to.be.reverted;
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(0);
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
    });

    it("Should work if amount is approved", async function () {
      await this.myToken.connect(this.signers.admin).approve(this.grant.address, 1000);
      await this.grant.connect(this.signers.admin).depositFunds(this.myToken.address, 1000);
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(1000);
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(9000);
    });
  });

  describe("Withdraw rewards from locked funds", function () {
    it("Should not work if no balance on grant contract", async function () {
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(0);
      expect(
        this.applicationRegistry
          .connect(this.signers.admin)
          .approveMilestone(0, 0, "reasonIpfsHash", 0, this.myToken.address, 20000),
      ).to.be.reverted;
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(0);
    });

    it("Should work if balance present in grant contract", async function () {
      await this.myToken.connect(this.signers.erc20).mint(this.grant.address, 10000);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .approveMilestone(0, 0, "reasonIpfsHash", 0, this.myToken.address, 1000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(1000);
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(9000);
    });
  });

  describe("Withdraw rewards using P2P transfer", function () {
    it("Should not work if amount is not approved", async function () {
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
      expect(
        this.applicationRegistry
          .connect(this.signers.admin)
          .approveMilestone(0, 0, "reasonIpfsHash", 0, this.myToken.address, 20000),
      ).to.be.reverted;
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
    });

    it("Should not work if no balance in user wallet", async function () {
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect(
        this.applicationRegistry
          .connect(this.signers.admin)
          .approveMilestone(0, 0, "reasonIpfsHash", 0, this.myToken.address, 20000),
      ).to.be.reverted;
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
    });

    it("Should work if balance present in wallet and amount is approved", async function () {
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
      await this.myToken.connect(this.signers.admin).approve(this.grant.address, 10000);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .approveMilestone(0, 0, "reasonIpfsHash", 1, this.myToken.address, 1000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(1000);
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(9000);
    });
  });
});
