import hre from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { numToWei } from "../utils/utils";
import { configs } from "../scripts/configs/polygon";

const outputFilePath = `./deployments/${hre.network.name}.json`;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);

  const deployments = JSON.parse(readFileSync(outputFilePath, "utf-8"));
  const ContractName = "Oracle";

  const Oracle = await hre.ethers.getContractFactory(ContractName);
  const basePricePrecision = numToWei("1", configs.basePriceDecimals);
  const oracle = await Oracle.deploy(configs.baseAsset, basePricePrecision);
  console.log(`${ContractName} deployed to:`, oracle.address);

  if (!deployments[ContractName]) deployments[ContractName] = [];
  deployments[ContractName].push(oracle.address);
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));

  await oracle.deployTransaction.wait(15);
  await verifyContract(oracle.address, [configs.baseAsset, basePricePrecision]);
}

const verifyContract = async (
  contractAddress: string,
  constructorArgs: any[]
) => {
  await hre.run("verify:verify", {
    address: contractAddress,
    constructorArguments: constructorArgs,
  });
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
