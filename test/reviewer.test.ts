import { artifacts, ethers, upgrades } from "hardhat";
import type {} from "../src/types/hardhat";
import type {
  ApplicationRegistry,
  ApplicationReviewRegistry,
  ReviewerTransactionGuard,
  WorkspaceRegistry,
  GrantFactory,
  Grant,
} from "../src/types";
import { expect } from "chai";
import { randomBytes } from "crypto";
import { Signers } from "./types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { creatingWorkpsace, deployWorkspaceContract, randomEthAddress, randomWallet } from "./utils";

describe("Unit tests", function () {
  describe("ReviewerGuard", function () {
    let workspaceRegistry: WorkspaceRegistry;
    let applicationRegistry: ApplicationRegistry;
    let applicationReviewRegistry: ApplicationReviewRegistry;
    let grantFactory: GrantFactory;
    let grant: Grant;
    let guard: ReviewerTransactionGuard;
    let adminAddress: string;
    let adminAddress2: string;

    let safe;
    let admin;
    let reviewer1;
    let reviewer2;
    let applicantZeroWallet;
    let applicantMetamask;

    let threshold = 1;
    let signatures =
      "0x000000000000000000000000631088af5a770bee50ffa7dd5dc18994616dc1ff000000000000000000000000000000000000000000000000000000000000000001";
    let zeroAddress = "0x0000000000000000000000000000000000000000";

    before(async function () {
      const signers: SignerWithAddress[] = await ethers.getSigners();
      admin = signers[0];
      safe = signers[1];
      reviewer1 = signers[2];
      reviewer2 = signers[3];
      applicantZeroWallet = signers[4];
      applicantMetamask = signers[5];
    });

    beforeEach(async () => {
      const workspaceRegistryFactory = await ethers.getContractFactory("WorkspaceRegistry");
      workspaceRegistry = <WorkspaceRegistry>await upgrades.deployProxy(workspaceRegistryFactory, { kind: "uups" });

      await creatingWorkpsace(workspaceRegistry.connect(admin));

      const applicationRegistryFactory = await ethers.getContractFactory("ApplicationRegistry");
      applicationRegistry = <ApplicationRegistry>(
        await upgrades.deployProxy(applicationRegistryFactory, { kind: "uups" })
      );

      const applicationReviewRegistryFactory = await ethers.getContractFactory("ApplicationReviewRegistry");
      applicationReviewRegistry = <ApplicationReviewRegistry>(
        await upgrades.deployProxy(applicationReviewRegistryFactory, { kind: "uups" })
      );

      const grantFactory1 = await ethers.getContractFactory("Grant");
      grant = <Grant>(
        await upgrades.deployProxy(
          grantFactory1,
          [
            0,
            "dummyGrantIpfsHash",
            workspaceRegistry.address,
            applicationRegistry.address,
            admin.address,
            admin.address,
          ],
          { kind: "uups" },
        )
      );

      const grantFactoryFactory = await ethers.getContractFactory("GrantFactory");
      grantFactory = <GrantFactory>await upgrades.deployProxy(grantFactoryFactory, { kind: "uups" });

      // adminAddress = await workspaceRegistry.signer.getAddress();
      // adminAddress2 = await applicationRegistry.signer.getAddress();
      // console.log(admin.address);
      // console.log(adminAddress);
      // console.log(adminAddress2);

      await applicationRegistry.connect(admin).setWorkspaceReg(workspaceRegistry.address);
      await applicationRegistry.connect(admin).setApplicationReviewReg(applicationReviewRegistry.address);
      await applicationReviewRegistry.connect(admin).setWorkspaceReg(workspaceRegistry.address);
      await applicationReviewRegistry.connect(admin).setApplicationReg(applicationRegistry.address);
      await grantFactory.connect(admin).setApplicationReviewReg(applicationReviewRegistry.address);

      const guardFactory = await ethers.getContractFactory("ReviewerTransactionGuard");
      guard = <ReviewerTransactionGuard>await guardFactory.deploy(safe.address, [reviewer1.address], threshold);
      await guard.deployed();

      await guard.connect(safe).setApplicationReviewReg(applicationReviewRegistry.address);
      await guard.connect(safe).setApplicationReg(applicationRegistry.address);
      await guard.connect(safe).setWorkspaceReg(workspaceRegistry.address);
    });

    it("should fail to update threshold from non-Safe addresses", async () => {
      await expect(guard.connect(await randomWallet()).updateThreshold(2)).to.be.revertedWith(
        "Unauthorised: Not the Safe",
      );
    });

    it("should correctly update threshold from the Safe address", async () => {
      await guard.connect(safe).updateThreshold(2);
      await expect(await guard.threshold()).to.equal(2);
    });

    it("should fail to add reviewer from non-Safe addresses", async () => {
      await expect(
        guard.connect(await randomWallet()).addReviewer("0x53349B621922d918d1818da59D88b686F29A5Ec2"),
      ).to.be.revertedWith("Unauthorised: Not the Safe");
    });

    it("should correctly add reviewer from the Safe address", async () => {
      await guard.connect(safe).addReviewer(reviewer2.address);
      await expect(await guard.reviewers(0)).to.equal(reviewer1.address);
      await expect(await guard.reviewers(1)).to.equal(reviewer2.address);
    });

    it("should not be able to remove or update the guard", async () => {
      expect(
        guard
          .connect(safe)
          .checkTransaction(
            "0x631088Af5A770Bee50FFA7dd5DC18994616DC1fF",
            0,
            "0xe19a9dd90000000000000000000000000000000000000000000000000000000000000000",
            0,
            0,
            0,
            0,
            zeroAddress,
            zeroAddress,
            signatures,
            zeroAddress,
          ),
      ).to.be.revertedWith("This guard cannot be removed or changed!");
    });

    it.only("should correctly work in single send scenario", async () => {
      await applicationRegistry
        .connect(applicantZeroWallet)
        .submitApplication(
          grant.address,
          0,
          "dummyApplicationIpfsHash",
          1,
          ethers.utils.hexZeroPad("0x4bed464ce9d43758e826cfa173f1cda82964b894", 32),
        );

      expect(await applicationRegistry.applicationCount()).to.equal(1);
      expect(
        await applicationRegistry.walletAddressMapping(
          ethers.utils.hexZeroPad("0x4bed464ce9d43758e826cfa173f1cda82964b894", 32),
        ),
      ).to.equal(applicantZeroWallet.address);

      await applicationRegistry.connect(admin).updateApplicationState(0, 0, 2, "reasonIpfsHash");
      await workspaceRegistry.connect(admin).updateWorkspaceMembers(0, [reviewer1.address], [1], [true], [""]);
      await applicationReviewRegistry.connect(admin).assignReviewers(0, 0, grant.address, [reviewer1.address], [true]);

      // await applicationReviewRegistry.connect(reviewer1).submitReview(
      //   reviewer1.address,
      //   0,
      //   0,
      //   grant.address,
      //   "dummyIpfsHash"
      // );

      expect((await applicationRegistry.applications(0))[3]).to.equal(applicantZeroWallet.address);

      // expect(await guard.connect(safe).checkTransaction(
      //   "0x631088Af5A770Bee50FFA7dd5DC18994616DC1fF",
      //   0,
      //   "0xa9059cbb0000000000000000000000004bed464ce9d43758e826cfa173f1cda82964b8940000000000000000000000000000000000000000000000000000000000d568de000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000005175657374626f6f6b",
      //   0,
      //   0,
      //   0,
      //   0,
      //   zeroAddress,
      //   zeroAddress,
      //   signatures,
      //   zeroAddress)).to.be.revertedWith("P");

      expect(
        await guard.connect(safe).fetchReviews(0, "0x4bed464ce9d43758e826cfa173f1cda82964b894"),
      ).to.be.revertedWith("p");
    });

    it("should correctly work in multi-send scenario", async () => {
      await applicationRegistry
        .connect(applicantAdmin)
        .submitApplication(
          grant.address,
          0,
          "dummyApplicationIpfsHash",
          1,
          ethers.utils.hexZeroPad(applicantAdmin.address, 32),
        );

      await applicationRegistry.connect(admin).updateApplicationState(0, 0, 2, "reasonIpfsHash");

      await applicationReviewRegistry
        .connect(admin)
        .submitReview(reviewer1.address, 0, 1, grant.address, "dummyApplicationIpfsHash");

      guard
        .connect(safe)
        .checkTransaction(
          "0x631088Af5A770Bee50FFA7dd5DC18994616DC1fF",
          0,
          "0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000003640007865c6e87b9f70255377e024ace6630c1eaa37f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000084a9059cbb0000000000000000000000004bed464ce9d43758e826cfa173f1cda82964b8940000000000000000000000000000000000000000000000000000000001a45a31000000000000000000000000000000000000000000000000000000000000011300000000000000000000000000000000000000000000005175657374626f6f6b0007865c6e87b9f70255377e024ace6630c1eaa37f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000084a9059cbb0000000000000000000000004bed464ce9d43758e826cfa173f1cda82964b8940000000000000000000000000000000000000000000000000000000001a45a31000000000000000000000000000000000000000000000000000000000000011000000000000000000000000000000000000000000000005175657374626f6f6b0007865c6e87b9f70255377e024ace6630c1eaa37f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000084a9059cbb0000000000000000000000004bed464ce9d43758e826cfa173f1cda82964b8940000000000000000000000000000000000000000000000000000000001a45a31000000000000000000000000000000000000000000000000000000000000012400000000000000000000000000000000000000000000005175657374626f6f6b0007865c6e87b9f70255377e024ace6630c1eaa37f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000084a9059cbb0000000000000000000000004e35ff1872a720695a741b00f2fa4d1883440bac000000000000000000000000000000000000000000000000000000000348b463000000000000000000000000000000000000000000000000000000000000011200000000000000000000000000000000000000000000005175657374626f6f6b00000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0,
          zeroAddress,
          zeroAddress,
          signatures,
          zeroAddress,
        );

      await guard.connect(await randomWallet()).fetchReviews(1, applc);
      await expect(guard.reviewers(0)).to.equal("0x53349B621922d918d1818da59D88b686F29A5Ec2");
      await expect(guard.reviewers(1)).to.equal("0x53349B621922d918d1818da59D88b686F29A5Ec2");
    });
  });
});
