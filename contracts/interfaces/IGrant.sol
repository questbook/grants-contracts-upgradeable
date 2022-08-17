// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

/// @title Interface of the grant contract
interface IGrant {
    /// @notice Returns a boolean value indicating whether a grant is active
    function active() external view returns (bool);

    /// @notice It increments number of applicants against the grant
    /// and is invoked at the time of submitting application
    function incrementApplicant() external;

    /// @notice It disburses reward to application owner using locked funds
    function disburseReward(
        uint96 _applicationId,
        uint96 _milestoneId,
        address _asset,
        uint256 _amount,
        address _sender
    ) external;

    /// @notice It disburses reward to application owner P2P from workspace admin wallet
    function disburseRewardP2P(
        uint96 _applicationId,
        uint96 _milestoneId,
        address _asset,
        uint256 _amount,
        address _sender
    ) external;

    /// @notice Return the workspace id to which the grant belongs
    function workspaceId() external view returns (uint96);

    /// @notice Update grant
    function updateGrant(string memory _metadataHash) external;
}
