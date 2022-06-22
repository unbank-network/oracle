import { BigNumber } from "bignumber.js";
import { ethers } from "ethers";
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN });

export const toBn = (num: BigNumber.Value | ethers.BigNumber): BigNumber => {
  return new BigNumber(num.toString());
};

export const toFixed = (num: BigNumber.Value | ethers.BigNumber): string => {
  return toBn(num).toFixed();
};

export const weiToNum = (
  amount: BigNumber.Value | ethers.BigNumber,
  decimals: BigNumber.Value | ethers.BigNumber
): string => {
  return toBn(amount)
    .div(toBn(10).pow(toBn(decimals)))
    .toFixed();
};

export const numToWei = (
  amount: BigNumber.Value | ethers.BigNumber,
  decimals: BigNumber.Value | ethers.BigNumber
): string => {
  return toBn(amount)
    .times(toBn(10).pow(toBn(decimals)))
    .toFixed(0, 1); // rounding mode: Round_down
};
