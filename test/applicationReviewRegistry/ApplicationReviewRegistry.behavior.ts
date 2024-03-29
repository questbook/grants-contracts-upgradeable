import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ApplicationReviewRegistry } from "../../src/types";
import { creatingWorkpsace, randomEthAddress, randomWallet } from "../utils";

export function shouldBehaveLikeApplicationReviewRegistry(): void {
  it("non deployer cannot set workspaceRegistry", async function () {
    await expect(this.applicationReviewRegistry.connect(this.signers.nonAdmin).setWorkspaceReg("dummyAddress")).to.be
      .reverted;
  });

  it("non deployer cannot set workspaceRegistry", async function () {
    await expect(this.applicationReviewRegistry.connect(this.signers.nonAdmin).setWorkspaceReg("dummyAddress")).to.be
      .reverted;
  });

  it("deployer can set workspaceRegistry", async function () {
    await this.applicationReviewRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);
    expect(await this.applicationReviewRegistry.workspaceReg()).to.equal(this.workspaceRegistry.address);
  });

  describe("Reviewer Assignment", function () {
    it("non admin should not be able to assign reviewer", async function () {
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.nonAdmin)
          .assignReviewers(0, 0, this.grant.address, [this.signers.nonAdmin.address], [true]),
      ).to.be.revertedWith("Unauthorised: Neither an admin nor a reviewer");
    });

    it("admin should be able to assign reviewer", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(
          0,
          [this.signers.reviewer.address, this.signers.nonAdmin.address],
          [1, 1],
          [true, true],
          ["", ""],
        );
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [true]);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.nonAdmin.address], [true]);
      const review = await this.applicationReviewRegistry.reviews(this.signers.reviewer.address, 0);
      expect(review[0]).to.equal(0);
      expect(review[3]).to.equal(this.grant.address);
      expect(review[4]).to.equal(this.signers.reviewer.address);
      const otherReview = await this.applicationReviewRegistry.reviews(this.signers.nonAdmin.address, 0);
      expect(otherReview[0]).to.equal(1);
    });

    it("admin of one workspace should not be able to assign reviewer to another workspace's grant's application", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      await creatingWorkpsace(this.workspaceRegistry.connect(this.signers.admin));
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.admin)
          .assignReviewers(1, 1, this.grant.address, [this.signers.reviewer.address], [true]),
      ).to.be.revertedWith("Unauthorized");
    });

    it("admin should be not able to unassign reviewer if review has been already submitted", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [true]);
      await this.applicationReviewRegistry
        .connect(this.signers.reviewer)
        .submitReview(0, 0, this.grant.address, "dummyIpfsHash");
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.admin)
          .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [false]),
      ).to.be.revertedWith("Review already submitted");
      const review = await this.applicationReviewRegistry.reviews(this.signers.reviewer.address, 0);
      expect(review[0]).to.equal(0);
      expect(review[3]).to.equal(this.grant.address);
      expect(review[4]).to.equal(this.signers.reviewer.address);
      expect(review[6]).to.equal(true);
    });

    it("admin should be able to unassign reviewer if review has not been submitted", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [true]);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [false]);
      const review = await this.applicationReviewRegistry.reviews(this.signers.reviewer.address, 0);
      expect(review[0]).to.equal(0);
      expect(review[3]).to.equal(this.grant.address);
      expect(review[4]).to.equal(this.signers.reviewer.address);
      expect(review[6]).to.equal(false);
    });
  });

  describe("Review Submission", function () {
    it("not assigned reviewer should not be able to review", async function () {
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.nonAdmin)
          .submitReview(0, 0, this.grant.address, "dummyIpfsHash"),
      ).to.be.revertedWith("Neither an admin nor a reviewer");
    });

    it("assigned reviewer should be able to review", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [true]);
      const tx = await this.applicationReviewRegistry
        .connect(this.signers.reviewer)
        .submitReview(0, 0, this.grant.address, "dummyIpfsHash");
      await tx.wait();
      const review = await this.applicationReviewRegistry.reviews(this.signers.reviewer.address, 0);
      expect(review[5]).to.equal("dummyIpfsHash");
    });

    it("review count should not be incrementated for the review re-submission", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [true]);
      let tx = await this.applicationReviewRegistry
        .connect(this.signers.reviewer)
        .submitReview(0, 0, this.grant.address, "dummyIpfsHash");
      await tx.wait();
      const grantReviewStateBefore = await this.applicationReviewRegistry.grantReviewStates(this.grant.address);
      tx = await this.applicationReviewRegistry
        .connect(this.signers.reviewer)
        .submitReview(0, 0, this.grant.address, "dummyIpfsHashResubmitted");
      await tx.wait();
      const grantReviewStateAfter = await this.applicationReviewRegistry.grantReviewStates(this.grant.address);
      const review = await this.applicationReviewRegistry.reviews(this.signers.reviewer.address, 0);
      expect(review[5]).to.equal("dummyIpfsHashResubmitted");
      expect(grantReviewStateBefore[2]).to.equal(grantReviewStateAfter[2]);
    });

    it("unassigned reviewer should not be able to review", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [true]);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [false]);
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.reviewer)
          .submitReview(0, 0, this.grant.address, "dummyIpfsHash"),
      ).to.be.revertedWith("Revoked access");
    });
  });
  describe("Rubrics", function () {
    it("non admin should not be able to set rubrics", async function () {
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.nonAdmin)
          .setRubrics(0, this.grant.address, "dummyIpfsHash"),
      ).to.be.revertedWith("Not an admin nor grantFactory");
    });

    it("workspace admin should be able to set rubrics", async function () {
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .setRubrics(0, this.grant.address, "dummyRubricsIpfsHash");
      const grantReviewState = await this.applicationReviewRegistry.grantReviewStates(this.grant.address);
      expect(grantReviewState[3]).to.equal("dummyRubricsIpfsHash");
    });

    // it("workspace admin should not be able to set rubrics when the number of review is non-zero", async function () {
    //   await this.workspaceRegistry
    //     .connect(this.signers.admin)
    //     .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
    //   await this.applicationReviewRegistry
    //     .connect(this.signers.admin)
    //     .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [true]);
    //   await this.applicationReviewRegistry
    //     .connect(this.signers.reviewer)
    //     .submitReview(this.signers.reviewer.address, 0, 0, this.grant.address, "dummyIpfsHash");
    //   await expect(
    //     this.applicationReviewRegistry
    //       .connect(this.signers.admin)
    //       .setRubrics(0, this.grant.address, 4, "dummyRubricsIpfsHash"),
    //   ).to.be.revertedWith("Reviews non-zero");
    // });

    it("admin of one workspace should not be able to set rubrics another workspace", async function () {
      await creatingWorkpsace(this.workspaceRegistry.connect(this.signers.admin));
      const grant = await upgrades.deployProxy(
        this.grantFactory,
        [
          0,
          "dummyGrantIpfsHash",
          this.applicationRegistry.address, // random address to avoid having to create a new workspace
          this.applicationRegistry.address,
          this.signers.admin.address,
          this.signers.admin.address,
        ],
        { kind: "uups" },
      );
      await expect(
        this.applicationReviewRegistry.connect(this.signers.admin).setRubrics(1, grant.address, "dummyRubricsIpfsHash"),
      ).to.be.revertedWith("Unauthorised");
    });
  });

  describe("Reviewer payments status", function () {
    it("non admin should not be able to change payment status", async function () {
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.nonAdmin)
          .markPaymentDone(
            0,
            [0],
            this.signers.reviewer.address,
            [0],
            this.myToken.address,
            100,
            "dummyTransactionHash",
          ),
      ).to.be.revertedWith("Not an admin");
    });

    it("length of review ids should match the application ids", async function () {
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.admin)
          .markPaymentDone(
            0,
            [0, 1],
            this.signers.reviewer.address,
            [0],
            this.myToken.address,
            100,
            "dummyTransactionHash",
          ),
      ).to.be.revertedWith("Parameters length mismatch");
    });

    it("admin of one workspace should not be able to change payment status of another workspace review", async function () {
      await creatingWorkpsace(this.workspaceRegistry.connect(this.signers.nonAdmin));
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.nonAdmin)
          .markPaymentDone(
            1,
            [0],
            this.signers.reviewer.address,
            [0],
            this.myToken.address,
            100,
            "dummyTransactionHash",
          ),
      ).to.be.revertedWith("Unauthorised");
    });

    it("admin should be able to change payment status of their workspace's review", async function () {
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .markPaymentDone(0, [0], this.signers.reviewer.address, [0], this.myToken.address, 100, "dummyTransactionHash");
      expect(await this.applicationReviewRegistry.reviewPaymentsStatus(0)).to.be.true;
    });
  });

  describe("Reviewer fulfill payment", function () {
    it("non admin should not be able to fulfill payment", async function () {
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.nonAdmin)
          .fulfillPayment(0, [0], this.signers.reviewer.address, [0], this.myToken.address, 100),
      ).to.be.revertedWith("Not an admin");
    });

    it("admin of one workspace should not be able to fulfill payment of another workspace review", async function () {
      await creatingWorkpsace(this.workspaceRegistry.connect(this.signers.nonAdmin));
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.nonAdmin)
          .fulfillPayment(1, [0], this.signers.reviewer.address, [0], this.myToken.address, 100),
      ).to.be.revertedWith("Unauthorised");
    });

    it("should not work if amount is not approved", async function () {
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect((await this.myToken.balanceOf(this.signers.reviewer.address)).toNumber()).to.equal(0);
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.admin)
          .fulfillPayment(0, [0], this.signers.reviewer.address, [0], this.myToken.address, 100),
      ).to.be.reverted;
      expect((await this.myToken.balanceOf(this.signers.reviewer.address)).toNumber()).to.equal(0);
      expect(await this.applicationReviewRegistry.reviewPaymentsStatus(0)).to.be.false;
    });

    it("should work if amount is approved", async function () {
      expect((await this.myToken.balanceOf(this.signers.admin.address)).toNumber()).to.equal(10000);
      expect((await this.myToken.balanceOf(this.signers.reviewer.address)).toNumber()).to.equal(0);
      await this.myToken.connect(this.signers.admin).approve(this.applicationReviewRegistry.address, 10000);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .fulfillPayment(0, [0], this.signers.reviewer.address, [0], this.myToken.address, 10000);
      expect((await this.myToken.balanceOf(this.signers.reviewer.address)).toNumber()).to.equal(10000);
      expect(await this.applicationReviewRegistry.reviewPaymentsStatus(0)).to.be.true;
    });
  });

  describe("Wallet Migration", function () {
    it("should migrate all reviews of a reviewer", async function () {
      const admin = this.signers.admin;
      const reviewers = await Promise.all([...Array(2)].map(randomWallet));
      const reviewRegistry = this.applicationReviewRegistry as ApplicationReviewRegistry;
      const migratedWalletAddress = randomEthAddress();

      await this.workspaceRegistry.connect(admin).updateWorkspaceMembers(
        0,
        reviewers.map(r => r.address),
        reviewers.map(() => 1),
        reviewers.map(() => true),
        reviewers.map(() => ""),
      );

      for (const reviewer of reviewers) {
        await reviewRegistry.connect(admin).assignReviewers(0, 0, this.grant.address, [reviewer.address], [true]);
      }
      // should migrate the first reviewer
      const tx = await this.applicationRegistry
        .connect(reviewers[0])
        .migrateWallet(reviewers[0].address, migratedWalletAddress);
      const result = await tx.wait();
      expect(result.events).to.have.length(1);

      // we've to parse the log since the log was emitted from another contract
      // namely the applicationReviewRegistry, whereas we called the function in applicationRegistry
      const parsed = reviewRegistry.interface.parseLog(result.events[0]);
      expect(parsed.name).to.eq("ReviewMigrate");
      expect(parsed.args._newReviewerAddress.toLowerCase()).to.eq(migratedWalletAddress);

      // check old review was deleted
      const oldReview = await reviewRegistry.reviews(reviewers[0].address, 0);
      expect(oldReview.active).to.eq(false);
      // check new review got added
      const migratedReview = await reviewRegistry.reviews(migratedWalletAddress, 0);
      expect(migratedReview.grant).to.eq(this.grant.address);
      expect(migratedReview.reviewer.toLowerCase()).to.eq(migratedWalletAddress);

      // let reviewerList = await Promise.all(reviewers.map((_, i) => reviewRegistry.reviewers(this.grant.address, i)));
      // reviewerList = reviewerList.map(r => r.toLowerCase());
      // expect(reviewerList).to.include(migratedWalletAddress);
      // expect(reviewerList).to.not.include(reviewers[0].address);
      // expect(reviewer1.toLowerCase()).to.eq(migratedWalletAddress)
      // all other reviews should be unaffected
      for (const reviewer of reviewers.slice(1)) {
        const otherReview = await this.applicationReviewRegistry.reviews(reviewer.address, 0);
        expect(+otherReview.id.toString()).to.be.greaterThan(0);
      }
    });
  });

  describe("Proxy implementation upgrade", function () {
    it("should not be able to call proxy initiliaze function", async function () {
      await expect(this.applicationReviewRegistry.initialize()).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });

    it("deployer can upgrade the applicationReviewRegistry proxy implementation contract", async function () {
      const applicationReviewRegistry = await upgrades.upgradeProxy(
        this.applicationReviewRegistry.address,
        this.applicationReviewRegistryFactoryV2,
      );
      expect(await applicationReviewRegistry.version()).to.equal("v2!");
    });

    it("non deployer cannot upgrade the applicationReviewRegistry proxy implementation contract", async function () {
      const applicationRegistryFactoryV2NonAdmin = await ethers.getContractFactory(
        "ApplicationReviewRegistryV2",
        this.signers.nonAdmin,
      );
      await expect(upgrades.upgradeProxy(this.applicationReviewRegistry.address, applicationRegistryFactoryV2NonAdmin))
        .to.be.reverted;
    });

    it("should retain applicationReviewRegistry data", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .assignReviewers(0, 0, this.grant.address, [this.signers.reviewer.address], [true]);
      const tx = await this.applicationReviewRegistry
        .connect(this.signers.reviewer)
        .submitReview(0, 0, this.grant.address, "dummyIpfsHash");
      await tx.wait();
      const review = await this.applicationReviewRegistry.reviews(this.signers.reviewer.address, 0);
      expect(review[5]).to.equal("dummyIpfsHash");
      const applicationReviewRegistry = await upgrades.upgradeProxy(
        this.applicationReviewRegistry.address,
        this.applicationReviewRegistryFactoryV2,
      );
      expect(await applicationReviewRegistry.version()).to.equal("v2!");
      expect(review[5]).to.equal("dummyIpfsHash");
    });
  });
}
