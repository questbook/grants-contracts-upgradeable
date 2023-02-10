// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.7;

import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";
import "@gnosis.pm/zodiac/contracts/guard/BaseGuard.sol";

interface IApplicationReviewRegistry {
    function reviews(address, uint96)
        external
        view
        returns (
            uint96,
            uint96,
            uint96,
            address,
            address,
            string memory,
            bool
        );
} // 0xc782342D667f8355869E9f5D23f245804aB10F56

interface IWorkspaceRegistry {
    function walletAddressToScwAddress(address) external view returns (address);
}

interface IApplicationRegistry {
    function applications(uint96)
        external
        view
        returns (
            uint96,
            uint96,
            address,
            address,
            uint48,
            uint48,
            string memory,
            uint96
        );

    function walletAddressMapping(bytes32) external view returns (address);
}

contract ReviewerTransactionGuard is BaseGuard {
    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    modifier onlySafe() {
        require(msg.sender == safeAddress, "Unauthorised: Not the Safe");
        _;
    }

    IApplicationRegistry public applicationReg =
        IApplicationRegistry(address(0x06c3C145F0879F969F2beb5d8DB1D25c83a7b7C2));
    IApplicationReviewRegistry public applicationReviewReg =
        IApplicationReviewRegistry(address(0xc782342D667f8355869E9f5D23f245804aB10F56));
    IWorkspaceRegistry public workspaceReg = IWorkspaceRegistry(address(0x4881fAB72dE0cBd58Bdc635EE9967d1de87EB5A2));

    address public owner;
    address public safeAddress;
    address[] public reviewers;
    uint96 public threshold;
    bytes4 public constant removeGuardBytesData = hex"e19a9dd9";
    bytes4 public constant multiSendBytesData = hex"8d80ff0a";

    // bytes4 public constant ENCODED_SIG_SET_GUARD = bytes4(keccak256("setGuard(address)")); // hex"e19a9dd9"
    // bytes4 public constant ENCODED_SIG_MULTI_SEND = bytes4(keccak256("")); // hex"8d80ff0a"

    constructor(
        address _safeAddress,
        address[] memory _reviewers,
        uint96 _threshold
    ) {
        require(_reviewers.length >= _threshold, "Threshold can't be greater than the number of reviewers");
        safeAddress = _safeAddress;
        reviewers = _reviewers;
        threshold = _threshold;
        owner = msg.sender;
    }

    function setWorkspaceReg(IWorkspaceRegistry _workspaceReg) external onlySafe {
        workspaceReg = _workspaceReg;
    }

    function setApplicationReg(IApplicationRegistry _applicationReg) external onlySafe {
        applicationReg = _applicationReg;
    }

    function setApplicationReviewReg(IApplicationReviewRegistry _applicationReviewReg) external onlySafe {
        applicationReviewReg = _applicationReviewReg;
    }

    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures,
        address msgSender
    ) external override {
        require(getFunctionSelector(data) != removeGuardBytesData, "This guard cannot be removed or changed!");
        // require(bytes4(data) != ENCODED_SIG_SET_GUARD, "This guard cannot be removed or changed!");

        // Allows policy changes and rejections
        if (to != safeAddress || to != address(this)) {
            uint96 appId;
            address applicantAddress;

            if (getFunctionSelector(data) == multiSendBytesData) {
                uint96 numTransfers = getApplicationId(data, 68) / 217;

                for (uint96 i = 0; i < numTransfers; i++) {
                    appId = getApplicationId(data, 32 + 221 + (i * 217));
                    applicantAddress = getPaymentAddress(data, 32 + 157 + (i * 217));

                    fetchReviews(appId, applicantAddress);
                }
            } else {
                appId = getApplicationId(data, 100);
                applicantAddress = getPaymentAddress(data, 36);

                fetchReviews(appId, applicantAddress);
            }
        }
    }

    function checkAfterExecution(bytes32 txHash, bool success) external override {}

    function fetchReviews(uint96 _appId, address _applicantPaymentAddress) public view {
        address applicantWalletAddress;
        (, , , applicantWalletAddress, , , , ) = applicationReg.applications(_appId);
        address applicantZerowalletAddress = applicationReg.walletAddressMapping(
            bytes32(uint256(uint160(_applicantPaymentAddress)))
        );

        require(
            applicantZerowalletAddress == applicantWalletAddress,
            "The proposal author, application and payment address have a mismatch"
        );

        uint96 k = 0;

        for (uint96 i = 0; i < reviewers.length; i++) {
            string memory metadataHash;
            address zerowalletAddress = workspaceReg.walletAddressToScwAddress(reviewers[i]);
            (, , , , , metadataHash, ) = applicationReviewReg.reviews(zerowalletAddress, _appId);
            if (bytes(metadataHash).length != 0) {
                ++k;
            }
        }

        require(k >= threshold, "The threshold to take a decision on this application has not been reached yet!");
    }

    function addReviewer(address _address) external onlySafe {
        reviewers.push(_address);
    }

    function removeReviewer(address _address) external onlySafe {
        for (uint96 i = 0; i < reviewers.length; i++) {
            if (reviewers[i] == _address) {
                reviewers[i] = reviewers[reviewers.length - 1];
                reviewers.pop();
                break;
            }
        }
    }

    function updateThreshold(uint96 _threshold) external onlySafe {
        threshold = _threshold;
    }

    function getApplicationId(bytes memory data, uint256 offset) internal pure returns (uint96 appId) {
        assembly {
            appId := mload(add(data, offset))
        }
    }

    function getFunctionSelector(bytes memory data) internal pure returns (bytes4 sel) {
        assembly {
            sel := mload(add(data, 32))
        }
    }

    function getPaymentAddress(bytes memory data, uint256 offset) internal pure returns (address addr) {
        assembly {
            addr := mload(add(data, offset))
        }
    }
}

contract ReviewerDeployer {
    ReviewerTransactionGuard[] public deployedContracts;
    uint256 public counter;

    function deploy(
        address _safeAddress,
        address[] memory _reviewers,
        uint96 _threshold
    ) public {
        ReviewerTransactionGuard dc = new ReviewerTransactionGuard(_safeAddress, _reviewers, _threshold);
        deployedContracts.push(dc);
        ++counter;
    }
}
