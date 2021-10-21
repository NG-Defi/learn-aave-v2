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
} from '../../helpers/contracts-getters';
import {
  deployMockAToken,
  deployMockStableDebtToken,
  deployMockVariableDebtToken,
} from '../../helpers/contracts-deployments';

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

  it('test getAToken function in helpers/contracts-getters.ts', async () => {
    console.log(`name: ${await (await getAToken(newATokenAddress)).name()}`);
    console.log(`symbol: ${await (await getAToken(newATokenAddress)).symbol()}`);
    console.log(`decimals: ${await (await getAToken(newATokenAddress)).decimals()}`);
    console.log(`totalSupply: ${await (await getAToken(newATokenAddress)).totalSupply()}`);
    console.log(`EIP712_REVISION: ${await (await getAToken(newATokenAddress)).EIP712_REVISION()}`);
    console.log(`ATOKEN_REVISION: ${await (await getAToken(newATokenAddress)).ATOKEN_REVISION()}`);
  });

  it('test getStableDebtToken function in helpers/contracts-getters.ts', async () => {
    const { dai, configurator, users } = testEnv;
    console.log(`name: ${await (await getStableDebtToken(newStableTokenAddress)).name()}`);
    console.log(`symbol: ${await (await getStableDebtToken(newStableTokenAddress)).symbol()}`);
    console.log(`decimals: ${await (await getStableDebtToken(newStableTokenAddress)).decimals()}`);
    console.log(
      `totalSupply: ${await (await getStableDebtToken(newStableTokenAddress)).totalSupply()}`
    );
    console.log(
      `DEBT_TOKEN_REVISION: ${await (
        await getStableDebtToken(newStableTokenAddress)
      ).DEBT_TOKEN_REVISION()}`
    );
    console.log(
      `getAverageStableRate: ${await (
        await getStableDebtToken(newStableTokenAddress)
      ).getAverageStableRate()}`
    );
    console.log(
      `getUserLastUpdated: ${await (
        await getStableDebtToken(newStableTokenAddress)
      ).getUserLastUpdated(users[0].address)}`
    );
    console.log(
      `getUserStableRate: ${await (
        await getStableDebtToken(newStableTokenAddress)
      ).getUserStableRate(users[0].address)}`
    );
    console.log(
      `balanceOf: ${await (
        await getStableDebtToken(newStableTokenAddress)
      ).balanceOf(users[0].address)}`
    );
  });

  it('test getVariableDebtToken function in helpers/contracts-getters.ts', async () => {
    const { dai, configurator, users } = testEnv;
    console.log(`name: ${await (await getVariableDebtToken(newVariableTokenAddress)).name()}`);
    console.log(`symbol: ${await (await getVariableDebtToken(newVariableTokenAddress)).symbol()}`);
    console.log(
      `decimals: ${await (await getVariableDebtToken(newVariableTokenAddress)).decimals()}`
    );
    console.log(
      `totalSupply: ${await (await getVariableDebtToken(newVariableTokenAddress)).totalSupply()}`
    );
    console.log(
      `scaledTotalSupply: ${await (
        await getVariableDebtToken(newVariableTokenAddress)
      ).scaledTotalSupply()}`
    );
    console.log(
      `UNDERLYING_ASSET_ADDRESS: ${await (
        await getVariableDebtToken(newVariableTokenAddress)
      ).UNDERLYING_ASSET_ADDRESS()}`
    );
    console.log(
      `getIncentivesController: ${await (
        await getVariableDebtToken(newVariableTokenAddress)
      ).getIncentivesController()}`
    );
    console.log(`POOL: ${await (await getVariableDebtToken(newVariableTokenAddress)).POOL()}`);
  });

  it('Tries to update the DAI Atoken implementation with a different address than the lendingPoolManager', async () => {
    const { dai, configurator, users } = testEnv;

    const name = await (await getAToken(newATokenAddress)).name();
    const symbol = await (await getAToken(newATokenAddress)).symbol();

    const updateATokenInputParams: {
      asset: string;
      treasury: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      treasury: ZERO_ADDRESS,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newATokenAddress,
      params: '0x10',
    };
    await expect(
      configurator.connect(users[1].signer).updateAToken(updateATokenInputParams)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Upgrades the DAI Atoken implementation ', async () => {
    const { dai, configurator, aDai } = testEnv;

    const name = await (await getAToken(newATokenAddress)).name();
    const symbol = await (await getAToken(newATokenAddress)).symbol();

    const updateATokenInputParams: {
      asset: string;
      treasury: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      treasury: ZERO_ADDRESS,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newATokenAddress,
      params: '0x10',
    };
    await configurator.updateAToken(updateATokenInputParams);

    const tokenName = await aDai.name();

    expect(tokenName).to.be.eq('Aave Interest bearing DAI updated', 'Invalid token name');
  });

  it('Tries to update the DAI Stable debt token implementation with a different address than the lendingPoolManager', async () => {
    const { dai, configurator, users } = testEnv;

    const name = await (await getStableDebtToken(newStableTokenAddress)).name();
    const symbol = await (await getStableDebtToken(newStableTokenAddress)).symbol();

    const updateDebtTokenInput: {
      asset: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newStableTokenAddress,
      params: '0x10',
    };

    await expect(
      configurator.connect(users[1].signer).updateStableDebtToken(updateDebtTokenInput)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Upgrades the DAI stable debt token implementation ', async () => {
    const { dai, configurator, pool, helpersContract } = testEnv;

    const name = await (await getStableDebtToken(newStableTokenAddress)).name();
    const symbol = await (await getStableDebtToken(newStableTokenAddress)).symbol();

    const updateDebtTokenInput: {
      asset: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newStableTokenAddress,
      params: '0x10',
    };

    await configurator.updateStableDebtToken(updateDebtTokenInput);

    const { stableDebtTokenAddress } = await helpersContract.getReserveTokensAddresses(dai.address);

    const debtToken = await getMockStableDebtToken(stableDebtTokenAddress);

    const tokenName = await debtToken.name();

    expect(tokenName).to.be.eq('Aave stable debt bearing DAI updated', 'Invalid token name');
  });

  it('Tries to update the DAI variable debt token implementation with a different address than the lendingPoolManager', async () => {
    const { dai, configurator, users } = testEnv;

    const name = await (await getVariableDebtToken(newVariableTokenAddress)).name();
    const symbol = await (await getVariableDebtToken(newVariableTokenAddress)).symbol();

    const updateDebtTokenInput: {
      asset: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newVariableTokenAddress,
      params: '0x10',
    };

    await expect(
      configurator.connect(users[1].signer).updateVariableDebtToken(updateDebtTokenInput)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Upgrades the DAI variable debt token implementation ', async () => {
    const { dai, configurator, pool, helpersContract } = testEnv;

    const name = await (await getVariableDebtToken(newVariableTokenAddress)).name();
    const symbol = await (await getVariableDebtToken(newVariableTokenAddress)).symbol();

    const updateDebtTokenInput: {
      asset: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newVariableTokenAddress,
      params: '0x10',
    };
    //const name = await (await getAToken(newATokenAddress)).name();

    await configurator.updateVariableDebtToken(updateDebtTokenInput);

    const { variableDebtTokenAddress } = await helpersContract.getReserveTokensAddresses(
      dai.address
    );

    const debtToken = await getMockVariableDebtToken(variableDebtTokenAddress);

    const tokenName = await debtToken.name();

    expect(tokenName).to.be.eq('Aave variable debt bearing DAI updated', 'Invalid token name');
  });
});
