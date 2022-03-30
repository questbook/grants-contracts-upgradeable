import { expect } from "chai";
import { waffle, ethers } from "hardhat";

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
    expect(tx.events[0].args[0]).to.equal(expectedGrantAddress);
    expect(parseInt(tx.events[0].args[1], 16)).to.equal(0);
    expect(tx.events[0].args[2]).to.equal("dummyIpfsHash");
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
}
