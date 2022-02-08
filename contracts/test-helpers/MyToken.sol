// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    // solhint-disable-next-line no-empty-blocks
    constructor() ERC20("MyToken", "MTK") {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
