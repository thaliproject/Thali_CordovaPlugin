'use strict';

module.exports = {
  env : {
    BLUEBIRD_DEBUG: false
  },

  // Tests are ordered in the dependency order to avoid testing modules
  // before all its dependencies have been tested.
  preferredOrder: [
    'testMakeIntoCloseAllServer.js',
    'testPouchDBCheckpointPlugin.js',
    'testPouchDBGenerator.js',
    'testPromiseQueue.js',
    'testTests.js',
    'testUsn.js',
    'testNativeMethod.js',
    'testThaliMobileNative.js',
    'testThaliMobileNativeAndroid.js',
    'testThaliMobileNativeiOS.js',
    'testThaliMobileNativeDiscoveryCoordinated.js',
    'testCreateNativeListener.js',
    'testCreatePeerListener.js',
    'testThaliTcpServersManager.js',
    'testHttp.js',
    'testThaliMobileNativeWrapper.js',
    'testThaliWifiInfrastructure.js',
    'testThaliMobile.js',
    'testThaliPeerAction.js',
    'testThaliPeerDictionary.js',
    'testThaliPeerPoolDefault.js',
    'testThaliPeerPoolInterface.js',
    'testThaliPeerPoolOneAtATime.js',
    'testThaliNotification.js',
    'testThaliNotificationAction.js',
    'testThaliNotificationBeacons.js',
    'testThaliNotificationClient.js',
    'testThaliNotificationLocal.js',
    'testThaliNotificationServer.js',
    'testThaliPullReplicationFromNotification.js',
    'testThaliPullReplicationFromNotificationCoordinated.js',
    'testThaliReplicationPeerAction.js',
    'testThaliReplicationPeerActionCoordinated.js',
    'testThaliReplicationUtilities.js',
    'testThaliSendNotificationBasedOnReplication.js',
    'testLocalSeqManager.js',
    'testLocalSeqManagerCoordinated.js',
    'testThaliManager.js',
    'testThaliManagerCoordinated.js'
  ]
};
