import hre from "hardhat";
import { createConfigs } from "../scripts/common/create-configs";
import { numToWei, weiToNum } from "../utils/utils";

import { configs as inputConfigs } from "../scripts/configs/polygon";
import { Oracle } from "../typechain/Oracle";

describe("Forked", () => {
  let twapOracle: Oracle;

  before(async () => {
    const OracleC = await hre.ethers.getContractFactory("Oracle");
    twapOracle = (await OracleC.deploy(
      inputConfigs.baseAsset,
      numToWei("1", inputConfigs.basePriceDecimals)
    )) as Oracle;
    await twapOracle.deployed();
    console.log(`Oracle contract deployed at: ${twapOracle.address}`);
  });

  it("Should", async () => {
    const configs = await createConfigs(hre.ethers.provider, inputConfigs);
    // console.log(configs);
    configs.map((config) => {
      if (config.priceSource === "1") config.twapPeriod = "1";
    });
    const underlyings = inputConfigs.tokenConfigs.map(
      (tokenConfig) => tokenConfig.underlying
    );

    await twapOracle._setConfigs(underlyings, configs);
    await twapOracle.updatePrices(underlyings);

    const oraclePrices = [];
    for (let i = 0; i < underlyings.length; i++) {
      const priceRaw = await twapOracle.price(underlyings[i]);
      oraclePrices.push({
        symbol: underlyings[i],
        price: weiToNum(priceRaw, inputConfigs.basePriceDecimals),
      });
    }
    console.log("\nUnderlying Prices on oracle ==========================>");
    console.table(oraclePrices);
  }).timeout(100000000);
});
