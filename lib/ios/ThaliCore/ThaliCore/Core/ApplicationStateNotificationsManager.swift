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
  public var willEnterBackgroundHandler: ((Void) -> Void)?
  public var didEnterForegroundHandler: ((Void) -> Void)?

  // MARK: - Public methods
  public override init() {
    super.init()
    subscribeAppStateNotifications()
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  // MARK: - Private methods
  @objc fileprivate func applicationWillResignActiveNotification(_ notification: Notification) {
    willEnterBackgroundHandler?()
  }

  @objc fileprivate func applicationDidBecomeActiveNotification(_ notification: Notification) {
    didEnterForegroundHandler?()
  }

  fileprivate func subscribeAppStateNotifications() {
    let notificationCenter = NotificationCenter.default
    notificationCenter.addObserver(self,
                                   selector: #selector(applicationWillResignActiveNotification(_:)),
                                   name: NSNotification.Name.UIApplicationWillResignActive,
                                   object: nil)
    notificationCenter.addObserver(self,
                                   selector: #selector(applicationDidBecomeActiveNotification(_:)),
                                   name: NSNotification.Name.UIApplicationDidBecomeActive,
                                   object: nil)
  }
}
