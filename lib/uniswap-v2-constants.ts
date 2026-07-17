/** Shared Uniswap / RH Chain token addresses (no RPC). */

import type { Address } from "viem";

export const WETH_RH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const satisfies Address;

/** Official Uniswap V2 Router02 on Robinhood Chain (may have thin liquidity vs V4). */
export const UNISWAP_V2_ROUTER_RH =
  "0x89e5DB8B5aA49aA85AC63f691524311AEB649eba" as const satisfies Address;
