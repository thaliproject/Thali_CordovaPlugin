/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.util.Log;

/**
 * Monitors the life cycle events of the JXcore activity.
 */
class LifeCycleMonitor implements Application.ActivityLifecycleCallbacks {

    public enum ActivityLifeCycleEvent {
        CREATED,
        STARTED,
        PAUSED,
        RESUMED,
        STOPPED,
        SAVE_INSTANCE_STATE,
        DESTROYED
    }

    public interface LifeCycleMonitorListener {
        void onActivityLifeCycleEvent(ActivityLifeCycleEvent activityLifeCycleEvent);
    }

    private static final String TAG = LifeCycleMonitor.class.getName();
    private Application mApplication = null;
    private LifeCycleMonitorListener mListener = null;
    private boolean mIsStarted = false;

    /**
     * Constructor.
     *
     * @param listener The listener.
     */
    public LifeCycleMonitor(LifeCycleMonitorListener listener) {
        if (listener == null) {
            throw new NullPointerException("Listener cannot be null");
        }

        mListener = listener;
    }

    /**
     * Starts listening to life cycle callbacks.
     *
     * @return True, if started successfully (or already running). False otherwise.
     */
    public synchronized boolean start() {
        if (!mIsStarted) {
            try {
                mApplication = jxcore.activity.getApplication();
            } catch (NullPointerException e) {
                Log.e(TAG, "start: Failed to get the application instance: " + e.getMessage(), e);
            }

            if (mApplication != null) {
                try {
                    mApplication.registerActivityLifecycleCallbacks(this);
                    mIsStarted = true;
                    Log.i(TAG, "start: OK");
                } catch (IllegalArgumentException e) {
                    Log.e(TAG, "start: Failed register to receive life cycle callbacks: " + e.getMessage(), e);
                }
            } else {
                Log.e(TAG, "start: Failed to get the application instance");
            }
        }

        return mIsStarted;
    }

    /**
     * Stops listening to life cycle callbacks. This method is automatically called when the
     * activity we are monitoring is destroyed.
     */
    public synchronized void stop() {
        if (mApplication != null) {
            try {
                mApplication.unregisterActivityLifecycleCallbacks(this);
                Log.i(TAG, "stop: OK");
            } catch (IllegalArgumentException e) {
                Log.e(TAG, "stop: Failed unregister life cycle callbacks: " + e.getMessage(), e);
            }

            mApplication = null;
            mIsStarted = false;
        }
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
        Log.d(TAG, "onActivityCreated: " + savedInstanceState);
        mListener.onActivityLifeCycleEvent(ActivityLifeCycleEvent.CREATED);
    }

    @Override
    public void onActivityStarted(Activity activity) {
        Log.d(TAG, "onActivityStarted");
        mListener.onActivityLifeCycleEvent(ActivityLifeCycleEvent.STARTED);
    }

    @Override
    public void onActivityResumed(Activity activity) {
        Log.d(TAG, "onActivityResumed");
        mListener.onActivityLifeCycleEvent(ActivityLifeCycleEvent.RESUMED);
    }

    @Override
    public void onActivityPaused(Activity activity) {
        Log.d(TAG, "onActivityPaused");
        mListener.onActivityLifeCycleEvent(ActivityLifeCycleEvent.PAUSED);
    }

    @Override
    public void onActivityStopped(Activity activity) {
        Log.d(TAG, "onActivityStopped");
        mListener.onActivityLifeCycleEvent(ActivityLifeCycleEvent.STOPPED);
    }

    @Override
    public void onActivitySaveInstanceState(Activity activity, Bundle outState) {
        Log.d(TAG, "onActivitySaveInstanceState: " + activity + " " + outState);
        mListener.onActivityLifeCycleEvent(ActivityLifeCycleEvent.SAVE_INSTANCE_STATE);
    }

    @Override
    public void onActivityDestroyed(Activity activity) {
        Log.d(TAG, "onActivityDestroyed");
        mListener.onActivityLifeCycleEvent(ActivityLifeCycleEvent.DESTROYED);
        stop();
    }
}
