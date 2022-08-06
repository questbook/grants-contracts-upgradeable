// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

/// @title Interface of the applicationRegistry contract
interface IApplicationRegistry {
    /// @notice Returns owner of application using specified application id
    function getApplicationOwner(uint96 _applicationId) external view returns (address);

    /// @notice returns application workspace id
    function getApplicationWorkspace(uint96 _applicationId) external view returns (uint96);

    /// @notice returns application grant address
    function getApplicationGrant(uint96 _applicationId) external view returns (address);
}
