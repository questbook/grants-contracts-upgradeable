import { expect } from "chai";

export function shouldBehaveLikeWorkspaceRegistry(): void {
  it("should create new workspace", async function () {
    expect(await this.workspaceRegistry.workspaceCount()).to.equal(0);
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.workspaceCount()).to.equal(1);
  });

  it("admin should be able to edit workspace", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    await this.workspaceRegistry.connect(this.signers.admin).updateWorkspaceMetadata(0, "updatedIpfsHash");
    let workspace = await this.workspaceRegistry.workspaces(0);
    expect(workspace.metadataHash).to.equal("updatedIpfsHash");
  });

  it("non admin should not be able to edit workspace", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(this.workspaceRegistry.connect(this.signers.nonAdmin).updateWorkspaceMetadata(0, "updatedIpfsHash")).to.be
      .reverted;
    let workspace = await this.workspaceRegistry.workspaces(0);
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
