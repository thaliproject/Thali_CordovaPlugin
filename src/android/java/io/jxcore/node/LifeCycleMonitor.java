package io.jxcore.node;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;

import io.jxcore.node.jxcore;

/**
 * Created by juksilve on 13.5.2015.
 */
class LifeCycleMonitor implements Application.ActivityLifecycleCallbacks {

    private Application MyApp = null;

    public interface onLCEventCallback {
        void onEvent(String eventString, boolean stopped);
    }

    public final String ACTIVITY_CREATED = "onActivityCreated";
    public final String ACTIVITY_STARTED = "onActivityStarted";
    public final String ACTIVITY_RESUMED = "onActivityResumed";
    public final String ACTIVITY_PAUSED = "onActivityPaused";
    public final String ACTIVITY_STOPPED = "onActivityStopped";
    public final String ACTIVITY_SAVE_INST = "onActivitySaveInstanceState";
    public final String ACTIVITY_DESTROYED = "onActivityDestroyed";

    //BtConnectorHelper.jxCallBack jxcore = null; // remove the line
    private final Activity activity = jxcore.activity;
    private onLCEventCallback callback = null;

    public LifeCycleMonitor(onLCEventCallback Callback) {
        callback = Callback;
    }

    public void Start() {
        Application tmpApp = activity.getApplication();
        if (tmpApp != null) {
            try {
                tmpApp.registerActivityLifecycleCallbacks(this);
            } catch (IllegalArgumentException e) {
                e.printStackTrace();
            }
        }

        this.MyApp = tmpApp;
    }

    public void Stop() {
        Application tmpApp = this.MyApp;
        this.MyApp = null;
        if (tmpApp != null) {
            try {
                tmpApp.unregisterActivityLifecycleCallbacks(this);
            } catch (IllegalArgumentException e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
        callback.onEvent(ACTIVITY_CREATED, false);
    }

    @Override
    public void onActivityStarted(Activity activity) {
        callback.onEvent(ACTIVITY_STARTED, false);
    }

    @Override
    public void onActivityResumed(Activity activity) {
        callback.onEvent(ACTIVITY_RESUMED, false);
    }

    @Override
    public void onActivityPaused(Activity activity) {
        callback.onEvent(ACTIVITY_PAUSED, false);
    }

    @Override
    public void onActivityStopped(Activity activity) {
        callback.onEvent(ACTIVITY_STOPPED, false);
    }

    @Override
    public void onActivitySaveInstanceState(Activity activity, Bundle outState) {
        callback.onEvent(ACTIVITY_SAVE_INST, false);
    }

    @Override
    public void onActivityDestroyed(Activity activity) {
        Stop();
        callback.onEvent(ACTIVITY_DESTROYED, true);
    }
}
