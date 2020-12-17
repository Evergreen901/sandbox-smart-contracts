import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {expect} from '../chai-setup';
import MerkleTree from '../../lib/merkleTree';
import {createAssetClaimMerkleTree} from '../../data/giveaways/asset_giveaway_1/getAssets';
import helpers from '../../lib/merkleTreeHelper';
const {createDataArrayClaimableAssets} = helpers;
import {default as testAssetData} from '../../data/giveaways/asset_giveaway_1/testAssets.json';

const ipfsHashString =
  '0x78b9f42c22c3c8b260b781578da3151e8200c741c6b7437bafaff5a9df9b403e';

import {expectReceiptEventWithArgs, waitFor} from '../utils';

type Options = {
  mint?: boolean;
  mintSingleAsset?: number;
  assetsHolder?: boolean;
};

export const setupTestGiveaway = deployments.createFixture(async function (
  hre,
  options?: Options
) {
  const {network, getChainId} = hre;
  const chainId = await getChainId();
  const {mint, mintSingleAsset, assetsHolder} = options || {};
  const {
    deployer,
    assetAdmin,
    assetBouncerAdmin,
    nftGiveawayAdmin,
  } = await getNamedAccounts();
  const others = await getUnnamedAccounts();
  await deployments.fixture('Asset_Giveaway_1');
  const sandContract = await ethers.getContract('Sand');
  const assetContract = await ethers.getContract('Asset');

  const emptyBytes32 =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  const ASSETS_HOLDER = '0x0000000000000000000000000000000000000000';

  const testContract = await deployments.deploy('Test_Asset_Giveaway_1', {
    from: deployer,
    contract: 'AssetGiveaway',
    args: [
      assetContract.address,
      nftGiveawayAdmin,
      emptyBytes32,
      assetsHolder ? others[5] : ASSETS_HOLDER,
      1615194000, // Sunday, 08-Mar-21 09:00:00 UTC
    ],
  });

  if (assetsHolder) {
    const assetContractAsAdmin = await assetContract.connect(
      ethers.provider.getSigner(assetAdmin)
    );
    await assetContractAsAdmin.setSuperOperator(testContract.address, true);
  }

  // Supply assets to contract for testing
  async function mintTestAssets(id: number, value: number) {
    const assetContractAsBouncer = await assetContract.connect(
      ethers.provider.getSigner(assetBouncerAdmin)
    );

    // Asset to be minted
    const creator = others[0];
    const packId = id;
    const hash = ipfsHashString;
    const supply = value;
    const rarity = 1;
    const owner = assetsHolder ? others[5] : testContract.address;
    const data = '0x';

    const receipt = await waitFor(
      assetContractAsBouncer.mint(
        creator,
        packId,
        hash,
        supply,
        rarity,
        owner,
        data
      )
    );

    const transferEvent = await expectReceiptEventWithArgs(
      receipt,
      'TransferSingle'
    );

    const balanceAssetId = await assetContract['balanceOf(address,uint256)'](
      assetsHolder ? others[5] : testContract.address,
      transferEvent.args[3]
    );
    expect(balanceAssetId).to.equal(supply);
    return transferEvent.args[3].toString(); // asset ID
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dataWithIds: any = testAssetData;

  async function mintAssetsWithNewIds() {
    return await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      testAssetData.map(async (claim: any) => {
        return {
          assetValues: claim.assetValues,
          reservedAddress: claim.reservedAddress,
          assetIds: await Promise.all(
            claim.assetIds.map(
              async (assetPackId: number, index: number) =>
                await mintTestAssets(assetPackId, claim.assetValues[index])
            )
          ),
        };
      })
    );
  }

  if (mint) {
    const assetsWithIds = await mintAssetsWithNewIds();
    dataWithIds = assetsWithIds;
  }

  async function mintSingleAssetWithId(claim: any) {
    return {
      ...claim,
      assetIds: await Promise.all(
        claim.assetIds.map(
          async (assetPackId: number, index: number) =>
            await mintTestAssets(assetPackId, claim.assetValues[index])
        )
      ),
    };
  }

  if (mintSingleAsset) {
    // Set up blank testData for thousands of users
    const emptyData: any = [];
    for (let i = 0; i < 1; i++) {
      const claim: any = {
        reservedAddress: others[1],
        assetIds: [i],
        assetValues: [1],
      };
      emptyData.push(await mintSingleAssetWithId(claim));
    }
    for (let i = 1; i < mintSingleAsset; i++) {
      const claim: any = {
        reservedAddress: others[1],
        assetIds: [i],
        assetValues: [1],
      };
      emptyData.push(claim);
    }
    dataWithIds = emptyData;
  }

  // Set up tree with test assets
  const {assets, merkleRootHash} = createAssetClaimMerkleTree(
    network.live,
    chainId,
    dataWithIds
  );

  // Update the deployment with test asset data
  const deployment = await deployments.get('Test_Asset_Giveaway_1');
  deployment.linkedData = assets;
  await deployments.save('Test_Asset_Giveaway_1', deployment);

  const giveawayContract = await ethers.getContract('Test_Asset_Giveaway_1');
  const giveawayContractAsAdmin = await giveawayContract.connect(
    ethers.provider.getSigner(nftGiveawayAdmin)
  );

  const updatedDeployment = await deployments.get('Test_Asset_Giveaway_1');
  const updatedAssets = updatedDeployment.linkedData;
  const assetHashArray = createDataArrayClaimableAssets(updatedAssets);
  const tree = new MerkleTree(assetHashArray);
  await giveawayContractAsAdmin.setMerkleRoot(merkleRootHash); // Set the merkleRoot which could not have been known prior to generating the test asset IDs

  return {
    giveawayContract,
    sandContract,
    assetContract,
    others,
    tree,
    assets: updatedAssets,
    nftGiveawayAdmin,
    merkleRootHash,
  };
});

export const setupGiveaway = deployments.createFixture(async function () {
  const {nftGiveawayAdmin} = await getNamedAccounts();
  const others = await getUnnamedAccounts();
  await deployments.fixture('Asset_Giveaway_1');
  const giveawayContract = await ethers.getContract('Asset_Giveaway_1');
  const sandContract = await ethers.getContract('Sand');
  const assetContract = await ethers.getContract('Asset');
  const deployment = await deployments.get('Asset_Giveaway_1');

  // Set up tree with real assets
  const assets = deployment.linkedData;
  const assetHashArray = createDataArrayClaimableAssets(assets);
  const tree = new MerkleTree(assetHashArray);

  return {
    giveawayContract,
    sandContract,
    assetContract,
    others,
    tree,
    assets,
    nftGiveawayAdmin,
  };
});
