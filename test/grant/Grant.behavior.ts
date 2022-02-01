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

    it("not possible if no one applied to grant and non admin is updating", async function () {
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
      expect(this.grant.connect(this.signers.nonAdmin).updateGrant("updatedIpfsHash")).to.be.reverted;
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
    });

    it("not possible if alteast 1 applicant applied to grant", async function () {
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
      await this.applicationRegistry
        .connect(this.signers.admin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      expect(this.grant.connect(this.signers.admin).updateGrant("updatedIpfsHash")).to.be.reverted;
      expect(await this.grant.metadataHash()).to.equal("dummyGrantIpfsHash");
    });
  });

  describe("Updating grant accessibility is", async function () {
    it("possible if admin is updating", async function () {
      expect(await this.grant.active()).to.equal(true);
      await this.grant.connect(this.signers.admin).updateGrantAccessibility(false);
      expect(await this.grant.active()).to.equal(false);
    });

    it("not possible if non admin is updating", async function () {
      expect(await this.grant.active()).to.equal(true);
      expect(this.grant.connect(this.signers.nonAdmin).updateGrantAccessibility(false)).to.be.reverted;
    });
  });

  describe("Fund deposit is", async function () {
    it("possible if amount is approved and erc20 transfer succeeds", async function () {
      await this.applicationRegistry
        .connect(this.signers.admin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.mockERC20.mock.allowance.returns(10000);
      await this.mockERC20.mock.transferFrom.returns(true);
      const deposit = await this.grant.connect(this.signers.admin).depositFunds(this.mockERC20.address, 1000);
      const tx = await deposit.wait();
      expect(tx.events[0].args[0]).to.equal(this.mockERC20.address);
      expect(tx.events[0].args[1].toNumber()).to.equal(1000);
    });

    it("not possible if amount is not approved", async function () {
      await this.mockERC20.mock.allowance.returns(500);
      await this.mockERC20.mock.transferFrom.returns(true);
      expect(this.grant.connect(this.signers.admin).depositFunds(this.mockERC20.address, 1000)).to.be.reverted;
    });

    it("not possible if amount is approved but erc20 transfer fails", async function () {
      await this.mockERC20.mock.allowance.returns(10000);
      await this.mockERC20.mock.transferFrom.returns(false);
      expect(this.grant.connect(this.signers.admin).depositFunds(this.mockERC20.address, 1000)).to.be.reverted;
    });
  });

  describe("Locked amount disbursal is", async function () {
    it("possible if erc20 transfer succeeds", async function () {
      await this.applicationRegistry
        .connect(this.signers.admin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.mockERC20.mock.transferFrom.returns(true);
      const disburse = await this.grant.connect(this.signers.admin).disburseReward(0, 0, this.mockERC20.address, 1000);
      const tx = await disburse.wait();
      expect(tx.events[0].args[0].toNumber()).to.equal(0);
      expect(tx.events[0].args[1].toNumber()).to.equal(0);
      expect(tx.events[0].args[2]).to.equal(this.mockERC20.address);
      expect(tx.events[0].args[3]).to.equal(this.signers.admin.address);
      expect(tx.events[0].args[4].toNumber()).to.equal(1000);
    });

    it("not possible if non admin disburses", async function () {
      await this.applicationRegistry
        .connect(this.signers.admin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.mockERC20.mock.transferFrom.returns(true);
      expect(this.grant.connect(this.signers.nonAdmin).disburseReward(0, 0, this.mockERC20.address, 1000)).to.be
        .reverted;
    });

    it("not possible if erc20 transfer fails", async function () {
      await this.mockERC20.mock.transferFrom.returns(false);
      expect(this.grant.connect(this.signers.admin).disburseReward(0, 0, this.mockERC20.address, 1000)).to.be.reverted;
    });
  });

  describe("P2P amount disbursal is", async function () {
    it("possible if amount is approved and erc20 transfer succeeds", async function () {
      await this.applicationRegistry
        .connect(this.signers.admin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.mockERC20.mock.allowance.returns(10000);
      await this.mockERC20.mock.transferFrom.returns(true);
      const disburse = await this.grant
        .connect(this.signers.admin)
        .disburseRewardP2P(0, 0, this.mockERC20.address, 1000);
      const tx = await disburse.wait();
      expect(tx.events[0].args[0].toNumber()).to.equal(0);
      expect(tx.events[0].args[1].toNumber()).to.equal(0);
      expect(tx.events[0].args[2]).to.equal(this.mockERC20.address);
      expect(tx.events[0].args[3]).to.equal(this.signers.admin.address);
      expect(tx.events[0].args[4].toNumber()).to.equal(1000);
    });

    it("not possible if non admin disburses", async function () {
      await this.applicationRegistry
        .connect(this.signers.admin)
        .submitApplication(this.grant.address, 0, "dummyApplicationIpfsHash", 1);
      await this.mockERC20.mock.allowance.returns(10000);
      await this.mockERC20.mock.transferFrom.returns(true);
      expect(this.grant.connect(this.signers.nonAdmin).disburseRewardP2P(0, 0, this.mockERC20.address, 1000)).to.be
        .reverted;
    });

    it("not possible if amount is not approved", async function () {
      await this.mockERC20.mock.allowance.returns(500);
      await this.mockERC20.mock.transferFrom.returns(true);
      expect(this.grant.connect(this.signers.admin).disburseRewardP2P(0, 0, this.mockERC20.address, 1000)).to.be
        .reverted;
    });

    it("not possible if amount is approved but erc20 transfer fails", async function () {
      await this.mockERC20.mock.allowance.returns(10000);
      await this.mockERC20.mock.transferFrom.returns(false);
      expect(this.grant.connect(this.signers.admin).disburseRewardP2P(0, 0, this.mockERC20.address, 1000)).to.be
        .reverted;
    });
  });
}
