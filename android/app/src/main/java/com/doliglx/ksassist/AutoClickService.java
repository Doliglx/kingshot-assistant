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
import android.text.TextUtils;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Auto clicker.
 *
 * Android only lets an app inject taps into other apps through an accessibility
 * service, so this is one — but a deliberately narrow one:
 *  - it requests no accessibility events and cannot read window content
 *    (see res/xml/autoclick_service.xml), so it never sees what is on screen;
 *  - it only taps the points the user placed with the on-screen markers;
 *  - it stops when the screen turns off, when the device rotates, when gestures
 *    keep failing, and from its always-visible stop button.
 *
 * Everything can be set from the floating panel itself: macro, timing, stop
 * rule, and each target's action. Values are edited with steppers because an
 * overlay that never takes focus cannot show a keyboard.
 */
public class AutoClickService extends AccessibilityService {

    private static final int ORANGE = 0xFFFA5D36;
    private static final int PANEL_BG = 0xF0120C0A;
    private static final int MUTED = 0xFFAAAAAA;
    /** Give up when no gesture has succeeded for this long. */
    private static final long FAILURE_WINDOW_MS = 2000;
    private static final long STATUS_EVERY_MS = 200;

    private static volatile AutoClickService instance;

    static AutoClickService get() {
        return instance;
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager wm;

    // Macro being shown / run
    private AutoClickStore.Config config;
    private int selected = 0; // target shown in the settings
    private final List<Marker> markers = new ArrayList<>();

    // Floating panel
    private LinearLayout panel;
    private WindowManager.LayoutParams panelParams;
    private TextView playBtn;
    private TextView statusView;
    private LinearLayout bar;
    private LinearLayout settings;
    private TextView compactBtn;
    private final List<View> fullOnly = new ArrayList<>();
    private boolean compact = false;
    private boolean markersHidden = false;
    private TextView eyeBtn;
    /** Accent colour of the app, sent with the texts ("accent": "#rrggbb"). */
    private int accent = ORANGE;
    private AutoClickStore.Appearance appearance = new AutoClickStore.Appearance();
    private final List<Runnable> refreshers = new ArrayList<>();

    // Texts in the app language (English until the app sends its own)
    private final Map<String, String> texts = new HashMap<>();

    // Run state
    private boolean running = false;
    private int targetIndex = 0;
    private int repeatIndex = 0;
    private int cycleCount = 0;
    private int countdown = 0;
    private long runStartedAt = 0;
    private long lastSuccessAt = 0;
    private long lastStatusAt = 0;
    private long tapCount = 0;

    private final BroadcastReceiver screenOff = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            stopRun(t("ready"));
        }
    };

    // ------------------------------------------------------------------
    // Service lifecycle

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        appearance = AutoClickStore.loadAppearance(this);
        defaultTexts();
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
        stopRun(t("ready"));
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // After a rotation the saved positions no longer match the screen.
        stopRun(t("ready"));
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

    private void defaultTexts() {
        String[][] d = {
            { "ready", "Ready" }, { "running", "Running" }, { "startsIn", "Starts in" }, { "done", "Done" },
            { "macro", "Macro" }, { "newMacro", "Macro" }, { "interval", "Interval (ms)" },
            { "cyclePause", "Pause between cycles (ms)" }, { "startDelay", "Start delay (s)" },
            { "stop", "Stop" }, { "infinite", "Manual" }, { "cycles", "Cycles" }, { "seconds", "Seconds" },
            { "target", "Target" }, { "action", "Action" }, { "tap", "Tap" }, { "hold", "Long press" },
            { "swipe", "Swipe" }, { "tapMs", "Tap duration (ms)" }, { "holdMs", "Press duration (ms)" },
            { "swipeMs", "Swipe duration (ms)" }, { "delayAfter", "Wait after (ms)" }, { "repeat", "Repeat" },
            { "mode", "Mode" }, { "sequence", "One after another" }, { "simultaneous", "All at once" },
            { "markerSize", "Marker size" }, { "small", "Small" }, { "medium", "Medium" }, { "large", "Large" },
            { "opacity", "Panel opacity (%)" }, { "hideWhileRunning", "Hide markers while running" },
            { "yes", "Yes" }, { "no", "No" },
        };
        for (String[] kv : d) if (!texts.containsKey(kv[0])) texts.put(kv[0], kv[1]);
    }

    private String t(String key) {
        String v = texts.get(key);
        return v == null ? key : v;
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

    boolean showPanel(String configId, Map<String, String> newTexts) {
        AutoClickStore.Config loaded = AutoClickStore.load(this, configId);
        if (loaded == null) return false;
        if (newTexts != null) texts.putAll(newTexts);
        accent = parseColor(texts.get("accent"), ORANGE);
        boolean settingsOpen = settings != null && settings.getVisibility() == View.VISIBLE;
        int x = panelParams != null ? panelParams.x : dp(12);
        int y = panelParams != null ? panelParams.y : dp(96);
        hidePanel();
        config = loaded;
        selected = 0;
        buildPanel(x, y, settingsOpen);
        rebuildMarkers();
        return true;
    }

    /** The app changed the appearance settings: apply them to what is on screen. */
    void reloadAppearance() {
        appearance = AutoClickStore.loadAppearance(this);
        if (panel != null) panel.setAlpha(appearance.panelOpacity / 100f);
        if (!running) rebuildMarkers();
        refreshSettings();
    }

    void hidePanel() {
        stopRun(t("ready"));
        removeMarkers();
        if (panel != null) {
            try {
                wm.removeView(panel);
            } catch (RuntimeException ignored) {}
        }
        panel = null;
        playBtn = null;
        statusView = null;
        bar = null;
        settings = null;
        compactBtn = null;
        fullOnly.clear();
        refreshers.clear();
    }

    // ------------------------------------------------------------------
    // Run loop

    private final Runnable stepRunnable = this::step;

    /** Keeps the elapsed time moving even when the interval is long. */
    private final Runnable clockRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            updateRunStatus(true);
            handler.postDelayed(this, 500);
        }
    };

    private final Runnable countdownRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            if (countdown > 0) {
                setStatus(t("startsIn") + " " + countdown);
                countdown--;
                handler.postDelayed(this, 1000);
            } else {
                runStartedAt = SystemClock.elapsedRealtime();
                lastSuccessAt = runStartedAt;
                updateRunStatus(true);
                handler.postDelayed(clockRunnable, 500);
                step();
            }
        }
    };

    private void startRun() {
        if (running || config == null) return;
        // Read the real on-screen centre of every marker, then persist it.
        persist();
        if (settings != null) settings.setVisibility(View.GONE);

        running = true;
        targetIndex = 0;
        repeatIndex = 0;
        cycleCount = 0;
        tapCount = 0;
        countdown = config.startDelaySec;
        setMarkersPassThrough(true);
        if (playBtn != null) playBtn.setText("■");
        handler.post(countdownRunnable);
    }

    private void stopRun(String status) {
        handler.removeCallbacks(stepRunnable);
        handler.removeCallbacks(countdownRunnable);
        handler.removeCallbacks(clockRunnable);
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
            stopRun(t("done"));
            return;
        }
        if (targetIndex >= config.targets.size()) targetIndex = 0;
        boolean sync = "sync".equals(config.mode);
        GestureDescription gesture = sync ? buildSyncGesture() : buildGesture(config.targets.get(targetIndex));
        final int taps = gesture == null ? 0 : gesture.getStrokeCount();
        boolean accepted =
            gesture != null &&
            dispatchGesture(
                gesture,
                new GestureResultCallback() {
                    @Override
                    public void onCompleted(GestureDescription g) {
                        lastSuccessAt = SystemClock.elapsedRealtime();
                        tapCount += taps;
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

    /** A gesture was refused or cancelled (often because the user touched the screen). */
    private void onFailure() {
        if (!running) return;
        if (SystemClock.elapsedRealtime() - lastSuccessAt > FAILURE_WINDOW_MS) {
            stopRun(t("ready"));
            return;
        }
        handler.postDelayed(stepRunnable, 50);
    }

    private void advance() {
        if (!running || config == null) return;
        if ("sync".equals(config.mode)) {
            // Every target was pressed at once: that is one whole cycle.
            cycleCount++;
            if ("cycles".equals(config.stop) && cycleCount >= config.cycles) {
                stopRun(t("done"));
                return;
            }
            updateRunStatus(false);
            if (config.intervalMs <= 0) handler.post(stepRunnable);
            else handler.postDelayed(stepRunnable, config.intervalMs);
            return;
        }
        AutoClickStore.Target target = config.targets.get(targetIndex);
        boolean multi = "multi".equals(config.mode);
        long wait = multi ? target.delayAfterMs : 0;

        if (++repeatIndex >= target.repeat) {
            repeatIndex = 0;
            targetIndex++;
        }
        if (targetIndex >= config.targets.size()) {
            targetIndex = 0;
            cycleCount++;
            if ("cycles".equals(config.stop) && cycleCount >= config.cycles) {
                stopRun(t("done"));
                return;
            }
            updateRunStatus(false);
            wait += config.intervalMs;
        }
        if (wait <= 0) handler.post(stepRunnable);
        else handler.postDelayed(stepRunnable, wait);
    }

    private GestureDescription buildGesture(AutoClickStore.Target target) {
        GestureDescription.StrokeDescription stroke = buildStroke(target, realMetrics());
        if (stroke == null) return null;
        try {
            return new GestureDescription.Builder().addStroke(stroke).build();
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** All placed targets pressed together, as several fingers would (up to the system limit). */
    private GestureDescription buildSyncGesture() {
        DisplayMetrics dm = realMetrics();
        GestureDescription.Builder builder = new GestureDescription.Builder();
        int count = 0;
        int max = GestureDescription.getMaxStrokeCount();
        for (AutoClickStore.Target target : config.targets) {
            if (count >= max) break;
            GestureDescription.StrokeDescription stroke = buildStroke(target, dm);
            if (stroke == null) continue;
            builder.addStroke(stroke);
            count++;
        }
        if (count == 0) return null;
        try {
            return builder.build();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private GestureDescription.StrokeDescription buildStroke(AutoClickStore.Target target, DisplayMetrics dm) {
        if (!target.placed()) return null;
        float x = clampF(target.x, 1, dm.widthPixels - 1);
        float y = clampF(target.y, 1, dm.heightPixels - 1);
        Path path = new Path();
        path.moveTo(x, y);
        long duration = target.tapMs;
        if ("hold".equals(target.type)) {
            duration = target.holdMs;
        } else if ("swipe".equals(target.type) && target.endPlaced()) {
            path.lineTo(clampF(target.x2, 1, dm.widthPixels - 1), clampF(target.y2, 1, dm.heightPixels - 1));
            duration = target.swipeMs;
        }
        duration = Math.max(1, Math.min(duration, GestureDescription.getMaxGestureDuration()));
        try {
            return new GestureDescription.StrokeDescription(path, 0, duration);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** The counter is refreshed a few times per second at most, so fast loops stay fast. */
    private void updateRunStatus(boolean force) {
        long now = SystemClock.elapsedRealtime();
        if (!force && now - lastStatusAt < STATUS_EVERY_MS) return;
        lastStatusAt = now;
        // Cycles against the goal when stopping after N cycles, otherwise the number of taps.
        String count = "cycles".equals(config.stop) ? cycleCount + "/" + config.cycles : "×" + tapCount;
        long sec = runStartedAt > 0 ? (now - runStartedAt) / 1000 : 0;
        String elapsed = sec / 60 + ":" + (sec % 60 < 10 ? "0" : "") + sec % 60;
        setStatus(count + " · " + elapsed);
    }

    private void setStatus(String s) {
        if (statusView != null) statusView.setText(s);
    }

    // ------------------------------------------------------------------
    // Floating panel: control bar

    private void buildPanel(int x, int y, boolean settingsOpen) {
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(PANEL_BG);
        bg.setCornerRadius(dp(22));
        bg.setStroke(dp(2), accent);
        panel.setBackground(bg);
        panel.setPadding(dp(4), dp(2), dp(4), dp(2));

        fullOnly.clear();
        bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);

        // Every button also drags the panel: move the finger, it follows.
        playBtn = iconButton("▶", accent);
        DragOrClick playDrag = new DragOrClick(() -> {
            if (!running) startRun();
        });
        // While running, stop on touch-down: during a fast macro a full click may never complete.
        playBtn.setOnTouchListener((v, e) -> {
            if (running && e.getActionMasked() == MotionEvent.ACTION_DOWN) {
                stopRun(t("ready"));
                return true;
            }
            return running || playDrag.onTouch(v, e);
        });
        bar.addView(playBtn);

        statusView = new TextView(this);
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        statusView.setTypeface(Typeface.DEFAULT_BOLD);
        statusView.setPadding(dp(6), dp(10), dp(6), dp(10));
        statusView.setMinWidth(dp(64));
        statusView.setMaxWidth(dp(110));
        statusView.setMaxLines(1);
        statusView.setEllipsize(TextUtils.TruncateAt.END);
        statusView.setText(t("ready"));
        statusView.setOnTouchListener(new DragOrClick(null));
        bar.addView(statusView);
        fullOnly.add(statusView);

        eyeBtn = barButton("👁", Color.WHITE, () -> setMarkersHidden(!markersHidden));
        fullOnly.add(eyeBtn);
        fullOnly.add(barButton("＋", Color.WHITE, this::addTarget));

        // In the folded panel the gear unfolds it and opens the settings.
        barButton("⚙", Color.WHITE, () -> {
            if (compact) {
                setCompact(false);
                if (settings != null && !running) settings.setVisibility(View.VISIBLE);
                refreshSettings();
            } else {
                toggleSettings();
            }
        });
        compactBtn = barButton("▾", MUTED, () -> setCompact(true));
        fullOnly.add(compactBtn);
        barButton("✕", MUTED, this::hidePanel);

        panel.addView(bar, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        buildSettings();
        settings.setVisibility(settingsOpen ? View.VISIBLE : View.GONE);
        panel.addView(settings, new LinearLayout.LayoutParams(dp(300), LinearLayout.LayoutParams.WRAP_CONTENT));
        panel.setAlpha(appearance.panelOpacity / 100f);
        if (compact) setCompact(true);
        updateEye();

        panelParams = overlayParams(true);
        panelParams.x = x;
        panelParams.y = y;
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
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        b.setGravity(Gravity.CENTER);
        b.setMinWidth(dp(40));
        b.setMinHeight(dp(44));
        return b;
    }

    /** A bar button that runs its action on tap and drags the panel when moved. */
    private TextView barButton(String symbol, int color, Runnable action) {
        TextView b = iconButton(symbol, color);
        b.setOnTouchListener(new DragOrClick(action));
        bar.addView(b);
        return b;
    }

    /** Folded: only ▶, ⚙ and ✕ stay visible. */
    private void setCompact(boolean on) {
        compact = on;
        if (bar == null) return;
        for (View v : fullOnly) v.setVisibility(on ? View.GONE : View.VISIBLE);
        if (on && settings != null) settings.setVisibility(View.GONE);
    }

    private void toggleSettings() {
        if (running || settings == null) return;
        settings.setVisibility(settings.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE);
        refreshSettings();
    }

    /** Hides every marker in one tap; hidden markers let touches through to the app below. */
    private void setMarkersHidden(boolean hidden) {
        markersHidden = hidden;
        for (Marker m : markers) m.applyState();
        updateEye();
    }

    private void updateEye() {
        if (eyeBtn != null) eyeBtn.setAlpha(markersHidden ? 0.4f : 1f);
    }

    /** Tap → action; move beyond the touch slop → drag the whole panel. */
    private class DragOrClick implements View.OnTouchListener {
        private final Runnable action;
        private int startX, startY;
        private float downX, downY;
        private boolean moved;

        DragOrClick(Runnable action) {
            this.action = action;
        }

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            if (panel == null) return false;
            int slop = ViewConfiguration.get(AutoClickService.this).getScaledTouchSlop();
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    startX = panelParams.x;
                    startY = panelParams.y;
                    downX = e.getRawX();
                    downY = e.getRawY();
                    moved = false;
                    v.setPressed(true);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = e.getRawX() - downX, dy = e.getRawY() - downY;
                    if (!moved && Math.abs(dx) < slop && Math.abs(dy) < slop) return true;
                    moved = true;
                    panelParams.x = startX + (int) dx;
                    panelParams.y = startY + (int) dy;
                    try {
                        wm.updateViewLayout(panel, panelParams);
                    } catch (RuntimeException ignored) {}
                    return true;
                case MotionEvent.ACTION_UP:
                    v.setPressed(false);
                    if (!moved && action != null) action.run();
                    return true;
                default:
                    v.setPressed(false);
                    return true;
            }
        }
    }

    // ------------------------------------------------------------------
    // Floating panel: settings

    private interface LongGetter {
        long get();
    }

    private interface LongSetter {
        void set(long v);
    }

    private interface Visible {
        boolean now();
    }

    private void buildSettings() {
        settings = new LinearLayout(this);
        settings.setOrientation(LinearLayout.VERTICAL);
        settings.setPadding(dp(6), dp(4), dp(6), dp(6));
        refreshers.clear();

        // --- Macro
        chooser(
            () -> t("macro"),
            () -> config.name.isEmpty() ? "—" : config.name,
            () -> switchMacro(-1),
            () -> switchMacro(1),
            "＋",
            this::newMacro
        );
        stepper(
            () -> "multi".equals(config.mode) ? t("cyclePause") : t("interval"),
            () -> config.intervalMs,
            v -> config.intervalMs = v,
            AutoClickStore.MIN_INTERVAL_MS,
            AutoClickStore.MAX_INTERVAL_MS,
            () -> true,
            Unit.MS
        );
        stepper(() -> t("startDelay"), () -> config.startDelaySec, v -> config.startDelaySec = (int) v,
            AutoClickStore.START_DELAY_RANGE[0], AutoClickStore.START_DELAY_RANGE[1], () -> true);
        cycler(
            () -> t("stop"),
            () -> "cycles".equals(config.stop) ? t("cycles") : "duration".equals(config.stop) ? t("seconds") : t("infinite"),
            () -> {
                config.stop = "infinite".equals(config.stop) ? "cycles" : "cycles".equals(config.stop) ? "duration" : "infinite";
            },
            () -> true
        );
        stepper(() -> t("cycles"), () -> config.cycles, v -> config.cycles = (int) v,
            AutoClickStore.CYCLES_RANGE[0], AutoClickStore.CYCLES_RANGE[1], () -> "cycles".equals(config.stop));
        stepper(() -> t("seconds"), () -> config.durationSec, v -> config.durationSec = (int) v,
            AutoClickStore.DURATION_RANGE[0], AutoClickStore.DURATION_RANGE[1], () -> "duration".equals(config.stop));

        separator();

        cycler(
            () -> t("mode"),
            () -> "sync".equals(config.mode) ? t("simultaneous") : t("sequence"),
            () -> config.mode = "sync".equals(config.mode) ? "multi" : "sync",
            () -> config.targets.size() > 1
        );

        // --- Selected target
        chooser(
            () -> t("target"),
            () -> (selected + 1) + " / " + config.targets.size(),
            () -> selectTarget(selected - 1),
            () -> selectTarget(selected + 1),
            "🗑",
            this::removeSelectedTarget
        );
        cycler(
            () -> t("action"),
            () -> t(current().type),
            () -> {
                AutoClickStore.Target c = current();
                c.type = "tap".equals(c.type) ? "hold" : "hold".equals(c.type) ? "swipe" : "tap";
                rebuildMarkers();
            },
            () -> true
        );
        stepper(() -> t("tapMs"), () -> current().tapMs, v -> current().tapMs = v,
            AutoClickStore.TAP_RANGE[0], AutoClickStore.TAP_RANGE[1], () -> "tap".equals(current().type), Unit.MS);
        stepper(() -> t("holdMs"), () -> current().holdMs, v -> current().holdMs = v,
            AutoClickStore.HOLD_RANGE[0], AutoClickStore.HOLD_RANGE[1], () -> "hold".equals(current().type), Unit.MS);
        stepper(() -> t("swipeMs"), () -> current().swipeMs, v -> current().swipeMs = v,
            AutoClickStore.SWIPE_RANGE[0], AutoClickStore.SWIPE_RANGE[1], () -> "swipe".equals(current().type), Unit.MS);
        stepper(() -> t("delayAfter"), () -> current().delayAfterMs, v -> current().delayAfterMs = v,
            AutoClickStore.DELAY_RANGE[0], AutoClickStore.DELAY_RANGE[1], () -> "multi".equals(config.mode), Unit.MS);
        stepper(() -> t("repeat"), () -> current().repeat, v -> current().repeat = (int) v,
            AutoClickStore.REPEAT_RANGE[0], AutoClickStore.REPEAT_RANGE[1], () -> "multi".equals(config.mode));

        separator();

        // --- Appearance (shared by every macro)
        stepper(() -> t("markerSize"), () -> appearance.markerDp, v -> {
            appearance.markerDp = (int) v;
            rebuildMarkers();
        }, AutoClickStore.MARKER_RANGE[0], AutoClickStore.MARKER_RANGE[1], () -> true, Unit.DP);
        stepper(() -> t("opacity"), () -> appearance.panelOpacity, v -> {
            appearance.panelOpacity = (int) v;
            if (panel != null) panel.setAlpha(v / 100f);
        }, 30, 100, () -> true, Unit.PERCENT);
        cycler(
            () -> t("hideWhileRunning"),
            () -> appearance.hideWhileRunning ? t("yes") : t("no"),
            () -> appearance.hideWhileRunning = !appearance.hideWhileRunning,
            () -> true
        );

        refreshSettings();
    }

    private void separator() {
        View line = new View(this);
        line.setBackgroundColor(0x55FFFFFF);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
        lp.topMargin = dp(6);
        lp.bottomMargin = dp(2);
        settings.addView(line, lp);
    }

    private AutoClickStore.Target current() {
        if (selected < 0 || selected >= config.targets.size()) selected = 0;
        return config.targets.get(selected);
    }

    private void refreshSettings() {
        if (config == null) return;
        for (Runnable r : refreshers) r.run();
        for (Marker m : markers) m.setSelected(m.target == current());
    }

    private interface Text {
        String now();
    }

    private TextView labelView(LinearLayout row) {
        TextView label = new TextView(this);
        label.setTextColor(MUTED);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        label.setMaxLines(2);
        row.addView(label, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        return label;
    }

    private TextView valueView(int minWidthDp) {
        TextView v = new TextView(this);
        v.setTextColor(Color.WHITE);
        v.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        v.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        v.setGravity(Gravity.CENTER);
        v.setMinWidth(dp(minWidthDp));
        v.setMaxLines(1);
        v.setEllipsize(TextUtils.TruncateAt.END);
        return v;
    }

    private TextView smallButton(String symbol) {
        TextView b = new TextView(this);
        b.setText(symbol);
        b.setTextColor(Color.WHITE);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        b.setGravity(Gravity.CENTER);
        b.setMinWidth(dp(38));
        b.setMinHeight(dp(38));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0x33FFFFFF);
        bg.setCornerRadius(dp(10));
        b.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        lp.leftMargin = dp(3);
        b.setLayoutParams(lp);
        return b;
    }

    private LinearLayout newRow() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(3), 0, dp(3));
        settings.addView(row);
        return row;
    }

    private enum Unit {
        NONE,
        MS,
        DP,
        PERCENT,
    }

    /** Durations are stored in ms and shown in the most readable unit. */
    private static String format(long v, Unit unit) {
        switch (unit) {
            case MS:
                if (v >= 60_000 && v % 1000 == 0) {
                    long m = v / 60_000, sec = (v % 60_000) / 1000;
                    return sec == 0 ? m + " min" : m + " min " + sec + " s";
                }
                if (v >= 1000) {
                    String sec = String.valueOf(v / 1000.0);
                    if (sec.endsWith(".0")) sec = sec.substring(0, sec.length() - 2);
                    return sec + " s";
                }
                return v + " ms";
            case DP:
                return v + " dp";
            case PERCENT:
                return v + " %";
            default:
                return String.valueOf(v);
        }
    }

    private void stepper(Text label, LongGetter get, LongSetter set, long min, long max, Visible visible) {
        stepper(label, get, set, min, max, visible, Unit.NONE);
    }

    /** Row: label · [−] value [+], with auto-repeat while a button is held. */
    private void stepper(Text label, LongGetter get, LongSetter set, long min, long max, Visible visible, Unit unit) {
        LinearLayout row = newRow();
        TextView l = labelView(row);
        TextView minus = smallButton("−");
        TextView value = valueView(58);
        TextView plus = smallButton("+");
        row.addView(minus);
        row.addView(value);
        row.addView(plus);
        Runnable down = () -> {
            long v = get.get();
            set.set(AutoClickStore.clamp(v - stepFor(v - 1, unit), min, max));
            value.setText(format(get.get(), unit));
        };
        Runnable up = () -> {
            long v = get.get();
            set.set(AutoClickStore.clamp(v + stepFor(v, unit), min, max));
            value.setText(format(get.get(), unit));
        };
        minus.setOnTouchListener(new RepeatTouch(down));
        plus.setOnTouchListener(new RepeatTouch(up));
        refreshers.add(() -> {
            row.setVisibility(visible.now() ? View.VISIBLE : View.GONE);
            l.setText(label.now());
            value.setText(format(get.get(), unit));
        });
    }

    /** Step grows with the value: 1 below 20, then 5, 50, 500, 5000. */
    private static long stepFor(long v, Unit unit) {
        if (unit == Unit.DP) return 2;
        if (unit == Unit.MS && v >= 60_000) return 15_000;
        if (v < 20) return 1;
        if (v < 100) return 5;
        if (v < 1000) return 50;
        if (v < 10_000) return 500;
        return 5000;
    }

    /** Row: label · value that changes when tapped. */
    private void cycler(Text label, Text value, Runnable next, Visible visible) {
        LinearLayout row = newRow();
        TextView l = labelView(row);
        TextView v = valueView(120);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0x33FFFFFF);
        bg.setCornerRadius(dp(10));
        v.setBackground(bg);
        v.setPadding(dp(8), dp(8), dp(8), dp(8));
        v.setOnClickListener(x -> {
            if (running) return;
            next.run();
            persist();
            refreshSettings();
        });
        row.addView(v);
        refreshers.add(() -> {
            row.setVisibility(visible.now() ? View.VISIBLE : View.GONE);
            l.setText(label.now());
            v.setText(value.now());
        });
    }

    /** Row: label · [◀] value [▶] [extra]. */
    private void chooser(Text label, Text value, Runnable prev, Runnable next, String extraSymbol, Runnable extra) {
        LinearLayout row = newRow();
        TextView l = labelView(row);
        TextView left = smallButton("◀");
        TextView v = valueView(64);
        v.setMaxWidth(dp(84));
        TextView right = smallButton("▶");
        TextView more = smallButton(extraSymbol);
        left.setOnClickListener(x -> {
            if (!running) prev.run();
        });
        right.setOnClickListener(x -> {
            if (!running) next.run();
        });
        more.setOnClickListener(x -> {
            if (!running) extra.run();
        });
        row.addView(left);
        row.addView(v);
        row.addView(right);
        row.addView(more);
        refreshers.add(() -> {
            l.setText(label.now());
            v.setText(value.now());
        });
    }

    /** Runs an action on touch, then repeatedly while the finger stays down. */
    private class RepeatTouch implements View.OnTouchListener {
        private final Runnable action;
        private final Runnable repeat = new Runnable() {
            @Override
            public void run() {
                action.run();
                handler.postDelayed(this, 70);
            }
        };

        RepeatTouch(Runnable action) {
            this.action = action;
        }

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    if (running) return true;
                    action.run();
                    handler.postDelayed(repeat, 400);
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    handler.removeCallbacks(repeat);
                    persist();
                    return true;
                default:
                    return true;
            }
        }
    }

    // ------------------------------------------------------------------
    // Editing the macro from the panel

    private void addTarget() {
        if (running || config == null || config.targets.size() >= AutoClickStore.MAX_TARGETS) return;
        AutoClickStore.Target target = new AutoClickStore.Target();
        target.id = "t" + System.currentTimeMillis();
        config.targets.add(target);
        // A second target turns a single-target macro into a sequence.
        if ("single".equals(config.mode)) config.mode = "multi";
        selected = config.targets.size() - 1;
        rebuildMarkers();
        persist();
        refreshSettings();
    }

    private void removeSelectedTarget() {
        if (config == null || config.targets.size() <= 1) return;
        config.targets.remove(current());
        if (config.targets.size() == 1) config.mode = "single";
        selected = Math.min(selected, config.targets.size() - 1);
        rebuildMarkers();
        persist();
        refreshSettings();
    }

    private void selectTarget(int index) {
        if (config == null) return;
        int n = config.targets.size();
        selected = ((index % n) + n) % n;
        refreshSettings();
    }

    private void switchMacro(int direction) {
        if (config == null) return;
        persist();
        List<String[]> all = AutoClickStore.list(this);
        if (all.size() < 2) return;
        int at = 0;
        for (int i = 0; i < all.size(); i++) if (all.get(i)[0].equals(config.id)) at = i;
        int next = ((at + direction) % all.size() + all.size()) % all.size();
        loadMacro(all.get(next)[0]);
    }

    private void newMacro() {
        if (config == null) return;
        persist();
        int n = AutoClickStore.list(this).size() + 1;
        AutoClickStore.Config created = AutoClickStore.create(this, t("newMacro") + " " + n);
        loadMacro(created.id);
    }

    private void loadMacro(String id) {
        AutoClickStore.Config loaded = AutoClickStore.load(this, id);
        if (loaded == null) return;
        config = loaded;
        selected = 0;
        rebuildMarkers();
        persist(); // stores the default positions of targets never placed before
        refreshSettings();
        setStatus(t("ready"));
    }

    private void persist() {
        if (config == null) return;
        for (Marker m : markers) m.syncToTarget();
        AutoClickStore.save(this, config);
        AutoClickStore.saveAppearance(this, appearance);
    }

    // ------------------------------------------------------------------
    // Target markers

    private void rebuildMarkers() {
        for (Marker m : markers) m.syncToTarget();
        removeMarkers();
        if (config == null) return;
        DisplayMetrics dm = realMetrics();
        for (int i = 0; i < config.targets.size(); i++) {
            AutoClickStore.Target target = config.targets.get(i);
            if (!target.placed()) {
                // Default spot: screen centre, slightly staggered.
                target.x = dm.widthPixels / 2f + (i % 5 - 2) * dp(56);
                target.y = dm.heightPixels / 2f + (i / 5) * dp(56);
            }
            markers.add(new Marker(target, i, false));
            if ("swipe".equals(target.type)) {
                if (!target.endPlaced()) {
                    target.x2 = target.x;
                    target.y2 = Math.max(dp(40), target.y - dp(160));
                }
                markers.add(new Marker(target, i, true));
            }
        }
        for (Marker m : markers) m.setSelected(m.target == current());
    }

    private void removeMarkers() {
        for (Marker m : markers) m.remove();
        markers.clear();
    }

    private void setMarkersPassThrough(boolean passThrough) {
        for (Marker m : markers) m.setPassThrough(passThrough);
    }

    /**
     * One draggable numbered circle. A tap selects its target in the settings.
     * While a macro runs it lets touches through, so the injected taps reach
     * the app underneath instead of the marker itself.
     */
    private class Marker implements View.OnTouchListener {
        final AutoClickStore.Target target;
        final int index;
        final boolean isEnd;
        final TextView view;
        final GradientDrawable shape = new GradientDrawable();
        final WindowManager.LayoutParams params;
        final int size;
        private int startX, startY;
        private float downX, downY;
        private boolean moved;
        private boolean attached;

        Marker(AutoClickStore.Target target, int index, boolean isEnd) {
            this.target = target;
            this.index = index;
            this.isEnd = isEnd;
            int base = appearance.markerDp;
            size = dp(isEnd ? Math.max(12, Math.round(base * 0.78f)) : base);
            view = new TextView(AutoClickService.this);
            view.setText(isEnd ? (index + 1) + "»" : String.valueOf(index + 1));
            view.setTextColor(Color.WHITE);
            // Number size follows the marker, so tiny markers stay readable.
            view.setTextSize(TypedValue.COMPLEX_UNIT_PX, Math.max(dp(8), size * (isEnd ? 0.3f : 0.36f)));
            view.setTypeface(Typeface.DEFAULT_BOLD);
            view.setGravity(Gravity.CENTER);
            shape.setShape(GradientDrawable.OVAL);
            shape.setColor(isEnd ? 0x99333333 : (0xB3000000 | (accent & 0x00FFFFFF)));
            shape.setStroke(Math.max(1, dp(size < dp(28) ? 1 : 2)), Color.WHITE);
            view.setBackground(shape);
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
            applyState();
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
            if (!attached || view.getWidth() == 0) return;
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

        void setSelected(boolean on) {
            shape.setStroke(dp(on ? 3 : 2), on ? 0xFFFFE066 : Color.WHITE);
        }

        void setPassThrough(boolean on) {
            applyState();
        }

        /**
         * Touchable and fully visible only when editing. While running or when
         * hidden with 👁, touches go through to the app underneath.
         */
        void applyState() {
            if (!attached) return;
            boolean through = running || markersHidden;
            if (through) params.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
            else params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
            float alpha = 1f;
            if (markersHidden || (running && appearance.hideWhileRunning)) alpha = 0f;
            else if (running) alpha = 0.35f;
            view.setAlpha(alpha);
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
                    moved = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = e.getRawX() - downX, dy = e.getRawY() - downY;
                    if (!moved && Math.abs(dx) < slop && Math.abs(dy) < slop) return true;
                    moved = true;
                    params.x = startX + (int) dx;
                    params.y = startY + (int) dy;
                    try {
                        wm.updateViewLayout(view, params);
                    } catch (RuntimeException ignored) {}
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    selected = index;
                    refreshSettings();
                    // Save once the system has laid the marker out at its new place.
                    if (moved) view.post(AutoClickService.this::persist);
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

    /** "#rrggbb" from the app, or the fallback when missing or malformed. */
    static int parseColor(String hex, int fallback) {
        if (hex == null || !hex.matches("#[0-9a-fA-F]{6}")) return fallback;
        return 0xFF000000 | Integer.parseInt(hex.substring(1), 16);
    }

    private static float clampF(float v, float min, float max) {
        return Math.max(min, Math.min(max, v));
    }
}
