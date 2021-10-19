import { makeSuite, TestEnv } from './helpers/make-suite';
import {
  convertToCurrencyDecimals,
  buildFlashLiquidationAdapterParams,
} from '../../helpers/contracts-helpers';
import { getMockUniswapRouter } from '../../helpers/contracts-getters';
import { deployFlashLiquidationAdapter } from '../../helpers/contracts-deployments';
import { MockUniswapV2Router02 } from '../../types/MockUniswapV2Router02';
import BigNumber from 'bignumber.js';
import { DRE, evmRevert, evmSnapshot, increaseTime, waitForTx } from '../../helpers/misc-utils';
import { ethers } from 'ethers';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import { APPROVAL_AMOUNT_LENDING_POOL, MAX_UINT_AMOUNT, oneEther } from '../../helpers/constants';
import { getUserData } from './helpers/utils/helpers';
import { calcExpectedStableDebtTokenBalance } from './helpers/utils/calculations';
import { constants, utils } from 'ethers';
import { parseEther, formatEther } from '@ethersproject/units';
import AaveConfig from '../../markets/aave';
const { expect } = require('chai');

makeSuite('Uniswap adapters', (testEnv: TestEnv) => {
  let mockUniswapRouter: MockUniswapV2Router02;
  let evmSnapshotId: string;
  const { INVALID_HF, LP_LIQUIDATION_CALL_FAILED } = ProtocolErrors;
  const MOCK_CHAINLINK_AGGREGATORS_PRICES = AaveConfig.Mocks.AllAssetsInitialPrices;

  before(async () => {
    mockUniswapRouter = await getMockUniswapRouter();
  });

  const depositAndHFBelowOne = async () => {
    const { dai, weth, users, pool, oracle } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    //mints DAI to depositor
    await dai.connect(depositor.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access depositor wallet
    await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await pool
      .connect(depositor.signer)
      .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');
    //user 2 deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(await convertToCurrencyDecimals(weth.address, '1000'));

    //approve protocol to access the borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //user 2 borrows

    const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);
    const daiPrice = await oracle.getAssetPrice(dai.address);

    const amountDAIToBorrow = await convertToCurrencyDecimals(
      dai.address,
      new BigNumber(userGlobalDataBefore.availableBorrowsETH.toString())
        .div(daiPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(dai.address, amountDAIToBorrow, RateMode.Stable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.equal(
      '8250',
      INVALID_HF
    );

    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(1.18).toFixed(0)
    );

    const userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toFixed(0),
      INVALID_HF
    );
  };

  const depositSameAssetAndHFBelowOne = async () => {
    const { dai, weth, users, pool, oracle } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    //mints DAI to depositor
    await dai.connect(depositor.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access depositor wallet
    await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await pool
      .connect(depositor.signer)
      .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');
    //user 2 deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(await convertToCurrencyDecimals(weth.address, '1000'));

    //approve protocol to access the borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //user 2 borrows

    const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);
    const daiPrice = await oracle.getAssetPrice(dai.address);

    const amountDAIToBorrow = await convertToCurrencyDecimals(
      dai.address,
      new BigNumber(userGlobalDataBefore.availableBorrowsETH.toString())
        .div(daiPrice.toString())
        .multipliedBy(0.8)
        .toFixed(0)
    );
    await waitForTx(
      await pool
        .connect(borrower.signer)
        .borrow(dai.address, amountDAIToBorrow, RateMode.Stable, '0', borrower.address)
    );

    const userGlobalDataBefore2 = await pool.getUserAccountData(borrower.address);

    const amountWETHToBorrow = new BigNumber(userGlobalDataBefore2.availableBorrowsETH.toString())
      .multipliedBy(0.8)
      .toFixed(0);

    await pool
      .connect(borrower.signer)
      .borrow(weth.address, amountWETHToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.equal(
      '8250',
      INVALID_HF
    );

    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(1.18).toFixed(0)
    );

    const userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toFixed(0),
      INVALID_HF
    );
  };

  beforeEach(async () => {
    evmSnapshotId = await evmSnapshot();
  });

  afterEach(async () => {
    await evmRevert(evmSnapshotId);
  });

  describe('Flash Liquidation Adapter', () => {
    before('Before LendingPool liquidation: set config', () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
    });

    after('After LendingPool liquidation: reset config', () => {
      BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
    });

    describe('constructor', () => {
      it('should deploy with correct parameters', async () => {
        const { addressesProvider, weth } = testEnv;
        await deployFlashLiquidationAdapter([
          addressesProvider.address,
          mockUniswapRouter.address,
          weth.address,
        ]);
        console.log(`mockUniswapRouter: ${mockUniswapRouter.address}`);
        console.log(`weth: ${weth.address}`);
      });

      it('should revert if not valid addresses provider', async () => {
        const { weth } = testEnv;
        await expect(
          deployFlashLiquidationAdapter([
            mockUniswapRouter.address,
            mockUniswapRouter.address,
            weth.address,
          ])
        ).to.be.reverted;
      });
    });

    describe('executeOperation: succesfully liquidateCall and swap via Flash Loan with profits', () => {
      it('Liquidates the borrow with profit', async () => {
        await depositAndHFBelowOne();
        await increaseTime(100);

        const { dai, weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } =
          testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const expectedSwap = ethers.utils.parseEther('0.4');

        const liquidatorWethBalanceBefore = await weth.balanceOf(liquidator.address);

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (await mockUniswapRouter.setAmountToSwap(weth.address, expectedSwap)).wait();

        const collateralPrice = await oracle.getAssetPrice(weth.address);
        const principalPrice = await oracle.getAssetPrice(dai.address);
        const daiReserveDataBefore = await helpersContract.getReserveData(dai.address);
        const ethReserveDataBefore = await helpersContract.getReserveData(weth.address);
        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const collateralDecimals = (
          await helpersContract.getReserveConfigurationData(weth.address)
        ).decimals.toString();
        const principalDecimals = (
          await helpersContract.getReserveConfigurationData(dai.address)
        ).decimals.toString();
        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2).toFixed(0);

        const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
          .times(new BigNumber(amountToLiquidate).times(105))
          .times(new BigNumber(10).pow(collateralDecimals))
          .div(
            new BigNumber(collateralPrice.toString()).times(
              new BigNumber(10).pow(principalDecimals)
            )
          )
          .div(100)
          .decimalPlaces(0, BigNumber.ROUND_DOWN);

        const flashLoanDebt = new BigNumber(amountToLiquidate.toString())
          .multipliedBy(1.0009)
          .toFixed(0);

        const expectedProfit = ethers.BigNumber.from(expectedCollateralLiquidated.toString()).sub(
          expectedSwap
        );

        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          amountToLiquidate,
          false
        );
        const tx = await pool
          .connect(liquidator.signer)
          .flashLoan(
            flashLiquidationAdapter.address,
            [dai.address],
            [amountToLiquidate],
            [0],
            borrower.address,
            params,
            0
          );

        // Expect Swapped event
        await expect(Promise.resolve(tx)).to.emit(flashLiquidationAdapter, 'Swapped');

        // Expect LiquidationCall event
        await expect(Promise.resolve(tx)).to.emit(pool, 'LiquidationCall');

        const userReserveDataAfter = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );
        const liquidatorWethBalanceAfter = await weth.balanceOf(liquidator.address);

        const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
        const ethReserveDataAfter = await helpersContract.getReserveData(weth.address);

        if (!tx.blockNumber) {
          expect(false, 'Invalid block number');
          return;
        }
        const txTimestamp = new BigNumber(
          (await DRE.ethers.provider.getBlock(tx.blockNumber)).timestamp
        );

        const stableDebtBeforeTx = calcExpectedStableDebtTokenBalance(
          userReserveDataBefore.principalStableDebt,
          userReserveDataBefore.stableBorrowRate,
          userReserveDataBefore.stableRateLastUpdated,
          txTimestamp
        );

        const collateralAssetContractBalance = await weth.balanceOf(
          flashLiquidationAdapter.address
        );
        const borrowAssetContractBalance = await dai.balanceOf(flashLiquidationAdapter.address);

        expect(collateralAssetContractBalance).to.be.equal(
          '0',
          'Contract address should not keep any balance.'
        );
        expect(borrowAssetContractBalance).to.be.equal(
          '0',
          'Contract address should not keep any balance.'
        );

        expect(userReserveDataAfter.currentStableDebt.toString()).to.be.bignumber.almostEqual(
          stableDebtBeforeTx.minus(amountToLiquidate).toFixed(0),
          'Invalid user debt after liquidation'
        );

        //the liquidity index of the principal reserve needs to be bigger than the index before
        expect(daiReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
          daiReserveDataBefore.liquidityIndex.toString(),
          'Invalid liquidity index'
        );

        //the principal APY after a liquidation needs to be lower than the APY before
        expect(daiReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
          daiReserveDataBefore.liquidityRate.toString(),
          'Invalid liquidity APY'
        );

        expect(daiReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
          new BigNumber(daiReserveDataBefore.availableLiquidity.toString())
            .plus(flashLoanDebt)
            .toFixed(0),
          'Invalid principal available liquidity'
        );

        expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
          new BigNumber(ethReserveDataBefore.availableLiquidity.toString())
            .minus(expectedCollateralLiquidated)
            .toFixed(0),
          'Invalid collateral available liquidity'
        );

        // Profit after flash loan liquidation
        expect(liquidatorWethBalanceAfter).to.be.equal(
          liquidatorWethBalanceBefore.add(expectedProfit),
          'Invalid expected WETH profit'
        );
      });

      // new test cases
      it('check flashLiquidationAdapter.FLASHLOAN_PREMIUM_TOTAL() is equal to [9]', async () => {
        const EXP_VALUE = 9;
        const { flashLiquidationAdapter } = testEnv;
        expect(await flashLiquidationAdapter.FLASHLOAN_PREMIUM_TOTAL()).to.equal(EXP_VALUE);
      });

      // new test cases
      it('check flashLiquidationAdapter.MAX_SLIPPAGE_PERCENT() is equal to [3000]', async () => {
        const EXP_VALUE = 3000;
        const { flashLiquidationAdapter } = testEnv;
        expect(await flashLiquidationAdapter.MAX_SLIPPAGE_PERCENT()).to.equal(EXP_VALUE);
      });

      // new test cases
      it('check flashLiquidationAdapter.USD_ADDRESS() is equal to [0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96]', async () => {
        const EXP_VALUE = '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96';
        const { flashLiquidationAdapter } = testEnv;
        expect(await flashLiquidationAdapter.USD_ADDRESS()).to.equal(EXP_VALUE);
      });

      // new test cases
      it('check flashLiquidationAdapter.WETH_ADDRESS() is equal to [weth.address]', async () => {
        const { flashLiquidationAdapter, weth, oracle } = testEnv;
        const EXP_VALUE = weth.address;
        expect(await flashLiquidationAdapter.WETH_ADDRESS()).to.be.equal(EXP_VALUE);
      });

      // new test cases
      it('check flashLiquidationAdapter.oracle() is equal to [testEnv.oracle.address]', async () => {
        const { flashLiquidationAdapter, weth, oracle } = testEnv;
        const EXP_VALUE = oracle.address;
        expect(await flashLiquidationAdapter.ORACLE()).to.be.equal(EXP_VALUE);
      });

      // new test cases
      it('check flashLiquidationAdapter.UNISWAP_ROUTER() is equal to [mockUniswapRouter.address]', async () => {
        const { flashLiquidationAdapter } = testEnv;
        expect(await flashLiquidationAdapter.UNISWAP_ROUTER()).to.not.be.equal(
          constants.AddressZero
        );
        expect(await flashLiquidationAdapter.UNISWAP_ROUTER()).to.be.equal(
          mockUniswapRouter.address
        );
      });

      // new test case
      it('check oracle.getAssetPrice(weth.address), its value is equal to [MOCK_CHAINLINK_AGGREGATORS_PRICES.WETH]', async () => {
        const { dai, weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } =
          testEnv;
        expect(await oracle.getAssetPrice(weth.address)).to.be.equal(
          MOCK_CHAINLINK_AGGREGATORS_PRICES.WETH
        );
      });

      // new test case
      it('check oracle.getAssetPrice(dai.address), its value is equal to [MOCK_CHAINLINK_AGGREGATORS_PRICES.DAI]', async () => {
        const { dai, weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } =
          testEnv;
        expect(await oracle.getAssetPrice(dai.address)).to.be.equal(
          MOCK_CHAINLINK_AGGREGATORS_PRICES.DAI
        );
      });

      // new test case
      it('check helpersContract.getReserveData(dai.address), print all DAI.ReserveData', async () => {
        const { dai, weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } =
          testEnv;
        const daiReserveDataBefore = await helpersContract.getReserveData(dai.address);
        console.log(`availableLiquidity: ${daiReserveDataBefore.availableLiquidity}`);
        console.log(`totalStableDebt: ${daiReserveDataBefore.totalStableDebt}`);
        console.log(`totalVariableDebt: ${daiReserveDataBefore.totalVariableDebt}`);
        console.log(`liquidityRate: ${daiReserveDataBefore.liquidityRate}`);
        console.log(`variableBorrowRate: ${daiReserveDataBefore.variableBorrowRate}`);
        console.log(`stableBorrowRate: ${daiReserveDataBefore.stableBorrowRate}`);
        console.log(`averageStableBorrowRate: ${daiReserveDataBefore.averageStableBorrowRate}`);
        console.log(`liquidityIndex: ${daiReserveDataBefore.liquidityIndex}`);
        console.log(`variableBorrowIndex: ${daiReserveDataBefore.variableBorrowIndex}`);
        console.log(`lastUpdateTimestamp: ${daiReserveDataBefore.lastUpdateTimestamp}`);
      });

      // new test case
      it('check helpersContract.getReserveData(weth.address), print all WETH.ReserveData', async () => {
        const { dai, weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } =
          testEnv;
        const reserveData = await helpersContract.getReserveData(weth.address);
        console.log(`availableLiquidity: ${reserveData.availableLiquidity}`);
        console.log(`totalStableDebt: ${reserveData.totalStableDebt}`);
        console.log(`totalVariableDebt: ${reserveData.totalVariableDebt}`);
        console.log(`liquidityRate: ${reserveData.liquidityRate}`);
        console.log(`variableBorrowRate: ${reserveData.variableBorrowRate}`);
        console.log(`stableBorrowRate: ${reserveData.stableBorrowRate}`);
        console.log(`averageStableBorrowRate: ${reserveData.averageStableBorrowRate}`);
        console.log(`liquidityIndex: ${reserveData.liquidityIndex}`);
        console.log(`variableBorrowIndex: ${reserveData.variableBorrowIndex}`);
        console.log(`lastUpdateTimestamp: ${reserveData.lastUpdateTimestamp}`);
      });

      it('check userReserveData = getUserData(borrower.address), and print its result', async () => {
        const { dai, weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } =
          testEnv;
        const borrower = users[1];
        const userReserveData = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        console.log(`scaledATokenBalance: ${userReserveData.scaledATokenBalance}`);
        console.log(`currentATokenBalance: ${userReserveData.currentATokenBalance}`);
        console.log(`currentStableDebt: ${userReserveData.currentStableDebt}`);
        console.log(`currentVariableDebt: ${userReserveData.currentVariableDebt}`);
        console.log(`principalStableDebt: ${userReserveData.principalStableDebt}`);

        console.log(`scaledVariableDebt: ${userReserveData.scaledVariableDebt}`);
        console.log(`stableBorrowRate: ${userReserveData.stableBorrowRate}`);
        console.log(`liquidityRate: ${userReserveData.liquidityRate}`);
        console.log(`usageAsCollateralEnabled: ${userReserveData.usageAsCollateralEnabled}`);
        console.log(`stableRateLastUpdated: ${userReserveData.stableRateLastUpdated}`);
        console.log(`walletBalance: ${userReserveData.walletBalance}`);
      });

      it('check userReserveData = getUserData(liquidator.address), and print its result', async () => {
        const { dai, weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } =
          testEnv;
        const liquidator = users[3];
        const userReserveData = await getUserData(
          pool,
          helpersContract,
          dai.address,
          liquidator.address
        );

        console.log(`scaledATokenBalance: ${userReserveData.scaledATokenBalance}`);
        console.log(`currentATokenBalance: ${userReserveData.currentATokenBalance}`);
        console.log(`currentStableDebt: ${userReserveData.currentStableDebt}`);
        console.log(`currentVariableDebt: ${userReserveData.currentVariableDebt}`);
        console.log(`principalStableDebt: ${userReserveData.principalStableDebt}`);

        console.log(`scaledVariableDebt: ${userReserveData.scaledVariableDebt}`);
        console.log(`stableBorrowRate: ${userReserveData.stableBorrowRate}`);
        console.log(`liquidityRate: ${userReserveData.liquidityRate}`);
        console.log(`usageAsCollateralEnabled: ${userReserveData.usageAsCollateralEnabled}`);
        console.log(`stableRateLastUpdated: ${userReserveData.stableRateLastUpdated}`);
        console.log(`walletBalance: ${userReserveData.walletBalance}`);
      });
    });

    describe('executeOperation: succesfully liquidateCall with same asset via Flash Loan, but no swap needed', () => {
      it('Liquidates the borrow with profit', async () => {
        await depositSameAssetAndHFBelowOne();
        await increaseTime(100);

        const { weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];

        const liquidatorWethBalanceBefore = await weth.balanceOf(liquidator.address);

        const assetPrice = await oracle.getAssetPrice(weth.address);
        const ethReserveDataBefore = await helpersContract.getReserveData(weth.address);
        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          weth.address,
          borrower.address
        );

        const assetDecimals = (
          await helpersContract.getReserveConfigurationData(weth.address)
        ).decimals.toString();
        const amountToLiquidate = userReserveDataBefore.currentVariableDebt.div(2).toFixed(0);

        const expectedCollateralLiquidated = new BigNumber(assetPrice.toString())
          .times(new BigNumber(amountToLiquidate).times(105))
          .times(new BigNumber(10).pow(assetDecimals))
          .div(new BigNumber(assetPrice.toString()).times(new BigNumber(10).pow(assetDecimals)))
          .div(100)
          .decimalPlaces(0, BigNumber.ROUND_DOWN);

        const flashLoanDebt = new BigNumber(amountToLiquidate.toString())
          .multipliedBy(1.0009)
          .toFixed(0);

        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          weth.address,
          borrower.address,
          amountToLiquidate,
          false
        );
        const tx = await pool
          .connect(liquidator.signer)
          .flashLoan(
            flashLiquidationAdapter.address,
            [weth.address],
            [amountToLiquidate],
            [0],
            borrower.address,
            params,
            0
          );

        // Dont expect Swapped event due is same asset
        await expect(Promise.resolve(tx)).to.not.emit(flashLiquidationAdapter, 'Swapped');

        // Expect LiquidationCall event
        await expect(Promise.resolve(tx))
          .to.emit(pool, 'LiquidationCall')
          .withArgs(
            weth.address,
            weth.address,
            borrower.address,
            amountToLiquidate.toString(),
            expectedCollateralLiquidated.toString(),
            flashLiquidationAdapter.address,
            false
          );

        const borrowAssetContractBalance = await weth.balanceOf(flashLiquidationAdapter.address);

        expect(borrowAssetContractBalance).to.be.equal(
          '0',
          'Contract address should not keep any balance.'
        );
      });
    });

    describe('executeOperation: succesfully liquidateCall and swap via Flash Loan without profits', () => {
      it('Liquidates the borrow', async () => {
        await depositAndHFBelowOne();
        await increaseTime(100);

        const { dai, weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } =
          testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const liquidatorWethBalanceBefore = await weth.balanceOf(liquidator.address);

        const collateralPrice = await oracle.getAssetPrice(weth.address);
        const principalPrice = await oracle.getAssetPrice(dai.address);
        const daiReserveDataBefore = await helpersContract.getReserveData(dai.address);
        const ethReserveDataBefore = await helpersContract.getReserveData(weth.address);
        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const collateralDecimals = (
          await helpersContract.getReserveConfigurationData(weth.address)
        ).decimals.toString();
        const principalDecimals = (
          await helpersContract.getReserveConfigurationData(dai.address)
        ).decimals.toString();
        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2).toFixed(0);

        const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
          .times(new BigNumber(amountToLiquidate).times(105))
          .times(new BigNumber(10).pow(collateralDecimals))
          .div(
            new BigNumber(collateralPrice.toString()).times(
              new BigNumber(10).pow(principalDecimals)
            )
          )
          .div(100)
          .decimalPlaces(0, BigNumber.ROUND_DOWN);

        const flashLoanDebt = new BigNumber(amountToLiquidate.toString())
          .multipliedBy(1.0009)
          .toFixed(0);

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (
          await mockUniswapRouter.setAmountToSwap(
            weth.address,
            expectedCollateralLiquidated.toString()
          )
        ).wait();

        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          amountToLiquidate,
          false
        );
        const tx = await pool
          .connect(liquidator.signer)
          .flashLoan(
            flashLiquidationAdapter.address,
            [dai.address],
            [flashLoanDebt],
            [0],
            borrower.address,
            params,
            0
          );

        // Expect Swapped event
        await expect(Promise.resolve(tx)).to.emit(flashLiquidationAdapter, 'Swapped');

        // Expect LiquidationCall event
        await expect(Promise.resolve(tx)).to.emit(pool, 'LiquidationCall');

        const userReserveDataAfter = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );
        const liquidatorWethBalanceAfter = await weth.balanceOf(liquidator.address);

        const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
        const ethReserveDataAfter = await helpersContract.getReserveData(weth.address);

        if (!tx.blockNumber) {
          expect(false, 'Invalid block number');
          return;
        }
        const txTimestamp = new BigNumber(
          (await DRE.ethers.provider.getBlock(tx.blockNumber)).timestamp
        );

        const stableDebtBeforeTx = calcExpectedStableDebtTokenBalance(
          userReserveDataBefore.principalStableDebt,
          userReserveDataBefore.stableBorrowRate,
          userReserveDataBefore.stableRateLastUpdated,
          txTimestamp
        );

        const collateralAssetContractBalance = await dai.balanceOf(flashLiquidationAdapter.address);
        const borrowAssetContractBalance = await weth.balanceOf(flashLiquidationAdapter.address);

        expect(collateralAssetContractBalance).to.be.equal(
          '0',
          'Contract address should not keep any balance.'
        );
        expect(borrowAssetContractBalance).to.be.equal(
          '0',
          'Contract address should not keep any balance.'
        );
        expect(userReserveDataAfter.currentStableDebt.toString()).to.be.bignumber.almostEqual(
          stableDebtBeforeTx.minus(amountToLiquidate).toFixed(0),
          'Invalid user debt after liquidation'
        );

        //the liquidity index of the principal reserve needs to be bigger than the index before
        expect(daiReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
          daiReserveDataBefore.liquidityIndex.toString(),
          'Invalid liquidity index'
        );

        //the principal APY after a liquidation needs to be lower than the APY before
        expect(daiReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
          daiReserveDataBefore.liquidityRate.toString(),
          'Invalid liquidity APY'
        );

        expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
          new BigNumber(ethReserveDataBefore.availableLiquidity.toString())
            .minus(expectedCollateralLiquidated)
            .toFixed(0),
          'Invalid collateral available liquidity'
        );

        // Net Profit == 0 after flash loan liquidation
        expect(liquidatorWethBalanceAfter).to.be.equal(
          liquidatorWethBalanceBefore,
          'Invalid expected WETH profit'
        );
      });
    });

    describe('executeOperation: succesfully liquidateCall all available debt and swap via Flash Loan ', () => {
      it('Liquidates the borrow', async () => {
        await depositAndHFBelowOne();
        await increaseTime(100);

        const { dai, weth, users, pool, oracle, helpersContract, flashLiquidationAdapter } =
          testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const liquidatorWethBalanceBefore = await weth.balanceOf(liquidator.address);

        const collateralPrice = await oracle.getAssetPrice(weth.address);
        const principalPrice = await oracle.getAssetPrice(dai.address);
        const daiReserveDataBefore = await helpersContract.getReserveData(dai.address);
        const ethReserveDataBefore = await helpersContract.getReserveData(weth.address);
        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const collateralDecimals = (
          await helpersContract.getReserveConfigurationData(weth.address)
        ).decimals.toString();
        const principalDecimals = (
          await helpersContract.getReserveConfigurationData(dai.address)
        ).decimals.toString();
        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2).toFixed(0);
        const extraAmount = new BigNumber(amountToLiquidate).times('1.15').toFixed(0);

        const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
          .times(new BigNumber(amountToLiquidate).times(105))
          .times(new BigNumber(10).pow(collateralDecimals))
          .div(
            new BigNumber(collateralPrice.toString()).times(
              new BigNumber(10).pow(principalDecimals)
            )
          )
          .div(100)
          .decimalPlaces(0, BigNumber.ROUND_DOWN);

        const flashLoanDebt = new BigNumber(amountToLiquidate.toString())
          .multipliedBy(1.0009)
          .toFixed(0);

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (
          await mockUniswapRouter.setAmountToSwap(
            weth.address,
            expectedCollateralLiquidated.toString()
          )
        ).wait();

        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          MAX_UINT_AMOUNT,
          false
        );
        const tx = await pool
          .connect(liquidator.signer)
          .flashLoan(
            flashLiquidationAdapter.address,
            [dai.address],
            [extraAmount],
            [0],
            borrower.address,
            params,
            0
          );

        // Expect Swapped event
        await expect(Promise.resolve(tx)).to.emit(flashLiquidationAdapter, 'Swapped');

        // Expect LiquidationCall event
        await expect(Promise.resolve(tx)).to.emit(pool, 'LiquidationCall');

        const collateralAssetContractBalance = await dai.balanceOf(flashLiquidationAdapter.address);
        const borrowAssetContractBalance = await dai.balanceOf(flashLiquidationAdapter.address);

        expect(collateralAssetContractBalance).to.be.equal(
          '0',
          'Contract address should not keep any balance.'
        );
        expect(borrowAssetContractBalance).to.be.equal(
          '0',
          'Contract address should not keep any balance.'
        );
      });
    });

    describe('executeOperation: invalid params', async () => {
      it('Revert if debt asset is different than requested flash loan token', async () => {
        await depositAndHFBelowOne();

        const { dai, weth, users, pool, helpersContract, flashLiquidationAdapter } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const expectedSwap = ethers.utils.parseEther('0.4');

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (await mockUniswapRouter.setAmountToSwap(weth.address, expectedSwap)).wait();

        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2).toFixed(0);

        // Wrong debt asset
        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          weth.address, // intentionally bad
          borrower.address,
          amountToLiquidate,
          false
        );
        await expect(
          pool
            .connect(liquidator.signer)
            .flashLoan(
              flashLiquidationAdapter.address,
              [dai.address],
              [amountToLiquidate],
              [0],
              borrower.address,
              params,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');
      });

      it('Revert if debt asset amount to liquidate is greater than requested flash loan', async () => {
        await depositAndHFBelowOne();

        const { dai, weth, users, pool, helpersContract, flashLiquidationAdapter } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const expectedSwap = ethers.utils.parseEther('0.4');

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (await mockUniswapRouter.setAmountToSwap(weth.address, expectedSwap)).wait();

        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2);

        // Correct params
        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          amountToLiquidate.toString(),
          false
        );
        // Bad flash loan params: requested DAI amount below amountToLiquidate
        await expect(
          pool
            .connect(liquidator.signer)
            .flashLoan(
              flashLiquidationAdapter.address,
              [dai.address],
              [amountToLiquidate.div(2).toString()],
              [0],
              borrower.address,
              params,
              0
            )
        ).to.be.revertedWith(LP_LIQUIDATION_CALL_FAILED);
      });

      it('Revert if requested multiple assets', async () => {
        await depositAndHFBelowOne();

        const { dai, weth, users, pool, helpersContract, flashLiquidationAdapter } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const expectedSwap = ethers.utils.parseEther('0.4');

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (await mockUniswapRouter.setAmountToSwap(weth.address, expectedSwap)).wait();

        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2);

        // Correct params
        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          amountToLiquidate.toString(),
          false
        );
        // Bad flash loan params: requested multiple assets
        await expect(
          pool
            .connect(liquidator.signer)
            .flashLoan(
              flashLiquidationAdapter.address,
              [dai.address, weth.address],
              [10, 10],
              [0],
              borrower.address,
              params,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');
      });
    });
  });
});
