#!/usr/bin/env bash
# Generated 2026-08-08T02:40:08Z — 96 RHJ tokens
set -euo pipefail
VAULT="0xac3e9e30313969010b53560cdfDfC0Ac364A96E7"
RPC="https://rpc.mainnet.chain.robinhood.com"
RWA_MAX_POST="1000000000000000"
RWA_DAILY="10000000000000000"
RWA_WALLET="1000000000000000"
[[ -n "${OWNER_PRIVATE_KEY:-}" ]] || { echo "export OWNER_PRIVATE_KEY"; exit 1; }
PK="$OWNER_PRIVATE_KEY"; [[ "$PK" == 0x* ]] || PK="0x$PK"
echo 'allowlist AAOI'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x521Cf887E6531c6F667b5BC4D896E5d9bfE8EB2E" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist AAPL'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist AMAT'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x36046893810a7E7fCE501229d57dc3FC8c8716d0" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist AMD'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist AMZN'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x12f190a9F9d7D37a250758b26824B97CE941bF54" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist APLD'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xb8DBf92F9741c9ac1c32115E78581f23509916FD" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist ASML'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x47F93d52cBeC7C6D2CfC080e154002370a60dAEA" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist ASTS'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x1AF6446f07eb1d97c546AFC8c9544cBDF3AD5137" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist AVGO'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x156E175DD063a8cE274C50654eF40e0032b3fbcF" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist BA'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x4D21483a44Bf67a86b77E3dA301411880797D452" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist BABA'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist BE'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x822CC93fFD030293E9842c30BBD678F530701867" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist CBRS'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x5c90450Bbb4273D7b2f17CF6917AEB237A569679" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist CCL'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x9651342CeA770aE9a2969Ba2A52611523146aef9" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist CELH'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x8cF07C5A878945185d327aAa6e33FAa95F95e7bF" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist CLSK'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xcBB95BBF36099d34dA091dc6Fa6F49EfA257Cee3" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist COIN'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x6330D8C3178a418788dF01a47479c0ce7CCF450b" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist COST'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x4EA005168D7F09a7A0Ba9D1DEf21a479950E44C2" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist CRCL'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist CRWD'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xea72Ecca2d0f6bFA1394DBBCff85b52CD4233931" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist CRWV'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist DDOG'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x27c99fBde9D0d2AA4f4Bfb4943f237843DdF6958" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist DELL'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x941AE714EC6D8130c7B75d67160Ca08f1e7d11Dd" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist ELF'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x39EC44Bee4F6A116c6F9B8De566848a985C53C60" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist EWY'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x7f0aBeF0C07280F82c6a08ead09dEd6BAE2C13Fc" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist F'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x25C288E6D899b9BC30160965aD9644c67e73bE0C" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist FLNC'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x282e87451E10fA6679BC7D76C69BE44cD3fC777C" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist FUTU'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xeB30663bDFf0622Ef4e4E5cBb4E975F19f33f51D" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist GLW'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x7c04E6A3368F2A1DE3874f0e80d2e0A1a9915da6" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist GME'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x1b0E319c6A659F002271B69dB8A7df2F911c153E" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist GOOGL'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist INOD'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xf1953DAB6FaD537488d5A022361FfAa8B4c95eC6" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist INTC'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xc72b96e0E48ecd4DC75E1e45396e26300BC39681" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist INTU'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x56d23beE5f41A7120170b0c603Dae30128e460e9" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist IONQ'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x558378E000D634A36593E338eBacdd6207640EfE" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist IREN'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xF0AB0c93bE6F41369d302e55db1A96b3c430212D" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist LITE'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x8eF20885F94e3D9bc7eB3080279188Bd5ED7c08C" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist LLY'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x8005d266423c7ea827372c9c864491e5786600ea" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist LULU'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x4e62068525Ab11FE768e29dfD00ef909B9803016" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist LUNR'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xa5D4968421bA94814Be3B136b15cf422101aC1a3" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist MDB'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xDdf2266b79abf0B48898959B0ed6E6adf512be74" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist META'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist MRVL'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x62fd0668e10D8B72339BE2DCF7643001688ff13B" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist MSFT'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xe93237C50D904957Cf27E7B1133b510C669c2e74" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist MSTR'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xec262a75e413fAfD0dF80480274532C79D42da09" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist MU'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist MXL'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x48961813349333209994750ffA89b3c5C22eC969" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist NBIS'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x9D9c6684F596F66a64C030B93A886D51Fd4D7931" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist NFLX'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist NNE'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xBEF75684C43c4ea7BD18Dd532a2244674Ee8b926" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist NOW'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x0C3260aF4B8f13a69c4c2dFb84fD667890CDFa14" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist NU'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x408c14038a04f7bD235329E26d2bf569ee20e250" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist NVDA'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist NVTS'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xbE6702d7b70315376dC48a3293f24f0982F86386" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist ORCL'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xb0992820E760d836549ba69BC7598b4af75dEE03" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist P'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x1Cdad396DB64BDa184d5182A97Dd9B3C62100b7D" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist PENG'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x9b23573b156B52565012F5cE02CDF60AFBaa70Be" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist PLTR'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist POET'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xcf6B2D875361be807EAfa57458c80f28521F9333" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist PR'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x4189F0c66EBBB0bfeF1C31f763131361EF32f77C" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist QBTS'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xC583c60aeF9Dc401Da72cEC1B404743a93cea1Cc" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist QCOM'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x0f17206447090e464C277571124dD2688E48AEA9" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist QQQ'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist QUBT'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x59818904ab4cE163b3cE4FfB64f2D6Ca02c434B4" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist RBLX'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xF0C4BF4C582cb3836e98394b1d4e7B7281101bE8" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist RDDT'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x05b37Fb53A299a1b874A619e1c4C404D52C36F4C" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist RDW'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x92Ef19E82bD8fF36661DE838D5eaE7e5CEF0EfFE" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist RGTI'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x284358abc07F9359f19f4b5b4aC91901Be2597Ba" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist RIVN'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xB1BF26c1D20ff267A4f93550d1E0d06ac40a114B" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist RKLB'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x3b14C39E89D60D627b42a1A4CA45b5bb45Fc12e2" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SATS'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x95052ddcd5DC25641657424A8Cf04834997E1730" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SGOV'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SHOP'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xF53F66751B1Eff985311b693531E3290F600c410" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SKHY'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x84CAb63bc87912E71ad199ff14A0bA45de68FeF8" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SLV'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SMCI'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xc01aA1fECeC0605b13bc84874ff7256C0f5F562a" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SNDK'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xB90A19fF0Af67f7779afF50A882A9CfF42446400" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SOFI'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x98E75885157C80992A8D41b696D8c9C6Fb30A926" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SOXX'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x75742c18BC1f1C5c5f448f4C9D9C6F66dafAAa38" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SPCX'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SPMO'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xAd622320e520de39e72d41EF07438C3Fd3354875" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist SPY'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist TSEM'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x89776d4Cd68193597A2fC132cfaC1fDe36CCeA8a" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist TSLA'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x322F0929c4625eD5bAd873c95208D54E1c003b2d" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist TSM'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x58FfE4a942d3885bAa22D7520691F611EF09e7AA" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist TTWO'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x5e81213613b6B86EaB4c6c50d718d34359459786" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist UMC'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x0E6e67Ba88e7b5d9B67636A215c76779B948dE79" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist UPS'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xf23250dac154D05Bb671CB0d0eBEf3c635c79CE2" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist USAR'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xd917B029C761D264c6A312BBbcDA868658eF86a6" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist USO'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist WDAY'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x82DA4646242e1D962e96e932269Dc644c94a9CaA" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist XLK'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x15Cd20759CE7F3285c29A319dE2D1A2e098c6f43" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist XNDU'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xA8eB3BCcbf2017eE7CBfb652eB51CF2E1B153289" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist XOM'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0xf9B46d3D1B22199D4D1025a9cEDB540A33F1a2d5" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist ZM'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x44c4F142009036cF477eD2d09932051843137CF1" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
echo 'allowlist ZS'
cast send "$VAULT" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
  "0x7dc013eB55e436f30d7ED1AFE4E36d6e45e3c3f7" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
  --private-key "$PK" --rpc-url "$RPC"
