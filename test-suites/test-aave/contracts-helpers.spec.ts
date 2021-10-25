import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ProtocolErrors, eContractid } from '../../helpers/types';
import { deployContract, getContract, getCurrentBlock } from '../../helpers/contracts-helpers';
import { MockAToken } from '../../types/MockAToken';
import { MockStableDebtToken } from '../../types/MockStableDebtToken';
import { MockVariableDebtToken } from '../../types/MockVariableDebtToken';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAToken,
  getMockStableDebtToken,
  getMockVariableDebtToken,
  getStableDebtToken,
  getVariableDebtToken,
  getFirstSigner,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
  getLendingPool,
  getPriceOracle,
  getMintableERC20,
  getIErc20Detailed,
  getAaveProtocolDataProvider,
  getInterestRateStrategy,
  getMockFlashLoanReceiver,
  getLendingRateOracle,
  getAllMockedTokens,
  getReserveLogic,
  getGenericLogic,
  getStableAndVariableTokensHelper,
  getATokensAndRatesHelper,
  getWETHGateway,
  getWETHMocked,
  getMockAToken,
  getSelfdestructTransferMock,
  getLendingPoolImpl,
  getLendingPoolConfiguratorImpl,
  getLendingPoolCollateralManagerImpl,
  getLendingPoolCollateralManager,
  getAddressById,
  getAaveOracle,
  getMockUniswapRouter,
  getUniswapLiquiditySwapAdapter,
  getUniswapRepayAdapter,
  getFlashLiquidationAdapter,
  getMockParaSwapAugustus,
  getMockParaSwapAugustusRegistry,
  getParaSwapLiquiditySwapAdapter,
} from '../../helpers/contracts-getters';
import { getEthersSigners } from '../../helpers/contracts-helpers';

import {
  deployMockAToken,
  deployMockStableDebtToken,
  deployMockVariableDebtToken,
} from '../../helpers/contracts-deployments';
import { constants } from 'ethers';
import { formatEther } from 'ethers/lib/utils';
import BigNumber from 'bignumber.js';

makeSuite('Upgradeability', (testEnv: TestEnv) => {
  const { CALLER_NOT_POOL_ADMIN } = ProtocolErrors;
  let newATokenAddress: string;
  let newStableTokenAddress: string;
  let newVariableTokenAddress: string;

  before('deploying instances', async () => {
    const { dai, pool } = testEnv;
    const aTokenInstance = await deployMockAToken([
      pool.address,
      dai.address,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      'Aave Interest bearing DAI updated',
      'aDAI',
      '0x10',
    ]);

    const stableDebtTokenInstance = await deployMockStableDebtToken([
      pool.address,
      dai.address,
      ZERO_ADDRESS,
      'Aave stable debt bearing DAI updated',
      'stableDebtDAI',
      '0x10',
    ]);

    const variableDebtTokenInstance = await deployMockVariableDebtToken([
      pool.address,
      dai.address,
      ZERO_ADDRESS,
      'Aave variable debt bearing DAI updated',
      'variableDebtDAI',
      '0x10',
    ]);

    newATokenAddress = aTokenInstance.address;
    newVariableTokenAddress = variableDebtTokenInstance.address;
    newStableTokenAddress = stableDebtTokenInstance.address;

    console.log(`newATokenAddress: ${newATokenAddress}`);
    console.log(`newVariableTokenAddress: ${newVariableTokenAddress}`);
    console.log(`newStableTokenAddress: ${newStableTokenAddress}`);
  });

  // new test case
  it('check getLendingPoolConfiguratorImpl() in contracts-getters', async () => {
    const { dai, users, configurator } = testEnv;
    const lpci = await getLendingPoolConfiguratorImpl(configurator.address);
    console.log(`address: ${await lpci.address}`);
    expect(await lpci.address).to.be.not.equal(constants.AddressZero);
    // await lpci.deactivateReserve(dai.address);
  });

  // new test case
  it('check getCurrentBlock() in contracts-helpers', async () => {
    console.log(`${await getCurrentBlock()}`);
  });
});
