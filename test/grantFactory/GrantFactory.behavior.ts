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
    const create = await this.grantFactory
      .connect(this.signers.admin)
      .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address);
    const tx = await create.wait();
    expect(tx.events[0].args[0]).to.equal(expectedGrantAddress);
    expect(parseInt(tx.events[0].args[1], 16)).to.equal(0);
    expect(tx.events[0].args[2]).to.equal("dummyIpfsHash");
  });

  it("workspace non admin should not be able to create new grant", async function () {
    expect(
      this.grantFactory
        .connect(this.signers.nonAdmin)
        .createGrant(0, "dummyIpfsHash", this.workspaceRegistry.address, this.applicationRegistry.address),
    ).to.be.reverted;
  });
}
