# Recovery

## Signing in on another device

Each device signs in with its own passkey (Face ID or your fingerprint). Passkeys synced by your phone's keychain work
on your other devices too. Settings lists your passkeys, and you can remove a device you lost there.

## A recovery key

In Settings, under Security, you can set up a recovery key: a passkey on another device or a hardware key, kept for the
day you lose every other passkey. It can't sign in to the app or move money; it can only ask for a recovery.

## If you lose every passkey

On a new device, open the recovery page and use your recovery key. It makes a passkey on this device and asks for a
recovery, which waits 48 hours onchain. You are told on every channel, and any signed-in device or Telegram can cancel
it without Face ID until then. Once the 48 hours pass, use your recovery key again: this device's new passkey replaces
the old ones, every other device is signed out, and this device is signed in with its new passkey.
