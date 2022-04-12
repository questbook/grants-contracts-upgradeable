import { expect } from "chai";
import { waffle, ethers, upgrades } from "hardhat";

export function shouldBehaveLikeGrantFactory(): void {
  it("deployer can pause the contract", async function () {
    await this.grantFactory.connect(this.signers.admin).pause();
    expect(await this.grantFactory.paused()).to.equal(true);
  });

  it("non deployer can not pause the contract", async function () {
    expect(this.grantFactory.connect(this.signers.nonAdmin).pause()).to.be.reverted;
  });

  it("deployer can unpause the contract", async function () {
    await this.grantFactory.connect(this.signers.admin).pause();
    expect(await this.grantFactory.paused()).to.equal(true);
    await this.grantFactory.connect(this.signers.admin).unpause();
    expect(await this.grantFactory.paused()).to.equal(false);
  });

  it("non deployer can not unpause the contract", async function () {
    await this.grantFactory.connect(this.signers.admin).pause();
    expect(await this.grantFactory.paused()).to.equal(true);
    expect(this.grantFactory.connect(this.signers.nonAdmin).unpause()).to.be.reverted;
  });

  it("new grant creation not possible if contract is paused", async function () {
    await this.grantFactory.connect(this.signers.admin).pause();
    expect(
      this.grantFactory
        .connect(this.signers.admin)
        .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address),
    ).to.be.revertedWith("Pausable: paused");
  });

  it("workspace admin should be able to create new grant", async function () {
    const nonce = await waffle.provider.getTransactionCount(this.grantFactory.address);
    const transaction = {
      from: this.grantFactory.address,
      nonce: nonce,
    };
    const expectedGrantAddress = ethers.utils.getContractAddress(transaction);
    const create = await this.grantFactory
      .connect(this.signers.admin)
      .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address);
    const tx = await create.wait();
    expect(tx.events[3].args[0]).to.equal(expectedGrantAddress);
    expect(parseInt(tx.events[3].args[1], 16)).to.equal(0);
    expect(tx.events[3].args[2]).to.equal("dummyIpfsHash");
  });

  it("workspace reviewer should not be able to create new grant", async function () {
    await this.workspaceRegistry
      .connect(this.signers.admin)
      .updateWorkspaceMembers(0, [this.signers.reviewer.address], [1], [true], [""]);
    expect(
      this.grantFactory
        .connect(this.signers.reviewer)
        .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address),
    ).to.be.revertedWith("GrantCreate: Unauthorised");
  });

  it("workspace non admin should not be able to create new grant", async function () {
    expect(
      this.grantFactory
        .connect(this.signers.nonAdmin)
        .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address),
    ).to.be.reverted;
  });

  describe("Proxy implementation upgrade", function () {
    it("should not be able to call proxy initiliaze function", async function () {
      expect(this.grantFactory.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("deployer can upgrade the grantFactory proxy implementation contract", async function () {
      const grantFactory = await upgrades.upgradeProxy(this.grantFactory.address, this.grantFactoryFactoryV2);
      expect(await grantFactory.version()).to.equal("v2!");
    });

    it("non deployer cannot upgrade the grantFactory proxy implementation contract", async function () {
      const grantFactoryFactoryV2NonAdmin = await ethers.getContractFactory("GrantFactoryV2", this.signers.nonAdmin);
      expect(upgrades.upgradeProxy(this.grantFactory.address, grantFactoryFactoryV2NonAdmin)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("deployer should be able to upgrade the grant implementation deployed using createGrant function", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.otherAdmin.address], [0], [true], [""]);
      const create = await this.grantFactory
        .connect(this.signers.otherAdmin)
        .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address);
      const tx = await create.wait();
      await upgrades.forceImport(tx.events[3].args[0], this.grantFactoryV1, { kind: "uups" });
      const grantv2 = await upgrades.upgradeProxy(tx.events[3].args[0], this.grantFactoryV2);
      expect(await grantv2.version()).to.equal("v2!");
    });

    it("non deployer should not be able to upgrade the grant implementation deployed using createGrant function", async function () {
      await this.workspaceRegistry
        .connect(this.signers.admin)
        .updateWorkspaceMembers(0, [this.signers.otherAdmin.address], [0], [true], [""]);
      const create = await this.grantFactory
        .connect(this.signers.otherAdmin)
        .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address);
      const tx = await create.wait();
      await upgrades.forceImport(tx.events[3].args[0], this.grantFactoryV1, { kind: "uups" });
      const grantFactoryV2NonAdmin = await ethers.getContractFactory("GrantV2", this.signers.nonAdmin);
      expect(upgrades.upgradeProxy(tx.events[3].args[0], grantFactoryV2NonAdmin)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    // [TODO] - test data persistance after upgrade of grantFactory proxy implementation contract?
    // it("should retain grantFactory data", async function () {
    // });
  });
}
