package io.jxcore.node;

import android.content.Context;
import android.os.Bundle;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;

import java.lang.reflect.Field;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class LifeCycleMonitorTest {

    LifeCycleMonitor mLifeCycleMonitor;
    LifeCycleMonitor.LifeCycleMonitorListener mListener;
    Context mContext;
    LifeCycleMonitor.ActivityLifeCycleEvent lastEvent;

    @Rule
    public ExpectedException thrown = ExpectedException.none();

    @Before
    public void setUp() throws Exception {
        mContext = jxcore.activity.getBaseContext();
        mListener = new LifeCycleMonitorListenerMock();
        mLifeCycleMonitor = new LifeCycleMonitor(mListener);
    }

    @Test
    public void constructor() throws Exception {
        LifeCycleMonitor lcm = new LifeCycleMonitor(new LifeCycleMonitorListenerMock());

        assertThat("The object is properly created",
                lcm,
                is(notNullValue()));

        thrown.expect(NullPointerException.class);
        lcm = new LifeCycleMonitor(null); //Throws NullPointerException
    }

    @Test
    public void testStartStop() throws Exception {
        Field mIsStartedField = mLifeCycleMonitor.getClass().getDeclaredField("mIsStarted");
        mIsStartedField.setAccessible(true);

        mLifeCycleMonitor.start();

        assertThat("The mIsStarted flag is properly set",
                mIsStartedField.getBoolean(mLifeCycleMonitor),
                is(true));

        mLifeCycleMonitor.stop();

        assertThat("The mIsStarted flag is properly set",
                mIsStartedField.getBoolean(mLifeCycleMonitor),
                is(false));
    }

    @Test
    public void testOnActivityCreated() throws Exception {
        mLifeCycleMonitor.onActivityCreated(jxcore.activity, new Bundle());

        assertThat("The proper event is called on onActivityCreated",
                lastEvent,
                is(LifeCycleMonitor.ActivityLifeCycleEvent.CREATED));
    }

    @Test
    public void testOnActivityStarted() throws Exception {
        mLifeCycleMonitor.onActivityStarted(jxcore.activity);

        assertThat("The proper event is called on onActivityStarted",
                lastEvent,
                is(LifeCycleMonitor.ActivityLifeCycleEvent.STARTED));
    }

    @Test
    public void testOnActivityResumed() throws Exception {
        mLifeCycleMonitor.onActivityResumed(jxcore.activity);

        assertThat("The proper event is called on onActivityResumed",
                lastEvent,
                is(LifeCycleMonitor.ActivityLifeCycleEvent.RESUMED));
    }

    @Test
    public void testOnActivityPaused() throws Exception {
        mLifeCycleMonitor.onActivityPaused(jxcore.activity);

        assertThat("The proper event is called on onActivityPaused",
                lastEvent,
                is(LifeCycleMonitor.ActivityLifeCycleEvent.PAUSED));
    }

    @Test
    public void testOnActivityStopped() throws Exception {
        mLifeCycleMonitor.onActivityStopped(jxcore.activity);

        assertThat("The proper event is called on onActivityStopped",
                lastEvent,
                is(LifeCycleMonitor.ActivityLifeCycleEvent.STOPPED));
    }

    @Test
    public void testOnActivitySaveInstanceState() throws Exception {
        mLifeCycleMonitor.onActivitySaveInstanceState(jxcore.activity, new Bundle());

        assertThat("The proper event is called on onActivitySaveInstanceState",
                lastEvent,
                is(LifeCycleMonitor.ActivityLifeCycleEvent.SAVE_INSTANCE_STATE));
    }

    @Test
    public void testOnActivityDestroyed() throws Exception {
        mLifeCycleMonitor.onActivityDestroyed(jxcore.activity);

        assertThat("The proper event is called on onActivityDestroyed",
                lastEvent,
                is(LifeCycleMonitor.ActivityLifeCycleEvent.DESTROYED));
    }

    class LifeCycleMonitorListenerMock implements LifeCycleMonitor.LifeCycleMonitorListener {
        @Override
        public void onActivityLifeCycleEvent(LifeCycleMonitor.ActivityLifeCycleEvent
                                                             activityLifeCycleEvent) {
            lastEvent = activityLifeCycleEvent;
        }
    }
}