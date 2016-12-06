//
//  Thali CordovaPlugin
//  ApplicationStateNotificationsManager.swift
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license.
//  See LICENSE.txt file in the project root for full license information.
//

import UIKit

/// Class that listens for UIApplicationWillResignActiveNotification and
/// UIApplicationDidBecomeActiveNotification
public final class ApplicationStateNotificationsManager: NSObject {

  // MARK: - Public state
  public var willEnterBackgroundHandler: (Void -> Void)?
  public var didEnterForegroundHandler: (Void -> Void)?

  // MARK: - Public methods
  public override init() {
    super.init()
    subscribeAppStateNotifications()
  }

  deinit {
    NSNotificationCenter.defaultCenter().removeObserver(self)
  }

  // MARK: - Private methods
  @objc private func applicationWillResignActiveNotification(notification: NSNotification) {
    willEnterBackgroundHandler?()
  }

  @objc private func applicationDidBecomeActiveNotification(notification: NSNotification) {
    didEnterForegroundHandler?()
  }

  private func subscribeAppStateNotifications() {
    let notificationCenter = NSNotificationCenter.defaultCenter()
    notificationCenter.addObserver(self,
                                   selector: #selector(applicationWillResignActiveNotification(_:)),
                                   name: UIApplicationWillResignActiveNotification,
                                   object: nil)
    notificationCenter.addObserver(self,
                                   selector: #selector(applicationDidBecomeActiveNotification(_:)),
                                   name: UIApplicationDidBecomeActiveNotification,
                                   object: nil)
  }
}
