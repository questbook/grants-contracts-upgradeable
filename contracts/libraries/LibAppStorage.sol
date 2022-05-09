// SPDX-License-Identifier: MIT
pragma solidity >=0.8.1;

import { LibDiamond } from "../libraries/LibDiamond.sol";

/// @notice possible states of an application milestones
enum MilestoneState {
    Submitted,
    Requested,
    Approved
}

/// @notice possible states of an application
enum ApplicationState {
    Submitted,
    Resubmit,
    Approved,
    Rejected,
    Complete
}

/// @notice types of reward disbursals
enum DisbursalType {
    LockedAmount,
    P2P
}

/// @notice structure holding each application data
struct Application {
    uint96 id;
    uint96 workspaceId;
    address grant;
    address owner;
    uint48 milestoneCount;
    uint48 milestonesDone;
    string metadataHash;
    ApplicationState state;
}

/// @notice structure holding each workspace data
struct Workspace {
    uint96 id;
    address owner;
    string metadataHash;
}

struct Review {
    uint96 id;
    uint96 workspaceId;
    uint96 applicationId;
    address grant;
    address reviewer;
    string metadataHash;
    bool active;
}

struct GrantReviewState {
    address grant;
    uint96 workspaceId;
    uint96 numOfReviews;
    string rubricsMetadataHash;
}

struct AppStorage {
    uint96 applicationCount; // @notice Number of applications submitted
    mapping(uint96 => Application) applications; // @notice mapping to store applicationId along with application
    // @dev mapping to store application owner along with grant address
    // ex: for application id - 0, grant addr - 0x0
    // applicantGrant[0][0x0] will be = true, this is used to prevent duplicate entry
    mapping(address => mapping(address => bool)) applicantGrant;
    mapping(uint96 => mapping(uint48 => MilestoneState)) applicationMilestones; // @notice mapping to store applicationId along with milestones
    uint96 workspaceCount; // @notice Number of workspace stored in this registry
    mapping(uint96 => Workspace) workspaces; // @notice mapping to store workspaceId vs workspace data structure
    mapping(uint96 => mapping(address => bytes32)) memberRoles; // @notice mapping to store workspaceId vs members vs roles
    uint96 reviewCount; // @notice Number of reviews submitted
    mapping(address => mapping(uint96 => Review)) reviews; // @notice mapping to store reviewer address vs applicationId vs review
    mapping(address => GrantReviewState) grantReviewStates; // @notice mapping to store grant address vs grant review state
    mapping(uint96 => bool) reviewPaymentsStatus; // @notice mapping to store review id vs review payment status
    uint96 workspaceId; // @notice workspaceId to which the grant belongs
    uint96 numApplicants; // @notice number of submitted applicantions
    string metadataHash; // @notice grant metadata pointer to IPFS hash
    bool active; // @notice denotes if grant is receiving applications
}

library LibAppStorage {
    // function diamondStorage() internal pure returns (AppStorage storage ds) {
    //     assembly {
    //         ds.slot := 0
    //     }
    // }

    function abs(int256 x) internal pure returns (uint256) {
        return uint256(x >= 0 ? x : -x);
    }
}

contract ModifierFacets {
    AppStorage appStorage;

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }
}
