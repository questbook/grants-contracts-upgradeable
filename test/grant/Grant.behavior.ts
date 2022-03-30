import { expect } from "chai";

export function shouldBehaveLikeGrant(): void {
  it("Application count can only be modified by applicationRegistry", async function () {
    expect(this.grant.connect(this.signers.admin).incrementApplicant()).to.be.reverted;
  });

  describe("Updating a grant is", async function () {
    it("possible if no one applied to grant yet and admin is updating", async function () {
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
      await this.grant.connect(this.signers.admin).updateGrant("updatedIpfsHash");
      expect(await this.grant.metadataHash()).to.equal("updatedIpfsHash");
    });

    it("not possible if no one applied to grant and reviewer is updating", async function () {
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      expect(this.grant.connect(this.signers.reviewer).updateGrant("updatedIpfsHash")).to.be.revertedWith(
        "Unauthorised: Not an admin",
      );
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
    });

    it("not possible if no one applied to grant and non admin is updating", async function () {
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
      expect(this.grant.connect(this.signers.nonAdmin).updateGrant("updatedIpfsHash")).to.be.revertedWith(
        "Unauthorised: Not an admin",
      );
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
    });

    it("not possible if alteast 1 applicant applied to grant", async function () {
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
      await this.applicationRegistry
        .connect(this.signers.admin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(this.grant.connect(this.signers.admin).updateGrant("updatedIpfsHash")).to.be.revertedWith(
        "GrantUpdate: Applicants have already started applying",
      );
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
    });
  });

  describe("Updating grant accessibility is", async function () {
    it("possible if admin is updating", async function () {
      expect(await this.grant.active()).to.equal(true);
      await this.grant.connect(this.signers.admin).updateGrantAccessibility(false);
      expect(await this.grant.active()).to.equal(false);
    });

    it("not possible if reviewer is updating", async function () {
      expect(await this.grant.active()).to.equal(true);
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
      expect(this.grant.connect(this.signers.reviewer).updateGrantAccessibility(false)).to.be.revertedWith(
        "Unauthorised: Not an admin",
      );
    });

    it("not possible if non admin is updating", async function () {
      expect(await this.grant.active()).to.equal(true);
      expect(this.grant.connect(this.signers.nonAdmin).updateGrantAccessibility(false)).to.be.revertedWith(
        "Unauthorised: Not an admin",
      );
    });
  });
}
