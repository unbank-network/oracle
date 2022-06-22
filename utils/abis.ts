export const abi = {
  Erc20: [
    `function decimals() public view returns (uint8)`,
    `function symbol() public view returns (string)`,
  ],
  UniV2Router: [
    `function WETH() public view returns (address)`,
    `function factory() public view returns (address)`,
  ],
  UniV2Factory: [
    `function getPair(address, address) public view returns (address)`,
  ],
  UniV2Pair: [
    `function token0() public view returns (address)`,
    `function token1() public view returns (address)`,
  ],
  CErc20: [`function underlying() public view returns (address)`],
};
