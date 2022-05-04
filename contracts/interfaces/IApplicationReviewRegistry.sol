// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

/// @title Interface of the applicationReviewRegistry contract
interface IApplicationReviewRegistry {
    /// @notice Sets the rubric for the application review for the specified grant
    function setRubrics(
        uint96 _workspaceId,
        address _grantAddress,
        string memory _metadataHash
    ) external;
}
