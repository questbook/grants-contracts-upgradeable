import { ethers } from "hardhat";
import { expect } from "chai";
import { generateKeyPairAndAddress, generateInputForAuthorisation } from "@questbook/anon-authoriser";
import type {} from "../src/types/hardhat";
import type { WorkspaceRegistry } from "../src/types";
import { creatingWorkpsace, deployWorkspaceContract, randomWallet } from "./utils";

describe("Unit tests", function () {
  describe("WorkspaceRegistry + Anon Authoriser", function () {
    let workspaceRegistry: WorkspaceRegistry;

    beforeEach(async () => {
      const anonAuthoriserFactory = await ethers.getContractFactory("AnonAuthoriser");
      const anonAuthoriser = await anonAuthoriserFactory.deploy();

      workspaceRegistry = await deployWorkspaceContract();
      await workspaceRegistry.updateAnonAuthoriserAddress(anonAuthoriser.address);
    });

    it("should create an invite using anon-authoriser", async () => {
      const workspaceId = 0;
      const role = 1;
      await creatingWorkpsace(workspaceRegistry);

      const { privateKey, address } = generateKeyPairAndAddress();
      await workspaceRegistry.createInviteLink(workspaceId, role, address);

      const invitee = await randomWallet();
      const sig = await generateInputForAuthorisation(invitee.address, await workspaceRegistry.address, privateKey);

      const result = await workspaceRegistry
        .connect(invitee)
        .joinViaInviteLink(workspaceId, "", role, sig.v, sig.r, sig.s);
      const data = await result.wait();
      // check event was correctly emitted
      const event = data.events?.find(e => e.event === "WorkspaceMemberUpdated");
      expect(event?.args?.member).to.eq(invitee.address);
    });

    it("should fail to join if already part of workspace", async () => {
      const workspaceId = 0;
      const role = 1;
      await creatingWorkpsace(workspaceRegistry);

      const { privateKey, address } = generateKeyPairAndAddress();
      await workspaceRegistry.createInviteLink(workspaceId, role, address);

      // the same user that created the workspace
      const [invitee] = await ethers.getSigners();
      const sig = await generateInputForAuthorisation(invitee.address, await workspaceRegistry.address, privateKey);

      await expect(
        workspaceRegistry.connect(invitee).joinViaInviteLink(workspaceId, "", role, sig.v, sig.r, sig.s),
      ).to.be.revertedWith("Already an admin");
    });

    it("should fail to create an invite from non-admin", async () => {
      const workspaceId = 0;
      const role = 1;
      await creatingWorkpsace(workspaceRegistry);

      const { address } = generateKeyPairAndAddress();

      const inviter = await randomWallet();

      await expect(workspaceRegistry.connect(inviter).createInviteLink(workspaceId, role, address)).to.be.revertedWith(
        "Unauthorised: Not an admin",
      );
    });

    it("should fail to join a different workspace using invite link", async () => {
      const workspaceId = 0;
      const workspaceId2 = 1;
      const role = 1;
      await creatingWorkpsace(workspaceRegistry);

      const { privateKey, address } = generateKeyPairAndAddress();
      await workspaceRegistry.createInviteLink(workspaceId, role, address);

      const invitee = await randomWallet();
      const sig = await generateInputForAuthorisation(invitee.address, await workspaceRegistry.address, privateKey);

      await expect(
        workspaceRegistry.connect(invitee).joinViaInviteLink(workspaceId2, "", role, sig.v, sig.r, sig.s),
      ).to.be.revertedWith("API flag mismatch");
    });

    it("should forbid another user from changing the anon-authoriser address", async () => {
      const user = await randomWallet();
      await expect(workspaceRegistry.connect(user).updateAnonAuthoriserAddress(user.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
  });
});
