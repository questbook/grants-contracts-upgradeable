// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

contract Gasless {
    
    function _msgSender(bytes32 txHash, uint8 v, bytes32 r, bytes32 s) internal pure returns(address){
        return ecrecover(txHash, v, r, s);
    }

    function _verifyTX(bytes memory paramsEncoded, bytes32 txHash) internal pure  {
        
        // calculate the hash of the encoded params
        bytes32 paramsHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", 
        toString(paramsEncoded.length), paramsEncoded));

        require(paramsHash == txHash, "Signature and payload are not consistent");
    }

    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}