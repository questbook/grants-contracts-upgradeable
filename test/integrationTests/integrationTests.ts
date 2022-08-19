import { artifacts, ethers, upgrades, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";

import type { Grant } from "../../src/types/Grant";
import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { Signers } from "../types";
import { creatingWorkpsace } from "../utils";

describe("Integration tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.nonAdmin = signers[1];
    this.signers.applicantAdmin = signers[2];
    this.signers.erc20 = signers[3];
    this.signers.reviewer = signers[4];
  });

  beforeEach(async function () {
    this.workspaceRegistryFactory = await ethers.getContractFactory("WorkspaceRegistry");
    this.workspaceRegistry = <WorkspaceRegistry>(
      await upgrades.deployProxy(this.workspaceRegistryFactory, { kind: "uups" })
    );

    await creatingWorkpsace(this.workspaceRegistry.connect(this.signers.admin));

    const applicationRegistryFactory = await ethers.getContractFactory("ApplicationRegistry");
    this.applicationRegistry = <ApplicationRegistry>(
      await upgrades.deployProxy(applicationRegistryFactory, { kind: "uups" })
    );

    this.applicationReviewRegistryFactory = await ethers.getContractFactory("ApplicationReviewRegistry");
    this.applicationReviewRegistry = <ApplicationRegistry>(
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
        ],
        { kind: "uups" },
      )
    );
    this.grantFactoryV2 = await ethers.getContractFactory("GrantV2");

    await this.applicationRegistry
      .connect(this.signers.applicantAdmin)
      .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
    await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 2, "reasonIpfsHash");

    const erc20Artifact: Artifact = await artifacts.readArtifact("MyToken");
    this.myToken = await waffle.deployContract(this.signers.erc20, erc20Artifact, []);

    // transfer 10000 tokens to admin
    await this.myToken.connect(this.signers.erc20).mint(this.signers.admin.address, 10000);
  });

  describe("Withdraw funds", function () {
    it("Should not work if invoker is non admin", async function () {
      expect(
        this.grant
          .connect(this.signers.nonAdmin)
          .withdrawFunds(this.myToken.address, 1000, this.signers.nonAdmin.address),
      ).to.be.revertedWith("Unauthorised: Not an admin");
    });

    it("Should not work if invoker is reviewer", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      expect(await this.workspaceRegistry.isWorkspaceAdminOrReviewer(0, this.signers.reviewer.address)).to.equal(true);
      expect(
        this.grant
          .connect(this.signers.reviewer)
          .withdrawFunds(this.myToken.address, 1000, this.signers.reviewer.address),
      ).to.be.revertedWith("Unauthorised: Not an admin");
    });

    it("Should not work if grant does not have balance", async function () {
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(0);
      expect(
        this.grant.connect(this.signers.admin).withdrawFunds(this.myToken.address, 1000, this.signers.admin.address),
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should work if grant has balance and invoked by workspace admin", async function () {
      await this.myToken.connect(this.signers.admin).transfer(this.grant.address, 1000);
      await this.grant
        .connect(this.signers.admin)
        .withdrawFunds(this.myToken.address, 1000, this.signers.admin.address);
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(0);
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
    });

    it("Should not work if grant has balance but invoked by workspace reviewer", async function () {
      await this.myToken.connect(this.signers.admin).transfer(this.grant.address, 1000);
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      expect(await this.workspaceRegistry.isWorkspaceAdminOrReviewer(0, this.signers.reviewer.address)).to.equal(true);
      expect(
        this.grant
          .connect(this.signers.reviewer)
          .withdrawFunds(this.myToken.address, 1000, this.signers.reviewer.address),
      ).to.be.revertedWith("Unauthorised: Not an admin");
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(1000);
      expect((await this.myToken.balanceOf(this.signers.reviewer.address)).toNumber()).to.equal(0);
    });
  });

  describe("Withdraw rewards from locked funds", function () {
    it("Should not work invoked by non admin", async function () {
      await this.myToken.connect(this.signers.erc20).mint(this.grant.address, 10000);
      expect(
        this.grant.connect(this.signers.nonAdmin).disburseReward(0, 0, this.myToken.address, 1000),
      ).to.be.revertedWith("Unauthorised: Not an admin");
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(10000);
    });

    it("Should not work if no balance on grant contract", async function () {
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(0);
      expect(this.grant.connect(this.signers.admin).disburseReward(0, 0, this.myToken.address, 20000)).to.be.reverted;
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(0);
    });

    it("Should not work if balance present in grant contract but invoked by workspace admin", async function () {
      await this.myToken.connect(this.signers.erc20).mint(this.grant.address, 10000);
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      expect(await this.workspaceRegistry.isWorkspaceAdminOrReviewer(0, this.signers.reviewer.address)).to.equal(true);
      expect(
        this.grant.connect(this.signers.reviewer).disburseReward(0, 0, this.myToken.address, 1000),
      ).to.be.revertedWith("Unauthorised: Not an admin");
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(10000);
    });

    it("Should work if balance present in grant contract", async function () {
      await this.myToken.connect(this.signers.erc20).mint(this.grant.address, 10000);
      await this.grant.connect(this.signers.admin).disburseReward(0, 0, this.myToken.address, 1000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(1000);
      expect((await this.myToken.balanceOf(this.grant.address)).toNumber()).to.equal(9000);
    });
  });

  describe("Withdraw rewards using P2P transfer", function () {
    it("Should not work if amount is not approved", async function () {
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
      expect(
        this.workspaceRegistry
          .connect(this.signers.admin)
          .disburseRewardP2P(0, "0x0000000000000000000000000000000000000000", 0, this.myToken.address, 10000, 0),
      ).to.be.revertedWith("ERC20: insufficient allowance");
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
    });

    it("Should not work if no balance in user wallet", async function () {
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect(
        this.workspaceRegistry
          .connect(this.signers.admin)
          .disburseRewardP2P(0, "0x0000000000000000000000000000000000000000", 0, this.myToken.address, 20000, 0),
      ).to.be.reverted;
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
    });

    it("Should not work if invoked by reviewer", async function () {
      await this.myToken.connect(this.signers.erc20).mint(this.signers.reviewer.address, 10000);
      expect((await this.myToken.balanceOf(this.signers.reviewer.address)).toNumber()).to.equal(10000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
      await this.myToken.connect(this.signers.reviewer).approve(this.grant.address, 10000);
      expect(
        this.workspaceRegistry
          .connect(this.signers.reviewer)
          .disburseRewardP2P(0, "0x0000000000000000000000000000000000000000", 0, this.myToken.address, 1000, 0),
      ).to.be.revertedWith("Unauthorised: Not an admin");
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
      expect((await this.myToken.balanceOf(this.signers.reviewer.address)).toNumber()).to.equal(10000);
    });

    it("Should work if balance present in wallet and amount is approved", async function () {
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(0);
      await this.myToken.connect(this.signers.admin).approve(this.grant.address, 10000);
      await this.grant
        .connect(this.signers.admin)
        .disburseRewardP2P(0, "0x0000000000000000000000000000000000000000", 0, this.myToken.address, 1000);
      expect((await this.myToken.balanceOf(this.signers.applicantAdmin.address)).toNumber()).to.equal(1000);
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(9000);
    });
  });

  describe("Proxy implementation upgrade", function () {
    it("should retain and withdraw funds", async function () {
      await this.myToken.connect(this.signers.admin).transfer(this.grant.address, 1000);
      const grant = await upgrades.upgradeProxy(this.grant.address, this.grantFactoryV2);
      expect(await grant.version()).to.equal("v2!");
      await grant.connect(this.signers.admin).withdrawFunds(this.myToken.address, 1000, this.signers.admin.address);
      expect((await this.myToken.balanceOf(grant.address)).toNumber()).to.equal(0);
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
    });
  });
});
