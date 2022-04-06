import { artifacts, ethers, upgrades, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { Grant } from "../../src/types/Grant";
import type { ApplicationRegistry } from "../../src/types/ApplicationRegistry";
import type { WorkspaceRegistry } from "../../src/types/WorkspaceRegistry";
import { Signers } from "../types";
import { shouldBehaveLikeGrant } from "./Grant.behavior";
import { expect } from "chai";

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.nonAdmin = signers[1];
    this.signers.erc20 = signers[2];
    this.signers.reviewer = signers[3];
  });

  describe("Grant", function () {
    beforeEach(async function () {
      this.workspaceRegistryFactory = await ethers.getContractFactory("WorkspaceRegistry");
      this.workspaceRegistry = <WorkspaceRegistry>(
        await upgrades.deployProxy(this.workspaceRegistryFactory, { kind: "uups" })
      );

      await this.workspaceRegistry.connect(this.signers.admin).createWorkspace("dummyWorkspaceIpfsHash");

      const applicationRegistryFactory = await ethers.getContractFactory("ApplicationRegistry");
      this.applicationRegistry = <ApplicationRegistry>(
        await upgrades.deployProxy(applicationRegistryFactory, { kind: "uups" })
      );

      await this.applicationRegistry.connect(this.signers.admin).setWorkspaceReg(this.workspaceRegistry.address);

      this.grantFactory = await ethers.getContractFactory("Grant");
      this.grant = <Grant>(
        await upgrades.deployProxy(
          this.grantFactory,
          [
            0,
            "dummyGrantIpfsHash",
            this.workspaceRegistry.address,
            this.applicationRegistry.address,
            this.signers.admin.address,
          ],
          { kind: "uups" },
        )
      );

      this.grantFactoryV2 = await ethers.getContractFactory("GrantV2");

      const erc20Artifact: Artifact = await artifacts.readArtifact(
        "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      );
      this.mockERC20 = await waffle.deployMockContract(this.signers.admin, erc20Artifact.abi);
    });

    it("test proxy deployment", async function () {
      const grantv2 = await upgrades.upgradeProxy(this.grant.address, this.grantFactoryV2);
      expect(await grantv2.version()).to.equal("v2!");
    });

    shouldBehaveLikeGrant();
  });
});
