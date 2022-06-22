// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./Administrable.sol";

contract OracleConfig is Administrable {
    /// @dev Describe how to interpret the fixedPrice in the TokenConfig.
    enum PriceSource {
        ONE_USD, /// implies the price is 1 USD
        UNISWAP, /// implies the price is fetched from uniswap
        EXTERNAL_ORACLE, /// implies the price is read externally
        POSTER  /// implies the price is posted externally
    }

    /// @dev Describe how the USD price should be determined for an asset.
    ///  There should be 1 TokenConfig object for each supported asset.
    struct TokenConfig {
        uint256 baseUnit;
        uint256 twapPeriod;
        address uniswapMarket;
        bool isUniswapReversed;
        bool isPairWithStablecoin;
        address externalOracle;
        PriceSource priceSource;
    }

    /// @notice The number of tokens this contract currently supports
    uint256 public numTokens;

    mapping(address => TokenConfig) internal tokenConfigs;

    function _setConfigInternal(address underlying, TokenConfig memory config)
        internal
    {
        require(msg.sender == admin, "unauthorized");
        require(tokenConfigs[underlying].baseUnit == 0, "config exists");
        require(config.baseUnit != 0, "invalid config");

        tokenConfigs[underlying] = config;
        numTokens++;
    }

    /**
     * @notice Get the config for an underlying asset
     * @param underlying The address of the underlying asset of the config to get
     * @return config The config object
     */
    function getTokenConfig(address underlying)
        public
        view
        returns (TokenConfig memory config)
    {
        require(configExists(underlying), "token config not found");
        config = tokenConfigs[underlying];
    }

    /**
     * @notice Get if the config for an underlying asset exists
     * @param underlying The address of the underlying asset of the config
     * @return exists boolean result
     */
    function configExists(address underlying)
        public
        view
        returns (bool exists)
    {
        TokenConfig memory config = tokenConfigs[underlying];
        exists = config.baseUnit != 0 ? true : false;
    }
}
