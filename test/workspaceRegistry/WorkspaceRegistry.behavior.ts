import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

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

    it("update member roles from workspace should not work", async function () {
      expect(
        this.workspaceRegistry
          .connect(this.signers.admin)
          .updateWorkspaceMembers(0, [this.signers.admin.address], [0], [true], [""]),
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

  it("admin should be able to update member roles", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);

    await this.workspaceRegistry
      .connect(this.signers.admin)
      .updateWorkspaceMembers(0, [this.signers.admin.address], [0], [false], [""]);
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(false);
  });

  it("admin should be able to add and remove reviewer member roles", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);

    await this.workspaceRegistry
      .connect(this.signers.admin)
      .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.reviewer.address)).to.equal(false);
    expect(await this.workspaceRegistry.isWorkspaceAdminOrReviewer(0, this.signers.reviewer.address)).to.equal(true);
    await this.workspaceRegistry
      .connect(this.signers.admin)
      .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [false], [""]);
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.reviewer.address)).to.equal(false);
    expect(await this.workspaceRegistry.isWorkspaceAdminOrReviewer(0, this.signers.reviewer.address)).to.equal(false);
  });

  it("admin should be able to add and remove admin member roles", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);

    await this.workspaceRegistry
      .connect(this.signers.admin)
      .updateWorkspaceMembers(0, [this.signers.nonAdmin.address], [0], [true], [""]);
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.nonAdmin.address)).to.equal(true);
    expect(await this.workspaceRegistry.isWorkspaceAdminOrReviewer(0, this.signers.nonAdmin.address)).to.equal(true);
    await this.workspaceRegistry
      .connect(this.signers.admin)
      .updateWorkspaceMembers(0, [this.signers.nonAdmin.address], [0], [false], [""]);
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.nonAdmin.address)).to.equal(false);
    expect(await this.workspaceRegistry.isWorkspaceAdminOrReviewer(0, this.signers.nonAdmin.address)).to.equal(false);
  });

  it("non admin should not be able to update member roles", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);
    expect(
      this.workspaceRegistry
        .connect(this.signers.nonAdmin)
        .updateWorkspaceMembers(0, [this.signers.admin.address], [0], [false], [""]),
    ).to.be.revertedWith("Unauthorised: Not an admin");
  });

  it("other admin should not be able to update workspace owner admin role to false", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);
    await this.workspaceRegistry
      .connect(this.signers.admin)
      .updateWorkspaceMembers(0, [this.signers.otherAdmin.address], [0], [true], [""]);
    expect(
      this.workspaceRegistry
        .connect(this.signers.otherAdmin)
        .updateWorkspaceMembers(0, [this.signers.admin.address], [0], [false], [""]),
    ).to.be.revertedWith("WorkspaceOwner: Cannot disable owner admin role");
  });

  it("reviewer should not be able to update member roles", async function () {
    await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.admin.address)).to.equal(true);
    await this.workspaceRegistry
      .connect(this.signers.admin)
      .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
    expect(await this.workspaceRegistry.isWorkspaceAdmin(0, this.signers.reviewer.address)).to.equal(false);
    expect(await this.workspaceRegistry.isWorkspaceAdminOrReviewer(0, this.signers.reviewer.address)).to.equal(true);
    expect(
      this.workspaceRegistry
        .connect(this.signers.reviewer)
        .updateWorkspaceMembers(0, [this.signers.admin.address], [0], [false], [""]),
    ).to.be.revertedWith("Unauthorised: Not an admin");
  });

  describe("Proxy implementation upgrade", function () {
    it("should not be able to call proxy initiliaze function", async function () {
      expect(this.workspaceRegistry.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("deployer can upgrade the workspaceRegistry proxy implementation contract", async function () {
      const workspaceRegistry = await upgrades.upgradeProxy(
        this.workspaceRegistry.address,
        this.workspaceRegistryFactoryV2,
      );
      expect(await workspaceRegistry.version()).to.equal("v2!");
    });

    it("non deployer cannot upgrade the workspaceRegistry proxy implementation contract", async function () {
      const workspaceRegistryFactoryV2NonAdmin = await ethers.getContractFactory(
        "WorkspaceRegistryV2",
        this.signers.nonAdmin,
      );
      expect(
        upgrades.upgradeProxy(this.workspaceRegistry.address, workspaceRegistryFactoryV2NonAdmin),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should retain workspace data", async function () {
      expect(await this.workspaceRegistry.workspaceCount()).to.equal(0);
      await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");
      expect(await this.workspaceRegistry.workspaceCount()).to.equal(1);
      const workspaceRegistry = await upgrades.upgradeProxy(
        this.workspaceRegistry.address,
        this.workspaceRegistryFactoryV2,
      );
      expect(await workspaceRegistry.version()).to.equal("v2!");
      expect(await workspaceRegistry.workspaceCount()).to.equal(1);
    });
  });
}
