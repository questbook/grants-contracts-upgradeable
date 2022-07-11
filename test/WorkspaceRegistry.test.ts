import { ethers, upgrades } from "hardhat";
import type {} from "../src/types/hardhat";
import type { WorkspaceRegistry, WorkspaceRegistryV2__factory } from "../src/types";
import { expect } from "chai";
import { randomBytes } from "crypto";
import { creatingWorkpsace, deployWorkspaceContract, randomWallet } from "./utils";

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

      const result = await workspaceRegistry.updateWorkspaceSafe(0, safeAddress, safeChainId);
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
        workspaceRegistry.connect(updater).updateWorkspaceSafe(workspaceId, randomBytes(32), 1),
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
  });
});
