// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./OracleConfig.sol";

import "./UniswapHelper.sol";
import "./IERC20Extended.sol";
import "./IExternalOracle.sol";
import "./PosterAccessControl.sol";

struct Observation {
    uint256 timestamp;
    uint256 acc;
}

contract Oracle is OracleConfig, PosterAccessControl {
    using FixedPoint for *;

    /// @notice The number of wei in 1 ETH
    uint256 public constant ethBaseUnit = 1e18;

    /// @notice A common scaling factor to maintain precision
    uint256 public constant expScale = 1e18;

    /// @notice The precision factor of base asset's (ETH) price
    uint256 public basePricePrecision;

    /// @notice The base asset address
    address public eth;

    /// @notice Official prices by address
    mapping(address => uint256) public prices;

    /// @notice The old observation for each token address
    mapping(address => Observation) public oldObservations;

    /// @notice The new observation for each token address
    mapping(address => Observation) public newObservations;

    /// @notice Stores underlying address for different cTokens
    mapping(address => address) public underlyings;

    /// @notice The event emitted when the stored price is updated
    event PriceUpdated(address underlying, uint256 price);

    /// @notice The event emitted when the uniswap window changes
    event UniswapWindowUpdated(
        address indexed underlying,
        uint256 oldTimestamp,
        uint256 newTimestamp,
        uint256 oldPrice,
        uint256 newPrice
    );

    /// @notice The event emitted when the cToken underlying mapping is updated
    event CTokenUnderlyingUpdated(address cToken, address underlying);

    constructor(address baseAsset_, uint256 basePricePrecision_) public {
        require(
            basePricePrecision_ <= ethBaseUnit,
            "basePricePrecision_ max limit exceeded"
        );

        eth = baseAsset_;
        basePricePrecision = basePricePrecision_;
    }

    function _setConfig(address underlying, TokenConfig memory config) public {
        // already performs some checks
        _setConfigInternal(underlying, config);

        if (config.priceSource == PriceSource.UNISWAP) {
            address uniswapMarket = config.uniswapMarket;
            require(uniswapMarket != address(0), "must have uni market");
            if (config.isPairWithStablecoin) {
                uint8 decimals;
                // verify precision of quote currency (stablecoin)
                if (IUniswapV2Pair(uniswapMarket).token0() == underlying) {
                    decimals = IERC20(IUniswapV2Pair(uniswapMarket).token1())
                        .decimals();
                } else {
                    decimals = IERC20(IUniswapV2Pair(uniswapMarket).token0())
                        .decimals();
                }
                require(
                    10**uint256(decimals) == basePricePrecision,
                    "basePricePrecision mismatch"
                );
            }
            uint256 cumulativePrice = currentCumulativePrice(config);
            oldObservations[underlying].timestamp = block.timestamp;
            newObservations[underlying].timestamp = block.timestamp;
            oldObservations[underlying].acc = cumulativePrice;
            newObservations[underlying].acc = cumulativePrice;
            emit UniswapWindowUpdated(
                underlying,
                block.timestamp,
                block.timestamp,
                cumulativePrice,
                cumulativePrice
            );
        }
        if (config.priceSource == PriceSource.EXTERNAL_ORACLE) {
            require(
                config.externalOracle != address(0),
                "must have external oracle"
            );
        }
    }

    function _setConfigs(
        address[] memory _underlyings,
        TokenConfig[] memory _configs
    ) external {
        require(_underlyings.length == _configs.length, "length mismatch");
        for (uint256 i = 0; i < _underlyings.length; i++) {
            _setConfig(_underlyings[i], _configs[i]);
        }
    }

    function _setPrice(address underlying, uint priceMantissa) external {
        require(msg.sender == poster, "Unauthorized");

        TokenConfig memory config = getTokenConfig(underlying);
        require(configExists(underlying), "token config not found");

        if (config.priceSource == PriceSource.POSTER) {
            prices[underlying] = priceMantissa;
            emit PriceUpdated(underlying, priceMantissa);
        }
    }

    function _setUnderlyingForCToken(address cToken, address underlying)
        public
    {
        require(msg.sender == admin, "Unauthorized");
        require(underlyings[cToken] == address(0), "underlying already exists");
        require(
            cToken != address(0) && underlying != address(0),
            "invalid input"
        );
        require(configExists(underlying), "token config not found");

        underlyings[cToken] = underlying;
        emit CTokenUnderlyingUpdated(cToken, underlying);
    }

    function _setUnderlyingForCTokens(
        address[] memory _cTokens,
        address[] memory _underlyings
    ) external {
        require(_cTokens.length == _underlyings.length, "length mismatch");
        for (uint256 i = 0; i < _cTokens.length; i++) {
            _setUnderlyingForCToken(_cTokens[i], _underlyings[i]);
        }
    }

    /**
     * @notice Get the official price for an underlying asset
     * @param underlying The address to fetch the price of
     * @return Price denominated in USD
     */
    function price(address underlying) public view returns (uint256) {
        return priceInternal(underlying);
    }

    function priceInternal(address underlying) internal view returns (uint256) {
        TokenConfig memory config = getTokenConfig(underlying);

        if (config.priceSource == PriceSource.UNISWAP)
            return prices[underlying];
        if (config.priceSource == PriceSource.ONE_USD)
            return basePricePrecision;
        if (config.priceSource == PriceSource.EXTERNAL_ORACLE) {
            uint8 oracleDecimals = IExternalOracle(config.externalOracle)
                .decimals();
            (, int256 answer, , , ) = IExternalOracle(config.externalOracle)
                .latestRoundData();
            require(answer > 0, "invalid answer");
            return
                mul(uint256(answer), basePricePrecision) /
                (10**uint256(oracleDecimals));
        }
        if (config.priceSource == PriceSource.POSTER)
            return prices[underlying];
    }

    /**
     * @notice Get the underlying price of a cToken
     * @dev Implements the PriceOracle interface for Compound v2.
     * @param cToken The cToken address for price retrieval
     * @return Price denominated in USD for the given cToken address
     */
    function getUnderlyingPrice(address cToken)
        external
        view
        returns (uint256)
    {
        address underlying = underlyings[cToken];
        TokenConfig memory config = getTokenConfig(underlying);

        // Comptroller needs prices in the format: ${raw price} * 1e(36 - baseUnit)
        uint256 factor = 1e36 / basePricePrecision;
        return mul(factor, priceInternal(underlying)) / config.baseUnit;
    }

    /**
     * @notice Update oracle prices
     * @param cToken The cToken address
     */
    function updatePrice(address cToken) external {
        address underlying = underlyings[cToken];
        if (underlying != address(0)) {
            updateUnderlyingPrice(underlying);
        }
    }

    /**
     * @notice Update oracle prices
     * @param underlying The underlying address
     */
    function updateUnderlyingPrice(address underlying) public {
        updateEthPrice();

        if (underlying != eth) {
            uint256 ethPrice = prices[eth];
            updatePriceInternal(underlying, ethPrice);
        }
    }

    /**
     * @notice Open function to update all prices
     */
    function updatePrices(address[] memory _underlyings) external {
        for (uint256 i = 0; i < _underlyings.length; i++) {
            updateUnderlyingPrice(_underlyings[i]);
        }
    }

    /**
     * @notice Update ETH price, and recalculate stored price by comparing to anchor
     */
    function updateEthPrice() public {
        uint256 ethPrice = fetchEthPrice();
        updatePriceInternal(eth, ethPrice);
    }

    function updatePriceInternal(address underlying, uint256 ethPrice)
        internal
    {
        TokenConfig memory config = getTokenConfig(underlying);

        if (config.priceSource == PriceSource.UNISWAP) {
            uint256 anchorPrice;
            if (underlying == eth) {
                anchorPrice = ethPrice;
            } else if (config.isPairWithStablecoin) {
                anchorPrice = fetchAnchorPrice(underlying, config, ethBaseUnit);
            } else {
                anchorPrice = fetchAnchorPrice(underlying, config, ethPrice);
            }

            prices[underlying] = anchorPrice;
            emit PriceUpdated(underlying, anchorPrice);
        }
    }

    /**
     * @dev Fetches the current token/quoteCurrency price accumulator from uniswap.
     */
    function currentCumulativePrice(TokenConfig memory config)
        internal
        view
        returns (uint256)
    {
        (
            uint256 cumulativePrice0,
            uint256 cumulativePrice1,

        ) = UniswapV2OracleLibrary.currentCumulativePrices(
                config.uniswapMarket
            );
        if (config.isUniswapReversed) {
            return cumulativePrice1;
        } else {
            return cumulativePrice0;
        }
    }

    /**
     * @dev Fetches the current eth/usd price from uniswap, with basePricePrecision as precision.
     *  Conversion factor is 1e18 for eth/usd market, since we decode uniswap price statically with 18 decimals.
     */
    function fetchEthPrice() internal returns (uint256) {
        return fetchAnchorPrice(eth, getTokenConfig(eth), ethBaseUnit);
    }

    /**
     * @dev Fetches the current token/usd price from uniswap, with basePricePrecision as precision.
     */
    function fetchAnchorPrice(
        address underlying,
        TokenConfig memory config,
        uint256 conversionFactor
    ) internal virtual returns (uint256) {
        (
            uint256 nowCumulativePrice,
            uint256 oldCumulativePrice,
            uint256 oldTimestamp
        ) = pokeWindowValues(underlying, config);

        // This should be impossible, but better safe than sorry
        require(block.timestamp > oldTimestamp, "now must come after before");
        uint256 timeElapsed = block.timestamp - oldTimestamp;

        // Calculate uniswap time-weighted average price
        // Underflow is a property of the accumulators: https://uniswap.org/audit.html#orgc9b3190
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
            uint224((nowCumulativePrice - oldCumulativePrice) / timeElapsed)
        );
        uint256 rawUniswapPriceMantissa = priceAverage.decode112with18();
        uint256 unscaledPriceMantissa = mul(
            rawUniswapPriceMantissa,
            conversionFactor
        );
        uint256 anchorPrice;

        // Adjust rawUniswapPrice according to the units of the non-ETH asset
        // In the case of ETH, we would have to scale by 1e6 / USDC_UNITS, but since baseUnit2 is 1e6 (USDC), it cancels

        // In the case of non-ETH tokens
        // a. pokeWindowValues already handled uniswap reversed cases, so priceAverage will always be Token/ETH TWAP price.
        // b. conversionFactor = ETH price * 1e6
        // unscaledPriceMantissa = priceAverage(token/ETH TWAP price) * expScale * conversionFactor
        // so ->
        // anchorPrice = priceAverage * tokenBaseUnit / ethBaseUnit * ETH_price * 1e6
        //             = priceAverage * conversionFactor * tokenBaseUnit / ethBaseUnit
        //             = unscaledPriceMantissa / expScale * tokenBaseUnit / ethBaseUnit
        anchorPrice =
            mul(unscaledPriceMantissa, config.baseUnit) /
            ethBaseUnit /
            expScale;
        return anchorPrice;
    }

    /**
     * @dev Get time-weighted average prices for a token at the current timestamp.
     *  Update new and old observations of lagging window if period elapsed.
     */
    function pokeWindowValues(address underlying, TokenConfig memory config)
        internal
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 cumulativePrice = currentCumulativePrice(config);
        Observation memory newObservation = newObservations[underlying];

        // Update new and old observations if elapsed time is greater than or equal to anchor period
        uint256 timeElapsed = block.timestamp - newObservation.timestamp;
        if (timeElapsed >= config.twapPeriod) {
            oldObservations[underlying].timestamp = newObservation.timestamp;
            oldObservations[underlying].acc = newObservation.acc;

            newObservations[underlying].timestamp = block.timestamp;
            newObservations[underlying].acc = cumulativePrice;
            emit UniswapWindowUpdated(
                underlying,
                newObservation.timestamp,
                block.timestamp,
                newObservation.acc,
                cumulativePrice
            );
        }
        return (
            cumulativePrice,
            oldObservations[underlying].acc,
            oldObservations[underlying].timestamp
        );
    }

    /// @dev Overflow proof multiplication
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "multiplication overflow");
        return c;
    }
}
