import { ethers } from "ethers";
import { numToWei } from "../../utils/utils";
import { abi } from "../../utils/abis";

export const createConfigs = async (
  provider: ethers.providers.BaseProvider,
  inputConfigs: { [key: string]: any }
) => {
  const tokenConfigs = inputConfigs.tokenConfigs;
  const detailedConfigs = [];
  for (let i = 0; i < tokenConfigs.length; i++) {
    const tokenConfig = await createConfig(
      provider,
      tokenConfigs[i],
      inputConfigs
    );
    detailedConfigs.push(tokenConfig);
  }
  return detailedConfigs;
};

const createConfig = async (
  provider: ethers.providers.Provider,
  config: any,
  inputConfigs: any
) => {
  const tokenConfig = {
    baseUnit: "",
    twapPeriod: "0",
    priceSource: "",
    uniswapMarket: ethers.constants.AddressZero,
    isUniswapReversed: false,
    isPairWithStablecoin: false,
    externalOracle: ethers.constants.AddressZero,
  };

  const Erc20I = new ethers.Contract(config.underlying, abi.Erc20, provider);
  const erc20Decimals = await Erc20I.decimals();
  tokenConfig.baseUnit = numToWei("1", erc20Decimals);

  if (!config.priceSource)
    throw Error(`priceSource not specified for ${config.underlying}`);
  tokenConfig.priceSource = config.priceSource;

  switch (tokenConfig.priceSource) {
    // ONE_USD
    case "0": {
      // nothing needs to be done here for now
      break;
    }

    // UNISWAP
    case "1": {
      tokenConfig.twapPeriod =
        config.twapPeriod || inputConfigs.defaultTwapPeriod;

      const RouterI = new ethers.Contract(
        inputConfigs.UniswapV2Router,
        abi.UniV2Router,
        provider
      );
      let weth;
      try {
        weth = await RouterI.WETH();
      } catch (e) {
        const tempAbi = [
          `function ${inputConfigs.baseAsset}() view returns (address)`,
        ];
        const TempRouterI = new ethers.Contract(
          inputConfigs.UniswapV2Router,
          tempAbi,
          provider
        );
        weth = await TempRouterI[`${inputConfigs.baseAsset}()`]();
      }

      if (config.uniswapMarket) {
        tokenConfig.uniswapMarket = config.uniswapMarket;
      } else {
        const factory = await RouterI.factory();
        const FactoryI = new ethers.Contract(
          factory,
          abi.UniV2Factory,
          provider
        );
        const pair = await FactoryI.getPair(weth, config.underlying);
        if (pair === ethers.constants.AddressZero)
          throw Error(`pair not found for ${config.underlying}`);
        tokenConfig.uniswapMarket = pair;
      }
      const PairI = new ethers.Contract(
        tokenConfig.uniswapMarket,
        abi.UniV2Pair,
        provider
      );
      const token0 = await PairI.token0();
      const token1 = await PairI.token1();

      // isUniswapReversed is true when token1 === underlying
      tokenConfig.isUniswapReversed =
        token1.toLowerCase() === config.underlying.toLowerCase();

      if (
        weth.toLowerCase() !== token0.toLowerCase() &&
        weth.toLowerCase() !== token1.toLowerCase()
      ) {
        tokenConfig.isPairWithStablecoin = true;
      }
      break;
    }

    // EXTERNAL_ORACLE
    case "2": {
      if (!config.externalOracle)
        throw Error(`externalOracle not provided for ${config.underlying}`);
      tokenConfig.externalOracle = config.externalOracle;
      break;
    }

    // POSTER
    case '3': {
      // nothing needs to be done here for now
      break;
    }

    default: {
      throw Error(`invalid priceSource for ${config.underlying}`);
    }
  }

  return tokenConfig;
};
