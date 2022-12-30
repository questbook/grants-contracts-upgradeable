import { expect } from "chai";
import { Wallet } from "ethers";
import { ethers, upgrades } from "hardhat";
import { ApplicationReviewRegistry } from "../../src/types";
import { areEqualDistributions, creatingWorkpsace, generateAssignment, randomEthAddress, randomWallet } from "../utils";

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
      ).to.be.revertedWith("Not an admin");
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
        .submitReview("0x4e35fF1872A720695a741B00f2fA4D1883440baC", 0, 0, this.grant.address, "dummyIpfsHash");
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

  describe("Auto assignment of Reviewers", function () {
    it("admin should be able to enable auto assigning of reviewers when one application is there", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      const numOfReviewersPerApplication = 2;
      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        numOfReviewersPerApplication,
      );

      const lastAssignedIndex = await this.applicationReviewRegistry.lastAssignedReviewerIndices(this.grant.address);
      const applicationAssignedTo1 = await this.applicationReviewRegistry.reviewerAssignmentCounts(
        this.grant.address,
        this.signers.autoAssignReviewers[0].address,
      );
      const applicationAssignedTo2 = await this.applicationReviewRegistry.reviewerAssignmentCounts(
        this.grant.address,
        this.signers.autoAssignReviewers[1].address,
      );
      expect(await this.applicationReviewRegistry.hasAutoAssigningEnabled(this.grant.address)).to.equals(true);
      expect(lastAssignedIndex).to.equals(numOfReviewersPerApplication % this.signers.autoAssignReviewers.length);
      expect(applicationAssignedTo1).to.equals(1);
      expect(applicationAssignedTo2).to.equals(1);
    });

    it("reviewer should be auto assigned once a new application is received to an existing grant", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      const numOfReviewersPerApplication = 4;
      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        numOfReviewersPerApplication,
      );

      await this.applicationRegistry
        .connect(this.signers.randomApplicants[0])
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");

      const distribution = generateAssignment(2, this.signers.autoAssignReviewers.length, numOfReviewersPerApplication);

      const distributionFromContract: number[] = [];
      for (const autoAssignReviewer of this.signers.autoAssignReviewers) {
        distributionFromContract.push(
          (
            await this.applicationReviewRegistry.reviewerAssignmentCounts(
              this.grant.address,
              autoAssignReviewer.address,
            )
          ).toNumber(),
        );
      }

      // console.log(distribution, distributionFromContract)
      const lastAssignedIndex = await this.applicationReviewRegistry.lastAssignedReviewerIndices(this.grant.address);
      expect(await this.applicationReviewRegistry.hasAutoAssigningEnabled(this.grant.address)).to.equals(true);
      expect(lastAssignedIndex).to.equals((numOfReviewersPerApplication * 2) % this.signers.autoAssignReviewers.length);
      expect(areEqualDistributions(distribution, distributionFromContract)).to.equals(true);
    });

    it("reviewer should be auto assigned to all existing applications", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const numOfReviewersPerApplication = 4;
      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        numOfReviewersPerApplication,
      );

      const distribution = generateAssignment(
        this.signers.randomApplicants.length + 1,
        this.signers.autoAssignReviewers.length,
        numOfReviewersPerApplication,
      );

      const distributionFromContract: number[] = [];
      for (const autoAssignReviewer of this.signers.autoAssignReviewers) {
        distributionFromContract.push(
          (
            await this.applicationReviewRegistry.reviewerAssignmentCounts(
              this.grant.address,
              autoAssignReviewer.address,
            )
          ).toNumber(),
        );
      }

      // console.log(distribution, distributionFromContract)
      const lastAssignedIndex = await this.applicationReviewRegistry.lastAssignedReviewerIndices(this.grant.address);
      expect(await this.applicationReviewRegistry.hasAutoAssigningEnabled(this.grant.address)).to.equals(true);
      expect(lastAssignedIndex).to.equals(
        (numOfReviewersPerApplication * (this.signers.randomApplicants.length + 1)) %
          this.signers.autoAssignReviewers.length,
      );
      expect(areEqualDistributions(distribution, distributionFromContract)).to.equals(true);
    });

    it("non admin cannot enable auto assignment", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const numOfReviewersPerApplication = 4;
      await expect(
        this.applicationReviewRegistry.connect(this.signers.nonAdmin).enableAutoAssignmentOfReviewers(
          0,
          this.grant.address,
          this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
          numOfReviewersPerApplication,
        ),
      ).to.be.revertedWith("Not an admin nor grantFactory");
    });

    it("auto assignment won't be enabled if not enough reviewers selected", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const numOfReviewersPerApplication = 4;
      await expect(
        this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
          0,
          this.grant.address,
          this.signers.autoAssignReviewers
            .slice(0, numOfReviewersPerApplication - 1)
            .map(autoAssignReviewer => autoAssignReviewer.address),
          numOfReviewersPerApplication,
        ),
      ).to.be.revertedWith("Not enough reviewers selected");
    });

    it("cannot enable auto assignment twice", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const numOfReviewersPerApplication = 4;

      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        numOfReviewersPerApplication,
      );

      await expect(
        this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
          0,
          this.grant.address,
          this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
          numOfReviewersPerApplication,
        ),
      ).to.be.revertedWith("Auto assignment already enabled");
    });

    it("auto assignment won't be enabled if num of reviewers per application is negative", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const numOfReviewersPerApplication = 0;
      await expect(
        this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
          0,
          this.grant.address,
          this.signers.autoAssignReviewers
            .slice(0, numOfReviewersPerApplication - 1)
            .map(autoAssignReviewer => autoAssignReviewer.address),
          numOfReviewersPerApplication,
        ),
      ).to.be.revertedWith("Reviewers per application must be positive");
    });

    it("auto assignment won't be enabled if the reviewers are not a reviewer in the workspace", async function () {
      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const numOfReviewersPerApplication = 4;

      await expect(
        this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
          0,
          this.grant.address,
          this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
          numOfReviewersPerApplication,
        ),
      ).to.be.revertedWith("Not a reviewer");
    });

    it("assign reviewers only to submitted applications", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 3, "rejectionIpfsHash");

      const numOfReviewersPerApplication = 4;
      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        numOfReviewersPerApplication,
      );

      const distribution = generateAssignment(
        this.signers.randomApplicants.length,
        this.signers.autoAssignReviewers.length,
        numOfReviewersPerApplication,
      );

      const distributionFromContract: number[] = [];
      for (const autoAssignReviewer of this.signers.autoAssignReviewers) {
        distributionFromContract.push(
          (
            await this.applicationReviewRegistry.reviewerAssignmentCounts(
              this.grant.address,
              autoAssignReviewer.address,
            )
          ).toNumber(),
        );
      }

      expect(distribution).eqls(distributionFromContract);
    });

    it("cannot update auto assignment config to a auto-assignment-disabled grant", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const numOfReviewersPerApplication = 4;
      await expect(
        this.applicationReviewRegistry.connect(this.signers.admin).updateAutoAssignmentOfReviewers(
          0,
          this.grant.address,
          this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
          numOfReviewersPerApplication,
          false,
        ),
      ).to.be.revertedWith("Auto assignment not enabled");
    });

    it("non admin cannot update auto assignment config", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const numOfReviewersPerApplication = 4;
      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        numOfReviewersPerApplication,
      );

      await expect(
        this.applicationReviewRegistry.connect(this.signers.nonAdmin).updateAutoAssignmentOfReviewers(
          0,
          this.grant.address,
          this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
          numOfReviewersPerApplication,
          false,
        ),
      ).to.be.revertedWith("Not an admin nor grantFactory");
    });

    it("admin should be able to update auto assignment config", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const oldNumOfReviewersPerApplication = 1;
      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers
          .slice(0, Math.floor(this.signers.autoAssignReviewers.length / 2))
          .map(autoAssignReviewer => autoAssignReviewer.address),
        oldNumOfReviewersPerApplication,
      );

      const oldGrantReviewState = await this.applicationReviewRegistry.grantReviewStates(this.grant.address);
      expect(oldGrantReviewState.numOfReviewersPerApplication).equal(oldNumOfReviewersPerApplication);

      const newNumOfReviewersPerApplication = 2;
      await this.applicationReviewRegistry.connect(this.signers.admin).updateAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers
          .slice(Math.floor(this.signers.autoAssignReviewers.length / 2))
          .map(autoAssignReviewer => autoAssignReviewer.address),
        newNumOfReviewersPerApplication,
        false,
      );

      const newGrantReviewState = await this.applicationReviewRegistry.grantReviewStates(this.grant.address);
      expect(newGrantReviewState.numOfReviewersPerApplication).equal(newNumOfReviewersPerApplication);
    });

    it("should not update auto assignment config", async function () {
      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        this.signers.autoAssignReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.autoAssignReviewers.map(() => 1),
        this.signers.autoAssignReviewers.map(() => true),
        this.signers.autoAssignReviewers.map(() => ""),
      );

      this.signers.randomApplicants.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const oldNumOfReviewersPerApplication = 1;
      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers
          .slice(0, Math.floor(this.signers.autoAssignReviewers.length / 2))
          .map(autoAssignReviewer => autoAssignReviewer.address),
        oldNumOfReviewersPerApplication,
      );

      const oldGrantReviewState = await this.applicationReviewRegistry.grantReviewStates(this.grant.address);
      expect(oldGrantReviewState.numOfReviewersPerApplication).equal(oldNumOfReviewersPerApplication);

      const newNumOfReviewersPerApplication = 2;
      await this.applicationReviewRegistry.connect(this.signers.admin).updateAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        this.signers.autoAssignReviewers
          .slice(Math.floor(this.signers.autoAssignReviewers.length / 2))
          .map(autoAssignReviewer => autoAssignReviewer.address),
        newNumOfReviewersPerApplication,
        true,
      );

      const newGrantReviewState = await this.applicationReviewRegistry.grantReviewStates(this.grant.address);
      expect(newGrantReviewState.numOfReviewersPerApplication).equal(oldNumOfReviewersPerApplication);
    });

    it("should assign updated reviewers to new applications", async function () {
      const oldReviewerCount = 10;
      const newReviewerCount = 20;

      const oldReviewers: Wallet[] = [];
      for (let i = 0; i < oldReviewerCount; ++i) {
        oldReviewers.push(await randomWallet());
      }
      const applicantList1 = this.signers.randomApplicants.slice(
        0,
        Math.floor(this.signers.randomApplicants.length / 2),
      );

      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        oldReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        oldReviewers.map(() => 1),
        oldReviewers.map(() => true),
        oldReviewers.map(() => ""),
      );

      applicantList1.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const numOfReviewersPerApplication = 4;
      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        oldReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        numOfReviewersPerApplication,
      );

      const oldDistributionFromContract1: number[] = [];
      for (const autoAssignReviewer of oldReviewers) {
        oldDistributionFromContract1.push(
          (
            await this.applicationReviewRegistry.reviewerAssignmentCounts(
              this.grant.address,
              autoAssignReviewer.address,
            )
          ).toNumber(),
        );
      }

      const newReviewers: Wallet[] = [];
      for (let i = 0; i < newReviewerCount; ++i) {
        newReviewers.push(await randomWallet());
      }
      const applicantList2 = this.signers.randomApplicants.slice(Math.floor(this.signers.randomApplicants.length / 2));

      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        newReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        newReviewers.map(() => 1),
        newReviewers.map(() => true),
        newReviewers.map(() => ""),
      );

      await this.applicationReviewRegistry.connect(this.signers.admin).updateAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        newReviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        numOfReviewersPerApplication,
        false,
      );

      applicantList2.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const oldDistributionFromContract2: number[] = [];
      for (const autoAssignReviewer of oldReviewers) {
        oldDistributionFromContract2.push(
          (
            await this.applicationReviewRegistry.reviewerAssignmentCounts(
              this.grant.address,
              autoAssignReviewer.address,
            )
          ).toNumber(),
        );
      }

      const newDistributionFromContract: number[] = [];
      for (const autoAssignReviewer of newReviewers) {
        newDistributionFromContract.push(
          (
            await this.applicationReviewRegistry.reviewerAssignmentCounts(
              this.grant.address,
              autoAssignReviewer.address,
            )
          ).toNumber(),
        );
      }

      const distribution = generateAssignment(applicantList2.length, newReviewerCount, numOfReviewersPerApplication);

      expect(oldDistributionFromContract1).eqls(oldDistributionFromContract2);
      expect(distribution).eqls(newDistributionFromContract);
    });

    it("should assign updated num of reviewers to new applications", async function () {
      const reviewerCount = 10;

      const reviewers: Wallet[] = [];
      for (let i = 0; i < reviewerCount; ++i) {
        reviewers.push(await randomWallet());
      }
      const applicantList1 = this.signers.randomApplicants.slice(
        0,
        Math.floor(this.signers.randomApplicants.length / 2),
      );

      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        reviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        reviewers.map(() => 1),
        reviewers.map(() => true),
        reviewers.map(() => ""),
      );

      applicantList1.map(async applicant => {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      });

      const oldNumOfReviewersPerApplication = 4;
      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        reviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        oldNumOfReviewersPerApplication,
      );

      const oldDistributionFromContract: number[] = [];
      for (const autoAssignReviewer of reviewers) {
        oldDistributionFromContract.push(
          (
            await this.applicationReviewRegistry.reviewerAssignmentCounts(
              this.grant.address,
              autoAssignReviewer.address,
            )
          ).toNumber(),
        );
      }
      const distribution1 = generateAssignment(
        applicantList1.length + 1,
        reviewerCount,
        oldNumOfReviewersPerApplication,
      );

      const applicantList2 = this.signers.randomApplicants.slice(Math.floor(this.signers.randomApplicants.length / 2));

      const newNumOfReviewersPerApplication = 5;
      await this.applicationReviewRegistry.connect(this.signers.admin).updateAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        reviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        newNumOfReviewersPerApplication,
        false,
      );

      for (const applicant of applicantList2) {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      }

      const newDistributionFromContract: number[] = [];
      for (const autoAssignReviewer of reviewers) {
        newDistributionFromContract.push(
          (
            await this.applicationReviewRegistry.reviewerAssignmentCounts(
              this.grant.address,
              autoAssignReviewer.address,
            )
          ).toNumber(),
        );
      }

      const distribution2 = generateAssignment(applicantList2.length, reviewerCount, newNumOfReviewersPerApplication);
      const sum: number[] = [];
      for (let i = 0; i < reviewerCount; ++i) sum.push(distribution1[i] + distribution2[i]);

      expect(sum).eqls(newDistributionFromContract);
    });

    it("should update both reviewers and number of applications", async function () {
      const reviewers = this.signers.autoAssignReviewers.splice(0, 3);

      await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        reviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        reviewers.map(() => 1),
        reviewers.map(() => true),
        reviewers.map(() => ""),
      );

      for (const applicant of this.signers.randomApplicants) {
        await this.applicationRegistry
          .connect(applicant)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      }

      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        reviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        2,
      );

      const newReviewers = [
        ...reviewers.map(autoAssignReviewer => autoAssignReviewer.address),
        this.signers.admin.address,
      ];
      const counts = await Promise.all(
        newReviewers.map(async reviewer =>
          this.applicationReviewRegistry.reviewerAssignmentCounts(this.grant.address, reviewer),
        ),
      );
      newReviewers.sort((a, b) => {
        return counts[newReviewers.indexOf(a)] - counts[newReviewers.indexOf(b)];
      });
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .updateAutoAssignmentOfReviewers(0, this.grant.address, newReviewers, 1, false);
    });

    it("cannot disable auto assignment to a grant where it is not enabled", async function () {
      await expect(
        this.applicationReviewRegistry.connect(this.signers.admin).disableAutoAssignment(0, this.grant.address),
      ).revertedWith("Auto assignment not enabled");
    });

    it("only admin can disable auto assignment", async function () {
      await expect(
        this.applicationReviewRegistry.connect(this.signers.nonAdmin).disableAutoAssignment(0, this.grant.address),
      ).revertedWith("Not an admin nor grantFactory");
    });

    it("stress test - reviewer assignment", async function () {
      const numOfReviewers = 10;
      const numOfApplicants = 300;
      const numOfReviewersPerApplication = 5;

      const reviewers: Wallet[] = [];
      for (let i = 0; i < numOfReviewers; ++i) reviewers.push(await randomWallet());

      const applicants: Wallet[] = [];
      for (let i = 0; i < numOfApplicants; ++i) {
        applicants.push(await randomWallet());
      }

      this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMembers(
        0,
        reviewers.map(r => r.address),
        Array(numOfReviewers).fill(1),
        Array(numOfReviewers).fill(true),
        Array(numOfReviewers).fill(""),
      );

      for (let i = 0; i < numOfApplicants; ++i) {
        await this.applicationRegistry
          .connect(applicants[i])
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", "1");
      }

      await this.applicationReviewRegistry.connect(this.signers.admin).enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        reviewers.map(r => r.address),
        numOfReviewersPerApplication,
      );
    });
  });

  describe("Review Submission", function () {
    it("not assigned reviewer should not be able to review", async function () {
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.nonAdmin)
          .submitReview(this.signers.nonAdmin.address, 0, 0, this.grant.address, "dummyIpfsHash"),
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
        .submitReview(this.signers.reviewer.address, 0, 0, this.grant.address, "dummyIpfsHash");
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
        .submitReview(this.signers.reviewer.address, 0, 0, this.grant.address, "dummyIpfsHash");
      await tx.wait();
      const grantReviewStateBefore = await this.applicationReviewRegistry.grantReviewStates(this.grant.address);
      tx = await this.applicationReviewRegistry
        .connect(this.signers.reviewer)
        .submitReview(this.signers.reviewer.address, 0, 0, this.grant.address, "dummyIpfsHashResubmitted");
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
          .submitReview(this.signers.reviewer.address, 0, 0, this.grant.address, "dummyIpfsHash"),
      ).to.be.revertedWith("Revoked access");
    });
  });
  describe("Rubrics", function () {
    it("non admin should not be able to set rubrics", async function () {
      await expect(
        this.applicationReviewRegistry
          .connect(this.signers.nonAdmin)
          .setRubrics(0, this.grant.address, 4, "dummyIpfsHash"),
      ).to.be.revertedWith("Not an admin nor grantFactory");
    });

    it("workspace admin should be able to set rubrics", async function () {
      await this.applicationReviewRegistry
        .connect(this.signers.admin)
        .setRubrics(0, this.grant.address, 4, "dummyRubricsIpfsHash");
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
        this.applicationReviewRegistry
          .connect(this.signers.admin)
          .setRubrics(1, grant.address, 4, "dummyRubricsIpfsHash"),
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

      // auto assign enabled to verify migration there happens correctly as well
      const tx0 = await reviewRegistry.enableAutoAssignmentOfReviewers(
        0,
        this.grant.address,
        reviewers.map(r => r.address),
        1,
      );
      await tx0.wait();

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

      let reviewerList = await Promise.all(reviewers.map((_, i) => reviewRegistry.reviewers(this.grant.address, i)));
      reviewerList = reviewerList.map(r => r.toLowerCase());
      expect(reviewerList).to.include(migratedWalletAddress);
      expect(reviewerList).to.not.include(reviewers[0].address);
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
        .submitReview(this.signers.reviewer.address, 0, 0, this.grant.address, "dummyIpfsHash");
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
