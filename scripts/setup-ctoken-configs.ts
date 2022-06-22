import hre from "hardhat";
import { readFileSync } from "fs";
import { configs } from "../scripts/configs/polygon";
import { abi } from "../utils/abis";

const deploymentFilePath = `./deployments/${hre.network.name}.json`;

async function main() {
  console.log(`Found ${configs.cTokens.length} CToken configs.`);

  const deployments = JSON.parse(readFileSync(deploymentFilePath, "utf-8"));
  const oracles = deployments.Oracle;
  const oracle = oracles[oracles.length - 1];

  const OracleI = await hre.ethers.getContractAt("Oracle", oracle);

  const cTokens = [];
  const underlyings = [];

  for (let i = 0; i < configs.cTokens.length; i++) {
    const cTokenAddr = configs.cTokens[i];
    const oracleUnderlying = await OracleI.underlyings(cTokenAddr);
    if (oracleUnderlying === hre.ethers.constants.AddressZero) {
      cTokens.push(configs.cTokens[i]);

      const CErc20I = new hre.ethers.Contract(
        cTokenAddr,
        abi.CErc20,
        hre.ethers.provider.getSigner()
      );
      const cTokenUnderlying = await CErc20I.underlying();
      underlyings.push(cTokenUnderlying);
    }
  }

  if (cTokens.length !== underlyings.length)
    throw Error("configs length mismatch");

  if (cTokens.length === 0) {
    console.log("No configs found to be added");
    return;
  }

  const tx = await OracleI._setUnderlyingForCTokens(cTokens, underlyings);
  console.log(`CToken Configs set in txn: ${tx.hash}`);
  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
