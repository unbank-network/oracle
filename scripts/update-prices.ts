import hre from "hardhat";
import { readFileSync } from "fs";
import { toBn } from "../utils/utils";
import { configs } from "../scripts/configs/polygon";

const deploymentFilePath = `./deployments/${hre.network.name}.json`;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);

  const deployments = JSON.parse(readFileSync(deploymentFilePath, "utf-8"));
  const oracles = deployments.Oracle;
  const oracle = oracles[oracles.length - 1];
  const OracleI = await hre.ethers.getContractAt("Oracle", oracle);

  const underlyings = configs.tokenConfigs.map(
    (tokenConfig) => tokenConfig.underlying
  );

  const estimatedGas = await OracleI.estimateGas.updatePrices(underlyings);
  const tx = await OracleI.updatePrices(underlyings, {
    gasLimit: toBn(estimatedGas).times(1.25).toFixed(0),
  });
  console.log(`Txn: ${tx.hash}`);
  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
