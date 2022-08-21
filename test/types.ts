import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

declare module "mocha" {
  export interface Context {
    signers: Signers;
  }
}

export interface Signers {
  admin: SignerWithAddress;
  nonAdmin: SignerWithAddress;
  reviewer: SignerWithAddress;
  otherAdmin: SignerWithAddress;
  applicantAdmin: SignerWithAddress;
  erc20: SignerWithAddress;
  autoAssignReviewers: SignerWithAddress[];
  randomApplicants: SignerWithAddress[];
}
