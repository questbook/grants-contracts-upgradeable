import { ethers, upgrades } from "hardhat";
import type {} from "../src/types/hardhat";
import type {
  ApplicationRegistry,
  ApplicationReviewRegistry,
  WorkspaceRegistry,
  WorkspaceRegistryV2__factory,
} from "../src/types";
import { expect } from "chai";
import { randomBytes } from "crypto";
import { creatingWorkpsace, deployWorkspaceContract, randomEthAddress, randomWallet } from "./utils";

describe("Unit tests", function () {
  describe("WorkspaceRegistry", function () {
    let workspaceRegistry: WorkspaceRegistry;
    let workspaceRegistryFactoryV2: WorkspaceRegistryV2__factory;
    let adminAddress: string;

    beforeEach(async () => {
      workspaceRegistry = await deployWorkspaceContract();
      adminAddress = await workspaceRegistry.signer.getAddress();
      workspaceRegistryFactoryV2 = await ethers.getContractFactory("WorkspaceRegistryV2");
    });

    it("test proxy deployment", async function () {
      const workspaceRegistryv2 = await upgrades.upgradeProxy(workspaceRegistry.address, workspaceRegistryFactoryV2);
      expect(await workspaceRegistryv2.version()).to.equal("v2!");
    });

    it("deployer can pause the contract", async function () {
      await workspaceRegistry.pause();
      expect(await workspaceRegistry.paused()).to.equal(true);
    });

    it("non deployer can not pause the contract", async function () {
      expect(workspaceRegistry.connect(await randomWallet()).pause()).to.be.reverted;
    });

    it("deployer can unpause the contract", async function () {
      await workspaceRegistry.pause();
      expect(await workspaceRegistry.paused()).to.equal(true);
      await workspaceRegistry.unpause();
      expect(await workspaceRegistry.paused()).to.equal(false);
    });

    it("non deployer can not unpause the contract", async function () {
      await workspaceRegistry.pause();
      expect(await workspaceRegistry.paused()).to.equal(true);
      expect(workspaceRegistry.connect(await randomWallet()).unpause()).to.be.reverted;
    });

    describe("If contract is paused", function () {
      beforeEach(async function () {
        await workspaceRegistry.pause();
      });

      it("workspace create should not work", async function () {
        expect(creatingWorkpsace(workspaceRegistry)).to.be.revertedWith("Pausable: paused");
      });

      it("workspace update should not work", async function () {
        expect(
          workspaceRegistry.connect(await randomWallet()).updateWorkspaceMetadata(0, "updatedIpfsHash"),
        ).to.be.revertedWith("Pausable: paused");
      });

      it("update member roles from workspace should not work", async function () {
        expect(workspaceRegistry.updateWorkspaceMembers(0, [adminAddress], [0], [true], [""])).to.be.revertedWith(
          "Pausable: paused",
        );
      });
    });

    it("should create new workspace", async function () {
      expect(await workspaceRegistry.workspaceCount()).to.equal(0);
      await creatingWorkpsace(workspaceRegistry);
      expect(await workspaceRegistry.workspaceCount()).to.equal(1);
    });

    it("record safe transaction successful, initiated by admin", async function () {
      const admin = await randomWallet();

      await creatingWorkpsace(workspaceRegistry.connect(admin));
      const result = await workspaceRegistry
        .connect(admin)
        .disburseRewardFromSafe(
          [0, 1, 2],
          [0, 0, 0],
          "0xE3D997D569b5b03B577C6a2Edd1d2613FE776cb0",
          "",
          "",
          [100, 200, 300],
          0,
          "",
        );
      const data = await result.wait();
      const { events } = data;
      if (events) {
        console.log("inside events");
        expect(events[0].event).to.equal("DisburseRewardFromSafe");
      }
    });

    it("should emit funds transfer transaction status event", async function () {
      const result = await workspaceRegistry.updateFundsTransferTransactionStatus(
        [0, 1, 2],
        [
          "0xd995e3f5dd1aadf285bf426953673cc49b57c62e339085105d9258a1070da509",
          "0xe995e3f5dd1aadf285bf426953673cc49b57c62e339085105d9258a1070da509",
          "0xf995e3f5dd1aadf285bf426953673cc49b57c62e339085105d9258a1070da509",
        ],
        ["executed", "executed", "executed"],
        [100, 200, 300],
        [18890, 166667, 166536],
      );
      const data = await result.wait();
      const { events } = data;
      if (events) {
        expect(events[0].event).to.equal("FundsTransferStatusUpdated");
      }
    });

    it("should create new workspace with safe", async function () {
      const safeAddress = randomBytes(32);
      const safeChainId = 123;
      const result = await creatingWorkpsace(workspaceRegistry, safeAddress, safeChainId);
      const recp = await result.wait();
      const { args: eventArgs } = recp.events!.find(e => e.event === "WorkspaceSafeUpdated")!;
      expect(eventArgs!.id).to.eq(0);
      // check safe address was input correctly
      expect(eventArgs!.safeAddress.slice(2)).to.eq(safeAddress.toString("hex"));
      expect(eventArgs!.safeChainId.toNumber()).to.eq(safeChainId);
    });

    it("should update a workspace safe", async function () {
      const safeAddress = randomBytes(32);
      const safeChainId = 123;

      await creatingWorkpsace(workspaceRegistry);

      const result = await workspaceRegistry.updateWorkspaceSafe(0, safeAddress, "", safeChainId);
      const recp = await result.wait();
      const { args: eventArgs } = recp.events!.find(e => e.event === "WorkspaceSafeUpdated")!;
      expect(eventArgs!.id).to.eq(0);
      // check safe address was input correctly
      expect(eventArgs!.safeAddress.slice(2)).to.eq(safeAddress.toString("hex"));
      expect(eventArgs!.safeChainId.toNumber()).to.eq(safeChainId);
    });

    it("should fail to update workspace safe by random user", async function () {
      const workspaceId = 0;
      const updater = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);

      await expect(
        workspaceRegistry.connect(updater).updateWorkspaceSafe(workspaceId, randomBytes(32), "", 1),
      ).to.be.revertedWith("Unauthorised: Not an admin");
    });

    it("admin should be able to edit workspace", async function () {
      await creatingWorkpsace(workspaceRegistry);
      await workspaceRegistry.updateWorkspaceMetadata(0, "updatedIpfsHash");
      const workspace = await workspaceRegistry.workspaces(0);
      expect(workspace.metadataHash).to.equal("updatedIpfsHash");
    });

    it("reviewer should be able to edit workspace", async function () {
      const reviewer = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);

      await workspaceRegistry.updateWorkspaceMembers(0, [reviewer.address], [1], [true], [""]);

      await workspaceRegistry.connect(reviewer).updateWorkspaceMetadata(0, "updatedIpfsHash");
      const workspace = await workspaceRegistry.workspaces(0);
      expect(workspace.metadataHash).to.equal("updatedIpfsHash");
    });

    it("non admin should not be able to edit workspace", async function () {
      const nonAdminAddress = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);
      expect(workspaceRegistry.connect(nonAdminAddress).updateWorkspaceMetadata(0, "updatedIpfsHash")).to.be.reverted;
      const workspace = await workspaceRegistry.workspaces(0);
      expect(workspace.metadataHash).to.equal("dummyIpfsHash");
    });

    it("admin should be able to update member roles", async function () {
      await creatingWorkpsace(workspaceRegistry);
      expect(await workspaceRegistry.isWorkspaceAdmin(0, adminAddress)).to.equal(true);

      await workspaceRegistry.updateWorkspaceMembers(0, [adminAddress], [0], [false], [""]);
      expect(await workspaceRegistry.isWorkspaceAdmin(0, adminAddress)).to.equal(false);
    });

    it("admin should be able to add and remove reviewer roles", async function () {
      await creatingWorkpsace(workspaceRegistry);
      expect(await workspaceRegistry.isWorkspaceAdmin(0, adminAddress)).to.equal(true);

      const ROLES = [0, 1];
      for (const role of ROLES) {
        const address = ethers.Wallet.createRandom().address;
        const isAdmin = role === 0;
        await workspaceRegistry.updateWorkspaceMembers(0, [address], [role], [true], [""]);
        expect(await workspaceRegistry.isWorkspaceAdmin(0, address)).to.equal(isAdmin);
        expect(await workspaceRegistry.isWorkspaceAdminOrReviewer(0, address)).to.equal(true);

        await workspaceRegistry.updateWorkspaceMembers(0, [address], [role], [false], [""]);
        expect(await workspaceRegistry.isWorkspaceAdmin(0, address)).to.equal(false);
        expect(await workspaceRegistry.isWorkspaceAdminOrReviewer(0, address)).to.equal(false);
      }
    });

    it("non admin should not be able to update member roles", async function () {
      const nonAdmin = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);

      expect(
        workspaceRegistry.connect(nonAdmin).updateWorkspaceMembers(0, [adminAddress], [0], [false], [""]),
      ).to.be.revertedWith("Unauthorised: Not an admin");
    });

    it("other admin should not be able to update workspace owner admin role to false", async function () {
      const signerAddress = await workspaceRegistry.signer.getAddress();
      const otherAdmin = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);

      await workspaceRegistry.updateWorkspaceMembers(0, [otherAdmin.address], [0], [true], [""]);
      expect(
        workspaceRegistry.connect(otherAdmin).updateWorkspaceMembers(0, [signerAddress], [0], [false], [""]),
      ).to.be.revertedWith("WorkspaceOwner: Cannot disable owner admin role");
    });

    it("reviewer should not be able to update member roles", async function () {
      const reviewer = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);

      await workspaceRegistry.updateWorkspaceMembers(0, [reviewer.address], [1], [true], [""]);
      expect(await workspaceRegistry.isWorkspaceAdmin(0, reviewer.address)).to.equal(false);
      expect(await workspaceRegistry.isWorkspaceAdminOrReviewer(0, reviewer.address)).to.equal(true);
      expect(
        workspaceRegistry.connect(reviewer).updateWorkspaceMembers(0, [adminAddress], [0], [false], [""]),
      ).to.be.revertedWith("Unauthorised: Not an admin");
    });

    it("reviewer should only be able to update their own metadata", async function () {
      const reviewer = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);

      await workspaceRegistry.updateWorkspaceMembers(0, [reviewer.address], [1], [true], [""]);
      expect(await workspaceRegistry.isWorkspaceAdmin(0, reviewer.address)).to.equal(false);
      expect(await workspaceRegistry.isWorkspaceAdminOrReviewer(0, reviewer.address)).to.equal(true);

      const tx = await workspaceRegistry
        .connect(reviewer)
        .updateWorkspaceMembers(0, [reviewer.address], [1], [true], ["new_metadata_hash"]);
      const txn = await tx.wait();
      expect(txn.events?.length).to.equal(1);
      const event = txn.events?.[0];

      if (event && event?.args) {
        expect(event.event).to.equal("WorkspaceMemberUpdated");
        expect(event.args[0]).to.equals(0);
        expect(event.args[1]).to.equals(reviewer.address);
        expect(event.args[2]).to.equals(1);
        expect(event.args[3]).to.equals(true);
        expect(event.args[4]).to.equals("new_metadata_hash");
      }
    });

    it("reviewer cannot remove someone else from the workspace", async function () {
      const reviewer = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);

      await workspaceRegistry.updateWorkspaceMembers(0, [reviewer.address], [1], [true], [""]);
      expect(await workspaceRegistry.isWorkspaceAdmin(0, reviewer.address)).to.equal(false);
      expect(await workspaceRegistry.isWorkspaceAdminOrReviewer(0, reviewer.address)).to.equal(true);

      workspaceRegistry
        .connect(reviewer)
        .updateWorkspaceMembers(0, [adminAddress], [0], [true], [""])
        .catch(err => {
          expect(err.message).to.equal(
            "VM Exception while processing transaction: reverted with reason string 'UpdateWorkspaceMembers: Reviewer can only update themselves'",
          );
        });
    });

    it("reviewer cannot make themselves admin", async function () {
      const reviewer = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);

      await workspaceRegistry.updateWorkspaceMembers(0, [reviewer.address], [1], [true], [""]);
      expect(await workspaceRegistry.isWorkspaceAdmin(0, reviewer.address)).to.equal(false);
      expect(await workspaceRegistry.isWorkspaceAdminOrReviewer(0, reviewer.address)).to.equal(true);

      workspaceRegistry
        .connect(reviewer)
        .updateWorkspaceMembers(0, [reviewer.address], [0], [true], [""])
        .catch(err => {
          expect(err.message).to.equal(
            "VM Exception while processing transaction: reverted with reason string 'UpdateWorkspaceMembers: Reviewer can only update themselves'",
          );
        });
    });

    describe("Proxy implementation upgrade", function () {
      it("should not be able to call proxy initiliaze function", async function () {
        expect(workspaceRegistry.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
      });

      it("deployer can upgrade the workspaceRegistry proxy implementation contract", async function () {
        const _workspaceRegistry = await upgrades.upgradeProxy(workspaceRegistry.address, workspaceRegistryFactoryV2);
        expect(await _workspaceRegistry.version()).to.equal("v2!");
      });

      it("non deployer cannot upgrade the workspaceRegistry proxy implementation contract", async function () {
        const nonAdmin = await randomWallet();
        const workspaceRegistryFactoryV2NonAdmin = await ethers.getContractFactory("WorkspaceRegistryV2", nonAdmin);
        expect(upgrades.upgradeProxy(workspaceRegistry.address, workspaceRegistryFactoryV2NonAdmin)).to.be.revertedWith(
          "Ownable: caller is not the owner",
        );
      });

      it("should retain workspace data", async function () {
        expect(await workspaceRegistry.workspaceCount()).to.equal(0);
        await creatingWorkpsace(workspaceRegistry);
        expect(await workspaceRegistry.workspaceCount()).to.equal(1);

        const _workspaceRegistry = await upgrades.upgradeProxy(workspaceRegistry.address, workspaceRegistryFactoryV2);
        expect(await _workspaceRegistry.version()).to.equal("v2!");
        expect(await _workspaceRegistry.workspaceCount()).to.equal(1);
      });
    });

    it("should update visibility state of a DAO", async function () {
      await creatingWorkpsace(workspaceRegistry);
      const result = await workspaceRegistry.updateWorkspacesVisible([0], [true]);

      const { events } = await result.wait();
      if (events) {
        expect(events[0].event).to.equal("WorkspacesVisibleUpdated");
      }
    });

    it("should add/remove a QB admin", async () => {
      const user = await randomWallet();

      const addResult = await workspaceRegistry.addQBAdmins([user.address]);
      expect(await workspaceRegistry.getQBAdmins()).to.include(user.address);

      const { events: addEvents } = await addResult.wait();
      if (addEvents) {
        expect(addEvents[0].event).to.equal("QBAdminsUpdated");
      }

      // should throw err if admin already added
      expect(workspaceRegistry.addQBAdmins([user.address])).to.be.revertedWith("Admin already exists!");

      // should throw err if empty list passed
      expect(workspaceRegistry.addQBAdmins([])).to.be.revertedWith("Error: addresses cannot be empty");

      const removeResult = await workspaceRegistry.removeQBAdmins([user.address]);
      expect(await workspaceRegistry.getQBAdmins()).to.not.include(user.address);

      const { events: removeEvents } = await removeResult.wait();
      if (removeEvents) {
        expect(removeEvents[0].event).to.equal("QBAdminsUpdated");
      }

      // should throw err if admin does not exist
      expect(workspaceRegistry.removeQBAdmins([user.address])).to.be.revertedWith("Admin does not exist!");

      // should throw err if empty list passed
      expect(workspaceRegistry.removeQBAdmins([])).to.be.revertedWith("Error: addresses cannot be empty");
    });

    it("should fail to update visibility if not admin", async () => {
      const user = await randomWallet();
      await creatingWorkpsace(workspaceRegistry);
      await expect(workspaceRegistry.connect(user).updateWorkspacesVisible([0], [true])).to.be.revertedWith(
        "Unauthorised: Not a QB admin",
      );
    });

    describe("Wallet Migration", () => {
      beforeEach(async () => {
        const applicationRegistryFactory = await ethers.getContractFactory("ApplicationRegistry");
        const applicationRegistry = <ApplicationRegistry>(
          await upgrades.deployProxy(applicationRegistryFactory, { kind: "uups" })
        );
        await applicationRegistry.setWorkspaceReg(workspaceRegistry.address);
        await workspaceRegistry.setApplicationReg(applicationRegistry.address);

        const applicationReviewRegistryFactory = await ethers.getContractFactory("ApplicationReviewRegistry");
        const applicationReviewRegistry = <ApplicationReviewRegistry>(
          await upgrades.deployProxy(applicationReviewRegistryFactory, { kind: "uups" })
        );
        await applicationReviewRegistry.setApplicationReg(applicationRegistry.address);
      });

      it("should migrate a wallet", async () => {
        /**
         * this owner will be:
         * 1. the owner of a workspace
         * 2. and a reviewer in another workspace
         *
         * the migration should remove this user from the workspace
         * and replace their existance there with a new wallet
         */
        const originalOwner = await randomWallet();
        const newOwnerAddressHex = randomEthAddress();
        const registry = workspaceRegistry.connect(originalOwner);
        // first workspace where the original owner is the owner
        await creatingWorkpsace(registry);

        // workspace ID = 1, where the original owner is a reviewer
        await creatingWorkpsace(workspaceRegistry);
        // original owner is a reviewer in workspace ID = 1
        await workspaceRegistry.updateWorkspaceMembers(1, [originalOwner.address], [1], [true], [""]);

        const tx = await registry.migrateWallet(originalOwner.address, newOwnerAddressHex);
        const result = await tx.wait();
        const events = result.events?.filter(e => e.event === "WorkspaceMemberMigrate");
        expect(events).to.have.length(2);

        const workspaceIds = [0, 1];
        for (const id of workspaceIds) {
          expect(await registry.isWorkspaceAdminOrReviewer(id, newOwnerAddressHex)).to.eq(true);

          expect(await registry.isWorkspaceAdminOrReviewer(id, originalOwner.address)).to.eq(false);
        }
      });

      it("should fail to migrate another user's wallet", async () => {
        const originalOwner = await randomWallet();
        const registry = workspaceRegistry.connect(originalOwner);
        // first workspace where the original owner is the owner
        await creatingWorkpsace(registry);

        const nonOwner = await randomWallet();
        await expect(
          registry.connect(nonOwner).migrateWallet(originalOwner.address, nonOwner.address),
        ).to.be.revertedWith("Only fromWallet/owner can migrate");
      });
    });
  });
});
