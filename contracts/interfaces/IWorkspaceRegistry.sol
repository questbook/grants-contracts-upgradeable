// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

/// @title Interface of workspaceRegistry contract
interface IWorkspaceRegistry {
    /// @notice Returns a boolean value indicating whether specified address is owner of given workspace
    function isWorkspaceAdmin(uint96 _id, address _member) external view returns (bool);

    /// @notice Returns a boolean value indicating whether specified address is admin or reviewer of given workspace
    function isWorkspaceAdminOrReviewer(uint96 _id, address _member) external view returns (bool);
}
