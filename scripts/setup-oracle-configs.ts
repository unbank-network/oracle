import hre from "hardhat";
import { readFileSync } from "fs";
import { toBn } from "../utils/utils";
import { createConfigs } from "./common/create-configs";
import { configs } from "../scripts/configs/polygon";

const deploymentFilePath = `./deployments/${hre.network.name}.json`;

async function main() {
  console.log(`Found ${configs.tokenConfigs.length} configs.`);

  const detailedConfigs = await createConfigs(hre.ethers.provider, configs);
  await setConfigsOnOracle(configs.tokenConfigs, detailedConfigs);
}

const setConfigsOnOracle = async (
  inputConfigs: { [key: string]: any },
  detailedConfigs: { [key: string]: any }
) => {
  const toBeAddedUnderlyings = [];
  const toBeAddedConfigs = [];

  const deployments = JSON.parse(readFileSync(deploymentFilePath, "utf-8"));
  const oracles = deployments.Oracle;
  const oracle = oracles[oracles.length - 1];

  const OracleI = await hre.ethers.getContractAt("Oracle", oracle);

  // filter already set token configs
  for (let i = 0; i < inputConfigs.length; i++) {
    const exist = await OracleI.configExists(inputConfigs[i].underlying);
    if (!exist) {
      toBeAddedUnderlyings.push(inputConfigs[i].underlying);
      toBeAddedConfigs.push(detailedConfigs[i]);
    }
  }

  if (toBeAddedConfigs.length === 0) {
    console.log("No configs found to be added");
    return;
  }
  const estimatedGas = await OracleI.estimateGas._setConfigs(
    toBeAddedUnderlyings,
    toBeAddedConfigs
  );
  const tx = await OracleI._setConfigs(toBeAddedUnderlyings, toBeAddedConfigs, {
    gasLimit: toBn(estimatedGas.toString()).times(1.25).toFixed(0),
  });
  console.log(`Configs set in txn: ${tx.hash}`);
  await tx.wait();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
