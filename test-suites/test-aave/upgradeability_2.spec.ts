import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ProtocolErrors, eContractid } from '../../helpers/types';
import { deployContract, getContract } from '../../helpers/contracts-helpers';
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
  it('check getLendingPoolCollateralManagerImpl() in contracts-getters', async () => {
    const lpcmi = await getLendingPoolCollateralManagerImpl();
    // console.log(`address: ${await lpcmi.address}`);
    // console.log(`listenerCount: ${await lpcmi.listenerCount()}`);
    expect(await lpcmi.address).to.be.not.equal(constants.AddressZero);
    expect(await lpcmi.listenerCount()).to.be.equal(0);
  });

  // new test case
  it('check getLendingPoolCollateralManager() in contracts-getters', async () => {
    const lpcm = await getLendingPoolCollateralManager();
    // console.log(`address: ${await lpcm.address}`);
    // console.log(`listenerCount: ${await lpcm.listenerCount()}`);
    expect(await lpcm.address).to.be.not.equal(constants.AddressZero);
    expect(await lpcm.listenerCount()).to.be.equal(0);
  });

  it('check getAddressById() in contracts-getters', async () => {
    // console.log(`aDAI: ${await getAddressById("aDAI")}`);
    // console.log(`aDai: ${await getAddressById("aDai")}`);

    expect(await getAddressById('aDAI')).to.be.not.equal(constants.AddressZero);
    expect(await getAddressById('1')).to.be.not.equal(constants.AddressZero);
  });

  it('check getAaveOracle() in contracts-getters', async () => {
    const { dai, weth } = testEnv;
    const ao = await getAaveOracle();
    console.log(`address: ${await ao.address}`);
    console.log(`getAssetPrice(dai): ${formatEther(await ao.getAssetPrice(dai.address))}`);
    console.log(`getAssetPrice(weth): ${formatEther(await ao.getAssetPrice(weth.address))}`);
    expect(await ao.address).to.be.not.equal(constants.AddressZero);
    expect(await ao.getAssetPrice(dai.address)).to.be.gt(0);
    expect(await ao.getAssetPrice(weth.address)).to.be.gt(0);

    console.log(`getFallbackOracle: ${await ao.getFallbackOracle()}`);
    console.log(`getSourceOfAsset(dai): ${await ao.getSourceOfAsset(dai.address)}`);
    console.log(`getSourceOfAsset(weth): ${await ao.getSourceOfAsset(weth.address)}`);
    expect(await ao.getFallbackOracle()).to.be.not.equal(constants.AddressZero);
    expect(await ao.getSourceOfAsset(dai.address)).to.be.not.equal(constants.AddressZero);
    expect(await ao.getSourceOfAsset(weth.address)).to.be.equal(constants.AddressZero);
  });

  it('check getMockUniswapRouter() in contracts-getters', async () => {
    const mur = await getMockUniswapRouter();
    console.log(`address: ${await mur.address}`);
    console.log(`listenerCount: ${await mur.listenerCount()}`);
    expect(await mur.address).to.be.not.equal(constants.AddressZero);
    expect(await mur.listenerCount()).to.be.equal(0);
  });

  // it ('check getUniswapLiquiditySwapAdapter() in contracts-getters', async() => {
  //   const ulsa = await getUniswapLiquiditySwapAdapter();
  //   // console.log(`address: ${await ulsa.address}`);
  //   // console.log(`ADDRESSES_PROVIDER: ${await ulsa.ADDRESSES_PROVIDER()}`);
  //   // console.log(`FLASHLOAN_PREMIUM_TOTAL: ${await ulsa.FLASHLOAN_PREMIUM_TOTAL()}`);
  //   // console.log(`LENDING_POOL: ${await ulsa.LENDING_POOL()}`);
  //   // console.log(`MAX_SLIPPAGE_PERCENT: ${await ulsa.MAX_SLIPPAGE_PERCENT()}`);

  //   expect(await ulsa.address).to.be.not.equal(constants.AddressZero);
  //   expect(await ulsa.ADDRESSES_PROVIDER()).to.be.not.equal(constants.AddressZero);
  //   expect(await ulsa.FLASHLOAN_PREMIUM_TOTAL()).to.be.equal(9);
  //   expect(await ulsa.LENDING_POOL()).to.be.not.equal(constants.AddressZero);
  //   expect(await ulsa.MAX_SLIPPAGE_PERCENT()).to.be.equal(3000);

  //   // console.log(`ORACLE: ${await ulsa.ORACLE()}`);
  //   // console.log(`UNISWAP_ROUTER: ${await ulsa.UNISWAP_ROUTER()}`);
  //   // console.log(`USD_ADDRESS: ${await ulsa.USD_ADDRESS()}`);
  //   // console.log(`WETH_ADDRESS: ${await ulsa.WETH_ADDRESS()}`);

  //   expect(await ulsa.ORACLE()).to.be.not.equal(constants.AddressZero);
  //   expect(await ulsa.UNISWAP_ROUTER()).to.be.not.equal(constants.AddressZero);
  //   expect(await ulsa.USD_ADDRESS()).to.be.not.equal(constants.AddressZero);
  //   expect(await ulsa.WETH_ADDRESS()).to.be.not.equal(constants.AddressZero);
  // });

  // it ('check getUniswapRepayAdapter() in contracts-getters', async() => {
  //   const ura = await getUniswapRepayAdapter();
  //   expect(await ura.address).to.be.not.equal(constants.AddressZero);

  //   // console.log(`ADDRESSES_PROVIDER: ${await ura.ADDRESSES_PROVIDER()}`);
  //   // console.log(`owner: ${await ura.owner()}`);

  //   expect(await ura.ADDRESSES_PROVIDER()).to.be.not.equal(constants.AddressZero);
  //   expect(await ura.owner()).to.be.not.equal(constants.AddressZero);
  // });

  // it ('check getFlashLiquidationAdapter() in contracts-getters', async() => {
  //   const fla = await getFlashLiquidationAdapter();
  //   expect(await fla.address).to.be.not.equal(ZERO_ADDRESS);

  //   console.log(`MAX_SLIPPAGE_PERCENT: ${await fla.MAX_SLIPPAGE_PERCENT()}`);
  //   console.log(`owner: ${await fla.owner()}`);

  //   expect(await fla.MAX_SLIPPAGE_PERCENT()).to.be.gt(0);
  //   expect(await fla.MAX_SLIPPAGE_PERCENT()).to.be.equal(3000);
  //   expect(await fla.owner()).to.be.not.equal(ZERO_ADDRESS);
  // });

  it('check getMockParaSwapAugustus() in contracts-getters', async () => {
    const mpsa = await getMockParaSwapAugustus();
    expect(await mpsa.address).to.be.not.equal(ZERO_ADDRESS);

    // console.log(`getTokenTransferProxy: ${await mpsa.getTokenTransferProxy()}`);
    // console.log(`listenerCount: ${await mpsa.listenerCount()}`);
    expect(await mpsa.getTokenTransferProxy()).to.be.not.equal(ZERO_ADDRESS);
    expect(await mpsa.listenerCount()).to.be.equal(0);
  });

  it('check getMockParaSwapAugustusRegistry() in contracts-getters', async () => {
    const mpsar = await getMockParaSwapAugustusRegistry();
    expect(await mpsar.address).to.be.not.equal(ZERO_ADDRESS);

    expect(await mpsar.listenerCount()).to.be.equal(0);
  });

  // it('check getParaSwapLiquiditySwapAdapter() in contracts-getters', async() => {
  //   const pslsa = await getParaSwapLiquiditySwapAdapter();
  //   expect(await pslsa.address).to.be.not.equal(ZERO_ADDRESS);

  //   console.log(`ADDRESSES_PROVIDER: ${await pslsa.ADDRESSES_PROVIDER()}`);
  //   console.log(`AUGUSTUS_REGISTRY: ${await pslsa.AUGUSTUS_REGISTRY()}`);
  //   console.log(`MAX_SLIPPAGE_PERCENT: ${await pslsa.MAX_SLIPPAGE_PERCENT()}`);

  //   expect(await pslsa.ADDRESSES_PROVIDER()).to.be.not.equal(ZERO_ADDRESS);
  //   expect(await pslsa.AUGUSTUS_REGISTRY()).to.be.not.equal(ZERO_ADDRESS);
  //   expect(await pslsa.MAX_SLIPPAGE_PERCENT()).to.be.equal(3000);
  // });
});
