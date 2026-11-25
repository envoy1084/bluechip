// The devnet's controls, for what a test can't arrange through the app: an account's ETH, the base fee, the clock.
import { BASE_FEE_WEI, rpc } from "@bluechip/devnet/Controls"
import { urls } from "../stack/Stack.ts"

const hex = (value: bigint | number) => `0x${value.toString(16)}`

export class Chain {
  private readonly node = rpc(urls.anvil)

  /** Sets an account's ETH (wei): zero leaves an agent nothing to pay gas with. */
  async setEth(account: `0x${string}`, wei: bigint) {
    await this.node("anvil_setBalance", [account, hex(wei)])
  }

  /** Sets the next blocks' base fee (wei), and mines one so reads see it; `reset` puts back Base's. */
  async setBaseFee(wei: bigint) {
    await this.node("anvil_setNextBlockBaseFeePerGas", [hex(wei)])
    await this.node("anvil_mine", ["0x1"])
  }

  async resetBaseFee() {
    await this.setBaseFee(BASE_FEE_WEI)
  }
}
