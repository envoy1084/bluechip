/**
 * bluechip's deployment on Base Sepolia (paper money). Written by `node scripts/bin.ts contracts deploy --network
 * sepolia`; do not edit.
 *
 * @since 0.0.0
 */

/**
 * Every address `contracts deploy` placed on Base Sepolia.
 *
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const sepoliaAddresses = {
  usdc: "0x2F493035006db6a6Ad701258e87228d36e2156d3",
  sequencerFeed: "0x57B1FE128278AA106681a5134437fE043ba11A3c",
  feedWriter: "0x5d02B0D7430163955993DD2F768dCA8B163b6cA6",
  operator: "0x4f4b3b6392cB7FD88F98733d6e8562C2E28554C0",
  exchange: {
    factory: "0x99b3c832F32a1FfF7F9d5dacfC6416235FeCeA9a",
    router: "0xF2973d81c205adc65c5ac70aFAF8Dfd61FF2Db72",
    quoter: "0x76AA6765b0158eFb9C4a1D4885F661085dC00B48"
  },
  policies: {
    aerodromeTradePolicy: "0x7C573EA659F7567825EC9e06d667249C7e86dBf3",
    tradeGuard: "0x4f66104ba1464dAca5266f749b5843Ce50f25520",
    recoveryDelayPolicy: "0xF2C702138f8BFF92C19AA4e138ee6FE752916B4C",
    tradeSizeRule: "0x240274AB59bd003C39eDf22542910EA9BBc3121e",
    fairPriceRule: "0x8482F4E90a5101422044e1D54D45AF72A75d28e3",
    stockCapRule: "0x6Ec294E0c7D091E57c67Cf4dE4f0965170Ff61DA",
    cashReserveRule: "0x1A9aB2684e08C8fAd79D6014eeeFe874AC67E701",
    rebalanceRule: "0xf7859d6DC9265D229F4F38e3d022bAf6a02B923E",
    stopLossFloorRule: "0x40303065601832aED92bB4fad1d6425631ddD47e",
    slippageBudgetRule: "0x1167EC36224BCd2FAce8502Bc7284a84b01bef4E"
  },
  stocks: [
    {
      symbol: "AAPL",
      token: "0x6b0c816d1d714cE62440337D0C8b04Bcb9688e4b",
      feed: "0xeCC5426A2fd1C871D8Cd7bCf9C7db166b40aF65a",
      pool: "0xB32dEBB7928afe7E897a98f1a26603c5a38cfc3c"
    },
    {
      symbol: "AMZN",
      token: "0xDba90e840B697A662F05B5a8AaB09d6ddE7Ad3ED",
      feed: "0x2abAAF572477D07F8dA11a00A45EE67265ec44DB",
      pool: "0x412C5A100d8AA839cF88180BbBee3f7AFa22055E"
    },
    {
      symbol: "ANT",
      token: "0x861C63e9416754D337670e518EfF007c0D36C2Ad",
      feed: "0x2FD75bA137224e020D5FEDD661E6c740F875D9C5",
      pool: "0x7F8A12Ee93070ed953c342fFe5a61cD473DB6828"
    },
    {
      symbol: "CRCL",
      token: "0x1aF5c0986CaBebb3cCd2A47Cbe851Ea3dD263b81",
      feed: "0x4F9df42532fa5345B3845f6162cff8E02b44FEFB",
      pool: "0x99fC28C35960bF74Fc35F6d66c83572073dc5d33"
    },
    {
      symbol: "GOOGL",
      token: "0x50a6f12E2847E9852BeE1aa93b1f7AB686cBFaD8",
      feed: "0xcd1f14Fcfd4c1A38Fa841d1269817e756FdB2E35",
      pool: "0x04C8A2D3FfDa26485008fEda7d7be42BD604D278"
    },
    {
      symbol: "INTC",
      token: "0x35Fc09c4d96Fca83cda9B59aa24576118e90b31a",
      feed: "0x0d40Cb6724Cc700BbC0Ca9c95b31B0045181e90D",
      pool: "0xfE6E1C7059bdCaDcFfb3E179bA6A3e23687a48Bb"
    },
    {
      symbol: "META",
      token: "0x73cb8cB309BC5894b793088C64624895E314B5ce",
      feed: "0xe324e7B92Dd5de63F33118821df50AD4DCCaed4f",
      pool: "0xa047b007b086D0325AADa966ef39d383d8A1e640"
    },
    {
      symbol: "MSFT",
      token: "0x5BCF996E7adB6C8a573f973A75BaF704FC8a44ac",
      feed: "0x9501Fa7C53CE66ca009964b1B0b18bE9C4d11948",
      pool: "0xA41D8B160a472231f377a3F54e1Db3Cf7eD88A3E"
    },
    {
      symbol: "MSTR",
      token: "0x3E033A4cC45D2C765e73aD5aA0D4bB646f6A59D5",
      feed: "0x66Ee25CdBb3FC0658E0Df77D3cbdBD6E9cfAFAaC",
      pool: "0xEefA6CE4B0b35f97Da7281758754a89283b7e298"
    },
    {
      symbol: "NVDA",
      token: "0xfa66c8CAe9974eCb49a0764CEdD9033E58a5E1f2",
      feed: "0x913807aa49d0c6f567024A778618C8148E71CDc7",
      pool: "0xfAd6F584c027BF1fA3C25fFBce3f056D7ac65eed"
    },
    {
      symbol: "SNDK",
      token: "0xdD234Ffc4bd376396808aC77071C007497824F15",
      feed: "0x2bcfA6FADd7415C6A73dE9dc6FD4D4Fd43856Cb5",
      pool: "0xf9242419cd25a093Ef2f76105d7b9E620a3Ba696"
    },
    {
      symbol: "SPCX",
      token: "0x5c6D3f3838f45C3aCd1269E384D90871fc66F8D0",
      feed: "0x1D61BBb46f50cef4Da792487C2a72119AB8915da",
      pool: "0xa7BB5CB77E8Ddf1bE97f6Fd6a395a5312440337e"
    },
    {
      symbol: "TSLA",
      token: "0xdb0EA52fCA352121a8d49Be1Be5FB672Fd45260e",
      feed: "0x6167e03cc6866fA216A5E768AA4702D108aDd1C4",
      pool: "0x3570369b697Ac3342B211337555d27A1DBD35A2B"
    }
  ]
} as const
