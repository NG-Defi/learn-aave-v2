import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ProtocolErrors } from '../../helpers/types';
import { ethers } from 'ethers';

makeSuite('AToken: Modifiers', (testEnv: TestEnv) => {
  const { CT_CALLER_MUST_BE_LENDING_POOL } = ProtocolErrors;

  it('Tries to invoke mint not being the LendingPool', async () => {
    const { deployer, aDai } = testEnv;
    await expect(aDai.mint(deployer.address, '1', '1')).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });

  it('check AToken.EIP712_REVISION(), its value should NOT equal to [0]', async () => {
    const { deployer, aDai } = testEnv;
    const EXP_VALUE = 0;
    await expect(await aDai.EIP712_REVISION()).to.not.eq(EXP_VALUE);
  });

  it('check AToken.ATOKEN_REVISION(), its value should  equal to [1]', async () => {
    const { deployer, aDai } = testEnv;
    const EXP_VALUE = 1;
    await expect(await aDai.ATOKEN_REVISION()).to.eq(EXP_VALUE);
  });

  it('check AToken.totalSupply(), its value should equal to [0]', async () => {
    const { aDai } = testEnv;
    const EXP_VALUE = 0;
    await expect(await aDai.totalSupply()).to.eq(EXP_VALUE);
  });

  it('check AToken.scaledTotalSupply(), its value should equal to [0]', async () => {
    const { aDai } = testEnv;
    const EXP_VALUE = 0;
    await expect(await aDai.scaledTotalSupply()).to.eq(EXP_VALUE);
  });

  it('check AToken.RESERVE_TREASURY_ADDRESS(), its value should NOT equal to [addressZero]', async () => {
    const { aDai } = testEnv;
    const EXP_VALUE = ethers.constants.AddressZero;
    await expect(await aDai.RESERVE_TREASURY_ADDRESS()).to.not.eq(EXP_VALUE);
  });

  it('Tries to invoke burn not being the LendingPool', async () => {
    const { deployer, aDai } = testEnv;
    await expect(aDai.burn(deployer.address, deployer.address, '1', '1')).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });

  it('Tries to invoke transferOnLiquidation not being the LendingPool', async () => {
    const { deployer, users, aDai } = testEnv;
    await expect(
      aDai.transferOnLiquidation(deployer.address, users[0].address, '1')
    ).to.be.revertedWith(CT_CALLER_MUST_BE_LENDING_POOL);
  });

  it('Tries to invoke transferUnderlyingTo not being the LendingPool', async () => {
    const { deployer, aDai } = testEnv;
    await expect(aDai.transferUnderlyingTo(deployer.address, '1')).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });
});
