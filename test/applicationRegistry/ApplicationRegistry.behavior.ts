import { expect } from "chai";

export function shouldBehaveLikeApplicationRegistry(): void {
  it("active grant can receive application", async function () {
    expect(await this.applicationRegistry.applicationCount()).to.equal(0);
    await this.applicationRegistry
      .connect(this.signers.applicantAdmin)
      .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
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

  describe("Application state change", function () {
    it("grant manager can ask for application resubmission if application is in submitred state", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .updateApplicationState(0, 1, "dummyApplicationIpfsHash");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(1);
    });

    it("grant manager can approve application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .updateApplicationState(0, 2, "dummyApplicationIpfsHash");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(2);
    });

    it("grant manager can reject application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .updateApplicationState(0, 3, "dummyApplicationIpfsHash");
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(3);
    });

    it("application owner can not approve application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .updateApplicationState(0, 2, "dummyApplicationIpfsHash"),
      ).to.be.reverted;
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(0);
    });

    it("application owner can not reject application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .updateApplicationState(0, 3, "dummyApplicationIpfsHash"),
      ).to.be.reverted;
      const application = await this.applicationRegistry.applications(0);
      expect(application.state).to.equal(0);
    });

    it("application owner can resubmit application with updated metadata if grant manager has asked for resubmission", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .updateApplicationState(0, 1, "dummyApplicationIpfsHash");
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1);
      const application = await this.applicationRegistry.applications(0);
      expect(application.metadataHash).to.equal("updatedApplicationIpfsHash");
      expect(application.state).to.equal(0);
    });

    it("non owner can not resubmit application with updated metadata if grant manager has asked for resubmission", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .updateApplicationState(0, 1, "dummyApplicationIpfsHash");
      const application = await this.applicationRegistry.applications(0);
      expect(application.metadataHash).to.equal("dummyApplicationIpfsHash");
      expect(application.state).to.equal(1);
      // expect(this.applicationRegistry.connect(this.signers.nonAdmin).updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1)).to.be.reverted;
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
      await this.applicationRegistry
        .connect(this.signers.admin)
        .updateApplicationState(0, 2, "dummyApplicationIpfsHash");
      expect(
        this.applicationRegistry
          .connect(this.signers.applicantAdmin)
          .updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1),
      ).to.be.reverted;
      const application = await this.applicationRegistry.applications(0);
      expect(application.metadataHash).to.equal("dummyApplicationIpfsHash");
      expect(application.state).to.equal(2);
    });

    it("application owner can resubmit application with updated metadata if grant manager has rejected the application", async function () {
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.applicationRegistry
        .connect(this.signers.admin)
        .updateApplicationState(0, 3, "dummyApplicationIpfsHash");
      await this.applicationRegistry
        .connect(this.signers.applicantAdmin)
        .updateApplicationMetadata(0, "updatedApplicationIpfsHash", 1);
      const application = await this.applicationRegistry.applications(0);
      expect(application.metadataHash).to.equal("updatedApplicationIpfsHash");
      expect(application.state).to.equal(0);
    });
  });

  describe("Milestone state change", function () {});
}
