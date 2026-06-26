const { notarize } = require('@electron/notarize')

module.exports = async function notarizeMacBuild(context) {
  if (process.platform !== 'darwin') return
  if (process.env.SKIP_NOTARIZE === 'true') {
    console.log('[notarize] skipped: SKIP_NOTARIZE=true')
    return
  }

  const { electronPlatformName, appOutDir, packager } = context
  if (electronPlatformName !== 'darwin') return

  const appName = packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`
  const appBundleId = packager.appInfo.appId

  const hasAppleIdCredentials =
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID

  const hasApiKeyCredentials =
    process.env.APPLE_API_KEY &&
    process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER

  if (!hasAppleIdCredentials && !hasApiKeyCredentials) {
    console.log('[notarize] skipped: no Apple notarization credentials in environment')
    return
  }

  console.log(`[notarize] submitting ${appPath}`)

  if (hasAppleIdCredentials) {
    await notarize({
      appBundleId,
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    })
    return
  }

  await notarize({
    appBundleId,
    appPath,
    appleApiKey: process.env.APPLE_API_KEY,
    appleApiKeyId: process.env.APPLE_API_KEY_ID,
    appleApiIssuer: process.env.APPLE_API_ISSUER
  })
}
