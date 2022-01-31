import { expect } from "chai";
import { waffle, ethers } from "hardhat";

export function shouldBehaveLikeGrantFactory(): void {
  it("workspace admin should be able to create new grant", async function () {
    const nonce = await waffle.provider.getTransactionCount(this.grantFactory.address);
    const transaction = {
      from: this.grantFactory.address,
      nonce: nonce,
    };
    const expectedGrantAddress = ethers.utils.getContractAddress(transaction);
    const nextBlockTime = Math.floor(new Date().getTime() / 1000) + 1000;
    await waffle.provider.send("evm_setNextBlockTimestamp", [nextBlockTime]);
    const create = await this.grantFactory
      .connect(this.signers.admin)
      .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address);
    expect(create)
      .to.emit(this.grantFactory, "GrantCreated")
      .withArgs(expectedGrantAddress, 0, "dummyIpfsHash", nextBlockTime);
  });

  it("workspace non admin should not be able to create new grant", async function () {
    expect(
      this.grantFactory
        .connect(this.signers.nonAdmin)
        .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address),
    ).to.be.reverted;
  });
}
