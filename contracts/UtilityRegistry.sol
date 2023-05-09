// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUtilityRegistry.sol";
import "hardhat/console.sol";

contract UtilityRegistry is Initializable, UUPSUpgradeable, OwnableUpgradeable, IUtilityRegistry {
    struct Profile {
        address profileAddress;
        string metadataHash;
        uint256 timestamp;
    }

    mapping(address => Profile) public profiles;

    event ProfileCreated(address indexed profileAddress, string metadataHash, uint256 timestamp);

    event ProfileUpdated(address indexed profileAddress, string metadataHash, uint256 timestamp);

    /**
     * @notice Calls initialize on the base contracts
     *
     * @dev This acts as a constructor for the upgradeable proxy contract
     */
    function initialize() external initializer {
        __Ownable_init();
    }

    /**
     * @notice Override of UUPSUpgradeable virtual function
     *
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(address) internal view override onlyOwner {}

    function createProfile(string memory metadataHash) external override {
        if (profiles[msg.sender].profileAddress == address(0)) {
            profiles[msg.sender] = Profile(msg.sender, metadataHash, block.timestamp);
            emit ProfileCreated(msg.sender, metadataHash, block.timestamp);
        } else {
            updateProfile(metadataHash);
        }
    }

    function updateProfile(string memory metadataHash) public override {
        require(profiles[msg.sender].profileAddress == msg.sender, "You cannot modify this profile");
        profiles[msg.sender].metadataHash = metadataHash;
        profiles[msg.sender].timestamp = block.timestamp;
        emit ProfileUpdated(msg.sender, metadataHash, block.timestamp);
    }

    function getAddress(bytes memory data) external pure override returns (address addr) {
        assembly {
            addr := mload(add(data, 32))
        }
    }

    function splitSignature(bytes memory sig) external pure override returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
