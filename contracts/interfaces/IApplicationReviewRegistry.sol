// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

/// @title Interface of the applicationReviewRegistry contract
interface IApplicationReviewRegistry {
    /// @notice Sets the rubric for the application review for the specified grant
    function setRubrics(
        uint96 _workspaceId,
        address _grantAddress,
        uint96 _numberOfReviewersPerApplication,
        string memory _metadataHash
    ) external;

    function assignReviewersRoundRobin(
        uint96 _workspaceId,
        uint96 _applicationId,
        address _grantAddress
    ) external;

    function hasAutoAssigningEnabled(address _grantAddress) external view returns (bool);

    function appendToApplicationList(uint96 _applicationId, address _grantAddress) external;

    function migrateWallet(
        address fromWallet,
        address toWallet,
        uint96 appId
    ) external;
}
