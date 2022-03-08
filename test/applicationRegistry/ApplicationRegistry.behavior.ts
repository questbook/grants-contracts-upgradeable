import { expect } from "chai";

export function shouldBehaveLikeApplicationRegistry(): void {
  it("deployer can pause the contract", async function () {
    await this.applicationRegistry.connect(this.signers.admin).pause();
    expect(await this.applicationRegistry.paused()).to.equal(true);
  });

  it("non deployer can not pause the contract", async function () {
    expect(this.applicationRegistry.connect(this.signers.nonAdmin).pause()).to.be.reverted;
  });

  it("deployer can unpause the contract", async function () {
    await this.applicationRegistry.connect(this.signers.admin).pause();
    expect(await this.applicationRegistry.paused()).to.equal(true);
    await this.applicationRegistry.connect(this.signers.admin).unpause();
    expect(await this.applicationRegistry.paused()).to.equal(false);
  });

  it("non deployer can not unpause the contract", async function () {
    await this.applicationRegistry.connect(this.signers.admin).pause();
    expect(await this.applicationRegistry.paused()).to.equal(true);
    expect(this.applicationRegistry.connect(this.signers.nonAdmin).unpause()).to.be.reverted;
  });

  it("non deployer cannot set workspaceRegistry", async function () {
    expect(this.applicationRegistry.connect(this.signers.nonAdmin).setWorkspaceReg("dummyAddress")).to.be.reverted;
  });

  it("non deployer cannot set workspaceRegistry", async function () {
    expect(this.applicationRegistry.connect(this.signers.nonAdmin).setWorkspaceReg("dummyAddress")).to.be.reverted;
  });

  it("deployer can set workspaceRegistry", async function () {
    await this.applicationRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);
    expect(await this.applicationRegistry.workspaceReg()).to.equal(this.workspaceRegistry.address);
  });

  it("active grant can receive application", async function () {
    expect(await this.applicationRegistry.applicationCount()).to.equal(0);
    await this.applicationRegistry
      .connect(this.signers.applicantAdmin)
      .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
    expect(await this.applicationRegistry.applicationCount()).to.equal(1);
  });

  it("applicant cannot submit application to same grant twice", async function () {
    expect(await this.applicationRegistry.applicationCount()).to.equal(0);
    await this.applicationRegistry
      .connect(this.signers.applicantAdmin)
      .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
    expect(
      this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1),
    ).to.be.reverted;
    expect(await this.applicationRegistry.applicationCount()).to.equal(1);
  });

  it("inactive grant can not receive application", async function () {
    expect(await this.applicationRegistry.applicationCount()).to.equal(0);
    await this.grant.connect(this.signers.admin).updateGrantAccessibility(false);
    expect(
      this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1),
    ).to.be.reverted;
    expect(await this.applicationRegistry.applicationCount()).to.equal(0);
  });

  describe("If contract is paused", function () {
    beforeEach(async function () {
      await this.applicationRegistry.connect(this.signers.admin).pause();
    });

    it("Applicaion submission wont work", async function () {
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Applicaion updation wont work", async function () {
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Applicaion state updation wont work", async function () {
      expect(
        this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 1, "reasonIpfsHash"),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Milestone request for approval wont work", async function () {
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .requestMilestoneApproval(0, 3, "dummyApplicationIpfsHash"),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Milestone approval wont work", async function () {
      expect(
        this.applicationRegistry.connect(this.signers.admin).approveMilestone(0, 0, 0, "dummyApplicationIpfsHash"),
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Application state change", function () {
    it("grant manager can ask for application resubmission if application is in submitted state", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 1, "reasonIpfsHash");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(1);
    });

    it("grant manager can approve application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 2, "reasonIpfsHash");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(2);
    });

    it("grant manager can reject application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 3, "reasonIpfsHash");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(3);
    });

    it("grant manager can not reject applications in resubmit state", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 1, "reasonIpfsHash");
      expect(this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 1, "reasonIpfsHash")).to
        .be.reverted;
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(1);
    });

    it("application owner can not approve application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(
        this.applicationRegistry.connect(this.signers.applicantAdmin).updateApplicationState(0, 0, 2, "reasonIpfsHash"),
      ).to.be.reverted;
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(0);
    });

    it("application owner can not reject application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(
        this.applicationRegistry.connect(this.signers.applicantAdmin).updateApplicationState(0, 0, 3, "reasonIpfsHash"),
      ).to.be.reverted;
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(0);
    });

    it("application state cannot be updated if wrong workspace id is passed", async function () {
      await this.workspaceRegistry.connect(this.signers.nonAdmin).createWorkspace("dummyWorkspaceIpfsHash");
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(
        this.applicationRegistry.connect(this.signers.nonAdmin).updateApplicationState(0, 1, 3, "reasonIpfsHash"),
      ).to.be.revertedWith("ApplicationStateUpdate: Invalid workspace");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(0);
    });

    it("application owner can resubmit application with updated metadata if grant manager has asked for resubmission", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 1, "reasonIpfsHash");
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1);
      const application = await this.applicationRegistry.applications(0);
      expect(application.metadataHash).to.equal("updatedApplicationIpfsHash");
      expect(application.state).to.equal(0);
    });

    it("non owner can not resubmit application if grant manager has asked for resubmission", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 1, "reasonIpfsHash");
      const application = await this.applicationRegistry.applications(0);
      expect(application.metadataHash).to.equal("dummyApplicationIpfsHash");
      expect(application.state).to.equal(1);
      expect(
        this.applicationRegistry
          .connect(this.signers.nonAdmin)
          .updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1),
      ).to.be.reverted;
    });

    it("application owner can not resubmit application if application is in submitted state", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1),
      ).to.be.reverted;
      const application = await this.applicationRegistry.applications(0);
      expect(application.metadataHash).to.equal("dummyApplicationIpfsHash");
      expect(application.state).to.equal(0);
    });

    it("application owner can not resubmit application if application is approved by grant manager", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 2, "reasonIpfsHash");
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1),
      ).to.be.reverted;
      const application = await this.applicationRegistry.applications(0);
      expect(application.metadataHash).to.equal("dummyApplicationIpfsHash");
      expect(application.state).to.equal(2);
    });

    it("application owner can not resubmit application with updated metadata if grant manager has rejected the application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 3, "reasonIpfsHash");
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1),
      ).to.be.reverted;
      const application = await this.applicationRegistry.applications(0);
      expect(application.metadataHash).to.equal("dummyApplicationIpfsHash");
      expect(application.state).to.equal(3);
    });

    it("workspace admin can mark application as complete if all milestones are approved", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 2);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 2, "reasonIpfsHash");
      await this.applicationRegistry.connect(this.signers.admin).approveMilestone(0, 0, 0, "dummyApplicationIpfsHash");
      await this.applicationRegistry.connect(this.signers.admin).approveMilestone(0, 1, 0, "dummyApplicationIpfsHash");
      await this.applicationRegistry.connect(this.signers.admin).completeApplication(0, 0, "reasonIpfsHash");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(4);
    });

    it("workspace admin can not mark application as complete if all milestones are not approved", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 2);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 2, "reasonIpfsHash");
      await this.applicationRegistry.connect(this.signers.admin).approveMilestone(0, 0, 0, "dummyApplicationIpfsHash");
      expect(
        this.applicationRegistry.connect(this.signers.admin).completeApplication(0, 0, "reasonIpfsHash"),
      ).to.be.revertedWith("CompleteApplication: Invalid milestione state");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(2);
    });

    it("application cannot be completed if wrong workspaceId is passed", async function () {
      await this.workspaceRegistry.connect(this.signers.nonAdmin).createWorkspace("dummyWorkspaceIpfsHash");
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 2);
      await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 2, "reasonIpfsHash");
      expect(
        this.applicationRegistry.connect(this.signers.nonAdmin).completeApplication(0, 1, "reasonIpfsHash"),
      ).to.be.revertedWith("ApplicationStateUpdate: Invalid workspace");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(2);
    });
  });

  describe("Milestone state change", function () {
    it("Milestone state can not be updated if milestoneId is invalid", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .requestMilestoneApproval(0, 3, "dummyApplicationIpfsHash"),
      ).to.be.reverted;
    });

    it("Milestone state can not be updated if application is not approved", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .requestMilestoneApproval(0, 0, "dummyApplicationIpfsHash"),
      ).to.be.reverted;
    });

    it("Milestone state can not approved if application is not approved", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(this.applicationRegistry.connect(this.signers.admin).approveMilestone(0, 0, 0, "dummyApplicationIpfsHash"))
        .to.be.reverted;
    });

    describe("If application is approved", function () {
      beforeEach(async function () {
        await this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
        await this.applicationRegistry.connect(this.signers.admin).updateApplicationState(0, 0, 2, "reasonIpfsHash");
      });

      it("Milestone can not be requested for approval if its not in submitted state", async function () {
        await this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .requestMilestoneApproval(0, 0, "dummyApplicationIpfsHash");
        expect(
          this.applicationRegistry
            .connect(this.signers.applicantAdmin)
            .requestMilestoneApproval(0, 0, "dummyApplicationIpfsHash"),
        ).to.be.reverted;
      });

      it("Milestone state can be updated to requested by application owner", async function () {
        await this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .requestMilestoneApproval(0, 0, "dummyApplicationIpfsHash");
        expect(await this.applicationRegistry.applicationMilestones(0, 0)).to.equal(1);
      });

      it("Milestone state can not be updated to requested by application non owner", async function () {
        expect(
          this.applicationRegistry
            .connect(this.signers.nonAdmin)
            .requestMilestoneApproval(0, 0, "dummyApplicationIpfsHash"),
        ).to.be.reverted;
      });

      it("Milestone state can be updated from submitted to approved by grant manager", async function () {
        await this.applicationRegistry
          .connect(this.signers.admin)
          .approveMilestone(0, 0, 0, "dummyApplicationIpfsHash");
        expect(await this.applicationRegistry.applicationMilestones(0, 0)).to.equal(2);
      });

      it("Milestone state can not approved if invalid milestoneId provided", async function () {
        expect(
          this.applicationRegistry.connect(this.signers.admin).approveMilestone(0, 2, 0, "dummyApplicationIpfsHash"),
        ).to.be.reverted;
      });

      it("Milestone state can not approved if invalid workspaceId provided", async function () {
        await this.workspaceRegistry.connect(this.signers.nonAdmin).createWorkspace("dummyWorkspaceIpfsHash");
        expect(
          this.applicationRegistry.connect(this.signers.nonAdmin).approveMilestone(0, 0, 1, "dummyApplicationIpfsHash"),
        ).to.be.revertedWith("ApplicationStateUpdate: Invalid workspace");
      });

      it("Milestone state can not reapproved by grant manager", async function () {
        await this.applicationRegistry
          .connect(this.signers.admin)
          .approveMilestone(0, 0, 0, "dummyApplicationIpfsHash");
        expect(
          this.applicationRegistry.connect(this.signers.admin).approveMilestone(0, 0, 0, "dummyApplicationIpfsHash"),
        ).to.be.reverted;
      });

      it("Milestone state can be updated from requested to approved by grant manager", async function () {
        await this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .requestMilestoneApproval(0, 0, "dummyApplicationIpfsHash");
        await this.applicationRegistry
          .connect(this.signers.admin)
          .approveMilestone(0, 0, 0, "dummyApplicationIpfsHash");
        expect(await this.applicationRegistry.applicationMilestones(0, 0)).to.equal(2);
      });

      it("Milestone state can not be updated from submitted to approved by non grant manager", async function () {
        expect(
          this.applicationRegistry.connect(this.signers.nonAdmin).approveMilestone(0, 0, 0, "dummyApplicationIpfsHash"),
        ).to.be.reverted;
        expect(await this.applicationRegistry.applicationMilestones(0, 0)).to.equal(0);
      });

      it("Milestone state can not be updated from requested to approved by non grant manager", async function () {
        await this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .requestMilestoneApproval(0, 0, "dummyApplicationIpfsHash");
        expect(
          this.applicationRegistry.connect(this.signers.nonAdmin).approveMilestone(0, 0, 0, "dummyApplicationIpfsHash"),
        ).to.be.reverted;
        expect(await this.applicationRegistry.applicationMilestones(0, 0)).to.equal(1);
      });
    });

    it("should return application owner", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(await this.applicationRegistry.getApplicationOwner(0)).to.equal(this.signers.applicantAdmin.address);
    });

    it("deployer can set new deployer address", async function () {
      expect(await this.applicationRegistry.owner()).to.equal(this.signers.admin.address);
      await this.applicationRegistry.connect(this.signers.admin).transferOwnership(this.signers.nonAdmin.address);
      expect(await this.applicationRegistry.owner()).to.equal(this.signers.nonAdmin.address);
    });

    it("non deployer cannot set new deployer address", async function () {
      expect(await this.applicationRegistry.owner()).to.equal(this.signers.admin.address);
      expect(this.applicationRegistry.connect(this.signers.nonAdmin).transferOwnership(this.signers.nonAdmin.address))
        .to.be.reverted;
      expect(await this.applicationRegistry.owner()).to.equal(this.signers.admin.address);
    });
  });
}
