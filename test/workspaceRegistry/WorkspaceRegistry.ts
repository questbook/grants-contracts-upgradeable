import { ethers, upgrades } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { Signers } from "../types";
import { shouldBehaveLikeWorkspaceRegistry } from "./WorkspaceRegistry.behavior";
import { expect } from "chai";

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.nonAdmin = signers[1];
    this.signers.reviewer = signers[2];
    this.signers.otherAdmin = signers[3];
  });

  describe("WorkspaceRegistry", function () {
    beforeEach(async function () {
      this.workspaceRegistryFactory = await ethers.getContractFactory("WorkspaceRegistry");
      this.workspaceRegistry = <WorkspaceRegistry>(
        await upgrades.deployProxy(this.workspaceRegistryFactory, { kind: "uups" })
      );
      this.workspaceRegistryFactoryV2 = await ethers.getContractFactory("WorkspaceRegistryV2");
    });

    it("test proxy deployment", async function () {
      const workspaceRegistryv2 = await upgrades.upgradeProxy(
        this.workspaceRegistry.address,
        this.workspaceRegistryFactoryV2,
      );
      expect(await workspaceRegistryv2.version()).to.equal("v2!");
    });

    shouldBehaveLikeWorkspaceRegistry();
  });
});
