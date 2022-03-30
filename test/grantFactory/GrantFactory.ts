import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { GrantFactory } from "../../src/types/GrantFactory";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";

import { Signers } from "../types";
import { shouldBehaveLikeGrantFactory } from "./GrantFactory.behavior";

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.nonAdmin = signers[1];
    this.signers.reviewer = signers[2];
  });

  describe("GrantFactory", function () {
    beforeEach(async function () {
      const workspaceRegistryArtifact: Artifact = await artifacts.readArtifact("WorkspaceRegistry");
      this.workspaceRegistry = <WorkspaceRegistry>(
        await waffle.deployContract(this.signers.admin, workspaceRegistryArtifact, [])
      );

      await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyIpfsHash");

      const grantFactoryArtifact: Artifact = await artifacts.readArtifact("GrantFactory");
      this.grantFactory = <GrantFactory>await waffle.deployContract(this.signers.admin, grantFactoryArtifact, []);

      const applicationRegistryArtifact: Artifact = await artifacts.readArtifact("ApplicationRegistry");
      this.applicationRegistry = <ApplicationRegistry>(
        await waffle.deployContract(this.signers.admin, applicationRegistryArtifact, [])
      );
    });

    shouldBehaveLikeGrantFactory();
  });
});
