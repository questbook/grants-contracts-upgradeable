// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

/// @title Interface of the applicationReviewRegistry contract
interface IApplicationReviewRegistry {
    /// @notice Sets the rubric for the application review for the specified grant
    function setRubrics(
        uint96 _workspaceId,
        address _grantAddress,
        string memory _metadataHash
    ) external;

    function migrateWallet(
        address fromWallet,
        address toWallet,
        uint96 appId
    ) external;
}
