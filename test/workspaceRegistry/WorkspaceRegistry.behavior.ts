import { expect } from "chai";

export function shouldBehaveLikeWorkspaceRegistry(): void {
  it("deployer can pause the contract", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).pause();
    expect(await this.workspaceRegistry.paused()).to.equal(true);
  });

  it("non deployer can not pause the contract", async function () {
    expect(this.workspaceRegistry.connect(this.signers.nonAdmin).pause()).to.be.reverted;
  });

  it("deployer can unpause the contract", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).pause();
    expect(await this.workspaceRegistry.paused()).to.equal(true);
    await this.workspaceRegistry.connect(this.signers.admin).unpause();
    expect(await this.workspaceRegistry.paused()).to.equal(false);
  });

  it("non deployer can not unpause the contract", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).pause();
    expect(await this.workspaceRegistry.paused()).to.equal(true);
    expect(this.workspaceRegistry.connect(this.signers.nonAdmin).unpause()).to.be.reverted;
  });

  describe("If contract is paused", function () {
    beforeEach(async function () {
      await this.workspaceRegistry.connect(this.signers.admin).pause();
    });

    it("workspace create should not work", async function () {
      expect(this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash")).to.be.revertedWith(
        "Pausable: paused",
      );
    });

    it("workspace update should not work", async function () {
      expect(
        this.workspaceRegistry.connect(this.signers.nonAdmin).updateWorkspaceMetadata(0, "updatedIpfsHash"),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("add admins to workspace should not work", async function () {
      expect(
        this.workspaceRegistry
          .connect(this.signers.nonAdmin)
          .addWorkspaceAdmins(0, [this.signers.nonAdmin.address], [""]),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("remove admins from workspace should not work", async function () {
      expect(
        this.workspaceRegistry.connect(this.signers.admin).removeWorkspaceAdmins(0, [this.signers.admin.address]),
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  it("should create new workspace", async function () {
    expect(await this.workspaceRegistry.workspaceCount()).to.equal(0);
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.workspaceCount()).to.equal(1);
  });

  it("admin should be able to edit workspace", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMetadata(0, "updatedIpfsHash");
    const workspace = await this.workspaceRegistry.workspaces(0);
    expect(workspace.metadataHash).to.equal("updatedIpfsHash");
  });

  it("non admin should not be able to edit workspace", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(this.workspaceRegistry.connect(this.signers.nonAdmin).updateWorkspaceMetadata(0, "updatedIpfsHash")).to.be
      .reverted;
    const workspace = await this.workspaceRegistry.workspaces(0);
    expect(workspace.metadataHash).to.equal("dummyIpfsHash");
  });

  it("admin should be able to add admins", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);

    await this.workspaceRegistry
      .connect(this.signers.admin)
      .addWorkspaceAdmins(0, [this.signers.nonAdmin.address], [""]);
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.nonAdmin.address)).to.equal(true);
  });

  it("non admin should not be able to add admins", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);
    expect(
      this.workspaceRegistry
        .connect(this.signers.nonAdmin)
        .addWorkspaceAdmins(0, [this.signers.nonAdmin.address], [""]),
    ).to.be.reverted;
  });

  it("admin should be able to remove admins", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);

    await this.workspaceRegistry.connect(this.signers.admin).removeWorkspaceAdmins(0, [this.signers.admin.address]);
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(false);
  });

  it("non admin should not be able to remove admins", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);
    expect(this.workspaceRegistry.connect(this.signers.nonAdmin).removeWorkspaceAdmins(0, [this.signers.admin.address]))
      .to.be.reverted;
  });
}
