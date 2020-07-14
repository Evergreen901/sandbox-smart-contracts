const {BigNumber} = require("@ethersproject/bignumber");
function sandWei(amount) {
  return BigNumber.from(amount).mul("1000000000000000000").toString();
}

module.exports = [
  {
    name: "Common",
    symbol: "COMMON",
    sandMintingFee: sandWei(1),
    sandUpdateFee: sandWei(1),
    maxGems: 1,
    quantityRange: [200, 1000],
    attributeRange: [1, 25],
  },
  {
    name: "Rare",
    symbol: "RARE",
    sandMintingFee: sandWei(4),
    sandUpdateFee: sandWei(4),
    maxGems: 2,
    quantityRange: [50, 200],
    attributeRange: [26, 50],
  },
  {
    name: "Epic",
    symbol: "EPIC",
    sandMintingFee: sandWei(10),
    sandUpdateFee: sandWei(10),
    maxGems: 3,
    quantityRange: [10, 50],
    attributeRange: [51, 75],
  },
  {
    name: "Legendary",
    symbol: "LEGENDARY",
    sandMintingFee: sandWei(200),
    sandUpdateFee: sandWei(200),
    maxGems: 4,
    quantityRange: [1, 10],
    attributeRange: [76, 100],
  },
];