import hre from "hardhat";
import { readFileSync } from "fs";
import { abi } from "../utils/abis";
import { weiToNum } from "../utils/utils";
import { configs } from "../scripts/configs/polygon";

const deploymentFilePath = `./deployments/${hre.network.name}.json`;

async function main() {
  const deployments = JSON.parse(readFileSync(deploymentFilePath, "utf-8"));
  const oracles = deployments.Oracle;
  const oracle = oracles[oracles.length - 1];
  const OracleI = await hre.ethers.getContractAt("Oracle", oracle);

  const numConfigs = Number(await OracleI.numTokens());
  console.log("\nTotal configs:", numConfigs);

  const oraclePrices = [];

  for (let i = 0; i < configs.tokenConfigs.length; i++) {
    const underlyingAddr = configs.tokenConfigs[i].underlying;
    const Erc20I = new hre.ethers.Contract(
      underlyingAddr,
      abi.Erc20,
      hre.ethers.provider
    );

    const [priceRaw, symbol] = await Promise.all([
      OracleI.price(underlyingAddr),
      Erc20I.symbol(),
    ]);
    oraclePrices.push({
      symbol: symbol,
      price: weiToNum(priceRaw, configs.basePriceDecimals),
    });
  }
  console.log("\nUnderlying Prices on oracle ==========================>");
  console.table(oraclePrices);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
