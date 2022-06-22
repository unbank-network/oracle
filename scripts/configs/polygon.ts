export const configs = {
  baseAsset: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  UniswapV2Router: "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff",
  basePriceDecimals: "18",
  defaultTwapPeriod: "3600",
  tokenConfigs: [
    // base config - WMATIC/USDC
    {
      underlying: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      priceSource: "1",
      uniswapMarket: "0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827",
    },
    // USDC
    {
      underlying: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      priceSource: "0",
    },
    // SDT
    {
      underlying: "0xf2bB8cD51A4bdcf33f3a77E4cdCAbaAFcfa9ad5A",
      priceSource: "3",
    },
    // USB
    {
      underlying: "0x914f9E5644d78fd287fF36081544FcCFbdF31CAE",
      priceSource: "3",
    },
  ],

  cTokens: [
    "0x243415ce19991095b2105ba50d4cBa3D1de32695", //uUSDC
    "0x2f594C8eCb740231B0039E3D8A5BFd14225801E7", //uSDT
    "0x805F592De04c1913a2eB081e093eCE20ce9ba940", //uUSDC (USB instance)
    "0x7e8B4FE3e101E4838c1fdA1484E1e0E16168aF92", //uUSB
  ],
};
