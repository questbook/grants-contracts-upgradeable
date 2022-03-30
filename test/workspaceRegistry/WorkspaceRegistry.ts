import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { Signers } from "../types";
import { shouldBehaveLikeWorkspaceRegistry } from "./WorkspaceRegistry.behavior";

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
      const workspaceRegistryArtifact: Artifact = await artifacts.readArtifact("WorkspaceRegistry");
      this.workspaceRegistry = <WorkspaceRegistry>(
        await waffle.deployContract(this.signers.admin, workspaceRegistryArtifact, [])
      );
    });

    shouldBehaveLikeWorkspaceRegistry();
  });
});
