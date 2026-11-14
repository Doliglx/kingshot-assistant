package com.doliglx.ksassist;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;

/**
 * Auto clicker.
 *
 * Android only lets an app inject taps into other apps through an accessibility
 * service, so this is one — but a deliberately narrow one:
 *  - it requests no accessibility events and cannot read window content
 *    (see res/xml/autoclick_service.xml), so it never sees what is on screen;
 *  - it only taps the points the user placed with the on-screen markers;
 *  - it stops when the screen turns off, when the device rotates, after
 *    repeated failures, and of course from its always-visible stop button.
 */
public class AutoClickService extends AccessibilityService {

    private static final int ORANGE = 0xFFFA5D36;
    private static final int PANEL_BG = 0xF0120C0A;
    private static final long MIN_GAP_MS = 30;
    private static final int MAX_FAILURES = 5;

    private static volatile AutoClickService instance;

    static AutoClickService get() {
        return instance;
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager wm;

    // Macro being shown / run
    private AutoClickStore.Config config;
    private final List<Marker> markers = new ArrayList<>();

    // Floating panel
    private LinearLayout panel;
    private WindowManager.LayoutParams panelParams;
    private TextView playBtn;
    private TextView statusView;

    // Texts in the app language
    private String tReady = "Ready";
    private String tRunning = "Running";
    private String tStartsIn = "Starts in";
    private String tDone = "Done";

    // Run state
    private boolean running = false;
    private int targetIndex = 0;
    private int repeatIndex = 0;
    private int cycleCount = 0;
    private int failures = 0;
    private int countdown = 0;
    private long runStartedAt = 0;

    private final BroadcastReceiver screenOff = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            stopRun(tReady);
        }
    };

    // ------------------------------------------------------------------
    // Service lifecycle

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        instance = this;
        ContextCompat.registerReceiver(
            this,
            screenOff,
            new IntentFilter(Intent.ACTION_SCREEN_OFF),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // No event type is requested: nothing is ever delivered here.
    }

    @Override
    public void onInterrupt() {
        stopRun(tReady);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // After a rotation the saved positions no longer match the screen.
        stopRun(tReady);
    }

    @Override
    public boolean onUnbind(Intent intent) {
        teardown();
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        teardown();
        super.onDestroy();
    }

    private void teardown() {
        if (instance == this) instance = null;
        hidePanel();
        try {
            unregisterReceiver(screenOff);
        } catch (IllegalArgumentException ignored) {}
    }

    // ------------------------------------------------------------------
    // Called by the plugin (always on the main thread)

    boolean isPanelShown() {
        return panel != null;
    }

    boolean isRunning() {
        return running;
    }

    String shownConfigId() {
        return config != null && panel != null ? config.id : "";
    }

    boolean showPanel(String configId, String ready, String runningText, String startsIn, String done) {
        AutoClickStore.Config loaded = AutoClickStore.load(this, configId);
        if (loaded == null) return false;
        hidePanel();
        config = loaded;
        if (ready != null) tReady = ready;
        if (runningText != null) tRunning = runningText;
        if (startsIn != null) tStartsIn = startsIn;
        if (done != null) tDone = done;
        buildPanel();
        rebuildMarkers();
        return true;
    }

    void hidePanel() {
        stopRun(tReady);
        removeMarkers();
        if (panel != null) {
            try {
                wm.removeView(panel);
            } catch (RuntimeException ignored) {}
        }
        panel = null;
        playBtn = null;
        statusView = null;
    }

    // ------------------------------------------------------------------
    // Run loop

    private final Runnable stepRunnable = this::step;

    private final Runnable countdownRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            if (countdown > 0) {
                setStatus(tStartsIn + " " + countdown);
                countdown--;
                handler.postDelayed(this, 1000);
            } else {
                runStartedAt = SystemClock.elapsedRealtime();
                updateRunStatus();
                step();
            }
        }
    };

    private void startRun() {
        if (running || config == null) return;
        // Read the real on-screen centre of every marker, then persist it.
        for (Marker m : markers) m.syncToTarget();
        AutoClickStore.saveTargets(this, config);

        running = true;
        targetIndex = 0;
        repeatIndex = 0;
        cycleCount = 0;
        failures = 0;
        countdown = config.startDelaySec;
        setMarkersPassThrough(true);
        if (playBtn != null) playBtn.setText("■");
        handler.post(countdownRunnable);
    }

    private void stopRun(String status) {
        handler.removeCallbacks(stepRunnable);
        handler.removeCallbacks(countdownRunnable);
        if (!running) return;
        running = false;
        setMarkersPassThrough(false);
        if (playBtn != null) playBtn.setText("▶");
        setStatus(status);
    }

    private void step() {
        if (!running || config == null) return;
        if (
            "duration".equals(config.stop) &&
            SystemClock.elapsedRealtime() - runStartedAt >= config.durationSec * 1000L
        ) {
            stopRun(tDone);
            return;
        }
        AutoClickStore.Target t = config.targets.get(targetIndex);
        GestureDescription gesture = buildGesture(t);
        boolean accepted =
            gesture != null &&
            dispatchGesture(
                gesture,
                new GestureResultCallback() {
                    @Override
                    public void onCompleted(GestureDescription g) {
                        failures = 0;
                        advance();
                    }

                    @Override
                    public void onCancelled(GestureDescription g) {
                        onFailure();
                    }
                },
                handler
            );
        if (!accepted) onFailure();
    }

    private void onFailure() {
        if (!running) return;
        if (++failures >= MAX_FAILURES) {
            stopRun(tReady);
            return;
        }
        advance();
    }

    private void advance() {
        if (!running || config == null) return;
        AutoClickStore.Target t = config.targets.get(targetIndex);
        boolean multi = "multi".equals(config.mode);
        long wait = multi ? t.delayAfterMs : 0;

        if (++repeatIndex >= t.repeat) {
            repeatIndex = 0;
            targetIndex++;
        }
        if (targetIndex >= config.targets.size()) {
            targetIndex = 0;
            cycleCount++;
            updateRunStatus();
            if ("cycles".equals(config.stop) && cycleCount >= config.cycles) {
                stopRun(tDone);
                return;
            }
            wait += config.intervalMs;
        }
        handler.postDelayed(stepRunnable, Math.max(MIN_GAP_MS, wait));
    }

    private GestureDescription buildGesture(AutoClickStore.Target t) {
        if (!t.placed()) return null;
        DisplayMetrics dm = realMetrics();
        float x = clampF(t.x, 1, dm.widthPixels - 1);
        float y = clampF(t.y, 1, dm.heightPixels - 1);
        Path path = new Path();
        path.moveTo(x, y);
        long duration = AutoClickStore.TAP_MS;
        if ("hold".equals(t.type)) {
            duration = t.holdMs;
        } else if ("swipe".equals(t.type) && t.endPlaced()) {
            path.lineTo(clampF(t.x2, 1, dm.widthPixels - 1), clampF(t.y2, 1, dm.heightPixels - 1));
            duration = t.swipeMs;
        }
        duration = Math.min(duration, GestureDescription.getMaxGestureDuration());
        try {
            return new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, duration))
                .build();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private void updateRunStatus() {
        String count = "cycles".equals(config.stop) ? cycleCount + "/" + config.cycles : String.valueOf(cycleCount);
        setStatus(tRunning + " · " + count);
    }

    private void setStatus(String s) {
        if (statusView != null) statusView.setText(s);
    }

    // ------------------------------------------------------------------
    // Floating panel

    private void buildPanel() {
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.HORIZONTAL);
        panel.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(PANEL_BG);
        bg.setCornerRadius(dp(26));
        bg.setStroke(dp(2), ORANGE);
        panel.setBackground(bg);
        panel.setPadding(dp(6), dp(4), dp(6), dp(4));

        playBtn = iconButton("▶", ORANGE);
        playBtn.setOnClickListener(v -> {
            if (running) stopRun(tReady);
            else startRun();
        });
        panel.addView(playBtn);

        statusView = new TextView(this);
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        statusView.setTypeface(Typeface.DEFAULT_BOLD);
        statusView.setPadding(dp(8), dp(10), dp(8), dp(10));
        statusView.setMinWidth(dp(72));
        statusView.setMaxLines(1);
        statusView.setText(tReady);
        statusView.setOnTouchListener(new PanelDrag());
        panel.addView(statusView);

        if ("multi".equals(config.mode)) {
            TextView add = iconButton("＋", Color.WHITE);
            add.setOnClickListener(v -> addTarget());
            panel.addView(add);
            TextView remove = iconButton("－", Color.WHITE);
            remove.setOnClickListener(v -> removeLastTarget());
            panel.addView(remove);
        }

        TextView close = iconButton("✕", 0xFFBBBBBB);
        close.setOnClickListener(v -> hidePanel());
        panel.addView(close);

        panelParams = overlayParams(true);
        panelParams.x = dp(12);
        panelParams.y = dp(96);
        try {
            wm.addView(panel, panelParams);
        } catch (RuntimeException e) {
            panel = null;
        }
    }

    private TextView iconButton(String symbol, int color) {
        TextView b = new TextView(this);
        b.setText(symbol);
        b.setTextColor(color);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        b.setGravity(Gravity.CENTER);
        b.setMinWidth(dp(44));
        b.setMinHeight(dp(44));
        return b;
    }

    private void addTarget() {
        if (running || config == null || config.targets.size() >= AutoClickStore.MAX_TARGETS) return;
        AutoClickStore.Target t = new AutoClickStore.Target();
        t.id = "t" + System.currentTimeMillis();
        config.targets.add(t);
        rebuildMarkers();
        persist();
    }

    private void removeLastTarget() {
        if (running || config == null || config.targets.size() <= 1) return;
        config.targets.remove(config.targets.size() - 1);
        rebuildMarkers();
        persist();
    }

    private void persist() {
        if (config == null) return;
        for (Marker m : markers) m.syncToTarget();
        AutoClickStore.saveTargets(this, config);
    }

    private class PanelDrag implements View.OnTouchListener {
        private int startX, startY;
        private float downX, downY;

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            if (panel == null) return false;
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    startX = panelParams.x;
                    startY = panelParams.y;
                    downX = e.getRawX();
                    downY = e.getRawY();
                    return true;
                case MotionEvent.ACTION_MOVE:
                    panelParams.x = startX + (int) (e.getRawX() - downX);
                    panelParams.y = startY + (int) (e.getRawY() - downY);
                    try {
                        wm.updateViewLayout(panel, panelParams);
                    } catch (RuntimeException ignored) {}
                    return true;
                default:
                    return true;
            }
        }
    }

    // ------------------------------------------------------------------
    // Target markers

    private void rebuildMarkers() {
        removeMarkers();
        if (config == null) return;
        DisplayMetrics dm = realMetrics();
        for (int i = 0; i < config.targets.size(); i++) {
            AutoClickStore.Target t = config.targets.get(i);
            if (!t.placed()) {
                // Default spot: screen centre, slightly staggered.
                t.x = dm.widthPixels / 2f + (i % 5 - 2) * dp(56);
                t.y = dm.heightPixels / 2f + (i / 5) * dp(56);
            }
            markers.add(new Marker(t, i + 1, false));
            if ("swipe".equals(t.type)) {
                if (!t.endPlaced()) {
                    t.x2 = t.x;
                    t.y2 = Math.max(dp(40), t.y - dp(160));
                }
                markers.add(new Marker(t, i + 1, true));
            }
        }
    }

    private void removeMarkers() {
        for (Marker m : markers) m.remove();
        markers.clear();
    }

    private void setMarkersPassThrough(boolean passThrough) {
        for (Marker m : markers) m.setPassThrough(passThrough);
    }

    /** One draggable numbered circle. While a macro runs it lets touches through. */
    private class Marker implements View.OnTouchListener {
        final AutoClickStore.Target target;
        final boolean isEnd;
        final TextView view;
        final WindowManager.LayoutParams params;
        final int size;
        private int startX, startY;
        private float downX, downY;
        private boolean attached;

        Marker(AutoClickStore.Target target, int number, boolean isEnd) {
            this.target = target;
            this.isEnd = isEnd;
            size = dp(isEnd ? 36 : 46);
            view = new TextView(AutoClickService.this);
            view.setText(isEnd ? number + "»" : String.valueOf(number));
            view.setTextColor(Color.WHITE);
            view.setTextSize(TypedValue.COMPLEX_UNIT_SP, isEnd ? 12 : 16);
            view.setTypeface(Typeface.DEFAULT_BOLD);
            view.setGravity(Gravity.CENTER);
            GradientDrawable bg = new GradientDrawable();
            bg.setShape(GradientDrawable.OVAL);
            bg.setColor(isEnd ? 0x99333333 : 0xB3FA5D36);
            bg.setStroke(dp(2), Color.WHITE);
            view.setBackground(bg);
            view.setOnTouchListener(this);

            params = overlayParams(false);
            params.width = size;
            params.height = size;
            float cx = isEnd ? target.x2 : target.x;
            float cy = isEnd ? target.y2 : target.y;
            params.x = Math.round(cx - size / 2f);
            params.y = Math.round(cy - size / 2f);
            try {
                wm.addView(view, params);
                attached = true;
                final float wantX = cx, wantY = cy;
                // Correct any offset the system applied (cut-outs, bars).
                view.post(() -> nudgeTo(wantX, wantY));
            } catch (RuntimeException e) {
                attached = false;
            }
        }

        private void nudgeTo(float cx, float cy) {
            if (!attached) return;
            int[] loc = new int[2];
            view.getLocationOnScreen(loc);
            int dx = Math.round(cx - (loc[0] + size / 2f));
            int dy = Math.round(cy - (loc[1] + size / 2f));
            if (dx == 0 && dy == 0) return;
            params.x += dx;
            params.y += dy;
            try {
                wm.updateViewLayout(view, params);
            } catch (RuntimeException ignored) {}
        }

        /** Copies the marker's real on-screen centre into the target. */
        void syncToTarget() {
            if (!attached) return;
            int[] loc = new int[2];
            view.getLocationOnScreen(loc);
            float cx = loc[0] + size / 2f;
            float cy = loc[1] + size / 2f;
            if (isEnd) {
                target.x2 = cx;
                target.y2 = cy;
            } else {
                target.x = cx;
                target.y = cy;
            }
        }

        void setPassThrough(boolean on) {
            if (!attached) return;
            if (on) params.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
            else params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
            view.setAlpha(on ? 0.35f : 1f);
            try {
                wm.updateViewLayout(view, params);
            } catch (RuntimeException ignored) {}
        }

        void remove() {
            if (!attached) return;
            attached = false;
            try {
                wm.removeView(view);
            } catch (RuntimeException ignored) {}
        }

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            if (!attached || running) return false;
            int slop = ViewConfiguration.get(AutoClickService.this).getScaledTouchSlop();
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    startX = params.x;
                    startY = params.y;
                    downX = e.getRawX();
                    downY = e.getRawY();
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = e.getRawX() - downX, dy = e.getRawY() - downY;
                    if (Math.abs(dx) < slop && Math.abs(dy) < slop) return true;
                    params.x = startX + (int) dx;
                    params.y = startY + (int) dy;
                    try {
                        wm.updateViewLayout(view, params);
                    } catch (RuntimeException ignored) {}
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    // Save once the system has laid the marker out at its new place.
                    view.post(AutoClickService.this::persist);
                    return true;
                default:
                    return false;
            }
        }
    }

    // ------------------------------------------------------------------
    // Helpers

    private WindowManager.LayoutParams overlayParams(boolean wrap) {
        WindowManager.LayoutParams p = new WindowManager.LayoutParams(
            wrap ? WindowManager.LayoutParams.WRAP_CONTENT : 0,
            wrap ? WindowManager.LayoutParams.WRAP_CONTENT : 0,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        p.gravity = Gravity.TOP | Gravity.START;
        if (Build.VERSION.SDK_INT >= 30) {
            p.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        } else if (Build.VERSION.SDK_INT >= 28) {
            p.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        return p;
    }

    @SuppressWarnings("deprecation")
    private DisplayMetrics realMetrics() {
        DisplayMetrics dm = new DisplayMetrics();
        wm.getDefaultDisplay().getRealMetrics(dm);
        return dm;
    }

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private static float clampF(float v, float min, float max) {
        return Math.max(min, Math.min(max, v));
    }
}
