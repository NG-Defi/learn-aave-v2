import { TestEnv, makeSuite } from './helpers/make-suite';
import { deployDefaultReserveInterestRateStrategy } from '../../helpers/contracts-deployments';

import { APPROVAL_AMOUNT_LENDING_POOL, PERCENTAGE_FACTOR, RAY } from '../../helpers/constants';

import { rateStrategyStableOne } from '../../markets/aave/rateStrategies';

import { strategyDAI, strategyWETH } from '../../markets/aave/reservesConfigs';
import { AToken, DefaultReserveInterestRateStrategy, MintableERC20 } from '../../types';
import { WETH9Mocked } from '../../types/WETH9Mocked';
import BigNumber from 'bignumber.js';
import './helpers/utils/math';
import { formatEther } from '@ethersproject/units';

const { expect } = require('chai');

makeSuite('Interest rate strategy tests', (testEnv: TestEnv) => {
  let strategyInstance: DefaultReserveInterestRateStrategy;
  let dai: MintableERC20;
  let aDai: AToken;
  let weth: WETH9Mocked;
  let aWeth: AToken;

  before(async () => {
    dai = testEnv.dai;
    aDai = testEnv.aDai;
    weth = testEnv.weth;
    aWeth = testEnv.aWETH;

    const { addressesProvider } = testEnv;

    strategyInstance = await deployDefaultReserveInterestRateStrategy(
      [
        addressesProvider.address,
        rateStrategyStableOne.optimalUtilizationRate,
        rateStrategyStableOne.baseVariableBorrowRate,
        rateStrategyStableOne.variableRateSlope1,
        rateStrategyStableOne.variableRateSlope2,
        rateStrategyStableOne.stableRateSlope1,
        rateStrategyStableOne.stableRateSlope2,
      ],
      false
    );
  });

  it('Checks rates at 0% utilization rate, empty reserve, test for DAI', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](dai.address, aDai.address, 0, 0, 0, 0, 0, strategyDAI.reserveFactor);

    expect(currentLiquidityRate.toString()).to.be.equal('0', 'Invalid liquidity rate');
    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.039).times(RAY).toFixed(0),
      'Invalid stable rate'
    );
    expect(currentVariableBorrowRate.toString()).to.be.equal(
      rateStrategyStableOne.baseVariableBorrowRate,
      'Invalid variable rate'
    );
  });

  it('Checks rates at 0% utilization rate, empty reserve, test for WETH', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](weth.address, aWeth.address, 0, 0, 0, 0, 0, strategyWETH.reserveFactor);

    expect(currentLiquidityRate.toString()).to.be.equal('0', 'Invalid liquidity rate');
    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.03).times(RAY).toFixed(0),
      'Invalid stable rate'
    );
    expect(currentVariableBorrowRate.toString()).to.be.equal(
      rateStrategyStableOne.baseVariableBorrowRate,
      'Invalid variable rate'
    );
  });

  it('Checks rates at 80% utilization rate, for DAI', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](
      dai.address,
      aDai.address,
      '200000000000000000',
      '0',
      '0',
      '800000000000000000',
      '0',
      strategyDAI.reserveFactor
    );

    const expectedVariableRate = new BigNumber(rateStrategyStableOne.baseVariableBorrowRate).plus(
      rateStrategyStableOne.variableRateSlope1
    );

    console.log(`currentLiquidityRate in Percentage: ${formatEther(currentLiquidityRate)}`);
    console.log(`currentStableBorrowRate in Percentage: ${formatEther(currentStableBorrowRate)}`);
    console.log(
      `currentVariableBorrowRate in Percentage: ${formatEther(currentVariableBorrowRate)}`
    );

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedVariableRate
        .times(0.8)
        .percentMul(new BigNumber(PERCENTAGE_FACTOR).minus(strategyDAI.reserveFactor))
        .toFixed(0),
      'Invalid liquidity rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.039).times(RAY).plus(rateStrategyStableOne.stableRateSlope1).toFixed(0),
      'Invalid stable rate'
    );
  });

  it('Checks rates at 100% utilization rate', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](
      dai.address,
      aDai.address,
      '0',
      '0',
      '0',
      '800000000000000000',
      '0',
      strategyDAI.reserveFactor
    );

    console.log(`currentLiquidityRate in Percentage: ${formatEther(currentLiquidityRate)}`);
    console.log(`currentStableBorrowRate in Percentage : ${formatEther(currentStableBorrowRate)}`);
    console.log(
      `currentVariableBorrowRate in Percentage: ${formatEther(currentVariableBorrowRate)}`
    );

    const expectedVariableRate = new BigNumber(rateStrategyStableOne.baseVariableBorrowRate)
      .plus(rateStrategyStableOne.variableRateSlope1)
      .plus(rateStrategyStableOne.variableRateSlope2);

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedVariableRate
        .percentMul(new BigNumber(PERCENTAGE_FACTOR).minus(strategyDAI.reserveFactor))
        .toFixed(0),
      'Invalid liquidity rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.039)
        .times(RAY)
        .plus(rateStrategyStableOne.stableRateSlope1)
        .plus(rateStrategyStableOne.stableRateSlope2)
        .toFixed(0),
      'Invalid stable rate'
    );
  });

  it('Checks rates at 100% utilization rate, 50% stable debt and 50% variable debt, with a 10% avg stable rate', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](
      dai.address,
      aDai.address,
      '0',
      '0',
      '400000000000000000',
      '400000000000000000',
      '100000000000000000000000000',
      strategyDAI.reserveFactor
    );

    const expectedVariableRate = new BigNumber(rateStrategyStableOne.baseVariableBorrowRate)
      .plus(rateStrategyStableOne.variableRateSlope1)
      .plus(rateStrategyStableOne.variableRateSlope2);

    const expectedLiquidityRate = new BigNumber(
      currentVariableBorrowRate.add('100000000000000000000000000').div(2).toString()
    )
      .percentMul(new BigNumber(PERCENTAGE_FACTOR).minus(strategyDAI.reserveFactor))
      .toFixed(0);

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedLiquidityRate,
      'Invalid liquidity rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.039)
        .times(RAY)
        .plus(rateStrategyStableOne.stableRateSlope1)
        .plus(rateStrategyStableOne.stableRateSlope2)
        .toFixed(0),
      'Invalid stable rate'
    );
  });
});
