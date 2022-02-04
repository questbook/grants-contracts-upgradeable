import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { Grant } from "../../src/types/Grant";
import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { Signers } from "../types";
import { shouldBehaveLikeGrant } from "./Grant.behavior";

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.nonAdmin = signers[1];
    this.signers.erc20 = signers[2];
  });

  describe("Grant", function () {
    beforeEach(async function () {
      const workspaceRegistryArtifact: Artifact = await artifacts.readArtifact("WorkspaceRegistry");
      this.workspaceRegistry = <WorkspaceRegistry>(
        await waffle.deployContract(this.signers.admin, workspaceRegistryArtifact, [])
      );

      await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyWorkspaceIpfsHash");

      const applicationRegistryArtifact: Artifact = await artifacts.readArtifact("ApplicationRegistry");
      this.applicationRegistry = <ApplicationRegistry>(
        await waffle.deployContract(this.signers.admin, applicationRegistryArtifact, [])
      );

      await this.applicationRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);

      const grantArtifact: Artifact = await artifacts.readArtifact("Grant");
      this.grant = <Grant>(
        await waffle.deployContract(this.signers.admin, grantArtifact, [
          0,
          "dummyGrantIpfsHash",
          this.workspaceRegistry.address,
          this.applicationRegistry.address,
        ])
      );

      const erc20Artifact: Artifact = await artifacts.readArtifact(
        "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      );
      this.mockERC20 = await waffle.deployMockContract(this.signers.admin, erc20Artifact.abi);
    });

    shouldBehaveLikeGrant();
  });
});
