# Recovery

## Signing in on another device

Passkeys synced by your phone's keychain (iCloud Keychain, Google Password Manager) work on your other devices too:
choose Sign in with passkey. On a device with none, add one first from a device you're signed in on.

## Adding a passkey

In Settings, under Security, Add a passkey makes one on this device, on another device by scanning its code, or on a
hardware key, and you approve it with Face ID. Any one of your passkeys signs in and approves. The last one can't be
removed; add another before you remove it.

## Devices

Devices lists every browser signed in to your account. Sign out one you don't know, or Sign out everywhere else.
Removing a passkey signs out the devices signed in with it.

## A recovery key

Under Security, Set up a recovery key: a passkey on another device or a hardware key, kept for the day you lose every
other passkey. It can't sign in to the app or move money; it can only ask for a recovery. Lock with Face ID saves it
onchain.

## If you lose every passkey

On a new device, open the recovery page and use your recovery key. It makes a passkey on this device and asks for a
recovery, which waits 48 hours onchain. Once the 48 hours pass, use your recovery key again: this device's new passkey
replaces the old ones, every other device is signed out, and this device is signed in with its new passkey. The recovery
page is Lost your passkey? Recover your account, on the welcome page.

## Cancelling a recovery

Every recovery is announced on every channel: Someone asked to recover your account. Until the 48 hours pass, any
signed-in device or Telegram can cancel it without Face ID, with Cancel recovery or /cancel_recovery. Remove your
recovery key too if you didn't ask for the recovery.
