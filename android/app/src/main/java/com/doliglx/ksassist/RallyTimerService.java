package com.doliglx.ksassist;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.util.Locale;

/**
 * Compte à rebours de lancement du rally, en service au premier plan.
 * - Bulle flottante (si la permission « affichage par-dessus d'autres apps »
 *   est accordée) : déplaçable, repliable, gros chiffres.
 * - Sinon : notification persistante avec compte à rebours (+ écran de l'app).
 * - Alertes son + vibration à T−3, T−2, T−1 puis « GO ».
 * Le temps est mesuré avec SystemClock.elapsedRealtime() (monotone, compte
 * aussi la veille) : l'heure du téléphone n'intervient pas.
 */
public class RallyTimerService extends Service {

    static final String ACTION_START = "com.doliglx.ksassist.START";
    static final String ACTION_GO = "com.doliglx.ksassist.GO";
    static final String ACTION_STOP = "com.doliglx.ksassist.STOP";

    private static final String CHANNEL_ID = "rally_timer";
    private static final int NOTIF_ID = 4242;
    private static final long TICK_MS = 100;
    private static final long AUTO_STOP_AFTER_GO_MS = 120_000;
    private static final int ORANGE = 0xFFFA5D36;
    private static final int BG = 0xF0120C0A;

    private static volatile boolean running = false;

    /** Clés des textes traduits envoyés par l'application. */
    static final String[] TEXT_KEYS = {
        "start", "launchIn", "go", "goNotif", "tapStart", "stop", "me", "channel", "modeLabel"
    };
    // Textes par défaut (anglais), remplacés par ceux de la langue choisie
    private String tStart = "START (1st launches)";
    private String tLaunchIn = "Launch in";
    private String tGo = "GO!";
    private String tGoNotif = "GO! Launch your rally";
    private String tTapStart = "Tap Start as soon as the 1st leader launches";
    private String tStop = "Stop";
    private String tMe = "Me";
    private String tChannel = "Rally countdown";
    private String tModeLabel = "Exact UTC";

    static boolean isRunning() {
        return running;
    }

    private final Handler handler = new Handler(Looper.getMainLooper());

    // État du compte à rebours
    private String mode = "utc";
    private String name = "";
    private String subtitle = "";
    private String precision = "";
    private long offsetMs = 0;
    private long targetElapsed = -1; // -1 : Quick Sync pas encore démarré
    private int lastAlertSecond = Integer.MAX_VALUE;
    private boolean goFired = false;
    private long lastNotifSecond = Long.MIN_VALUE;

    // Bulle
    private WindowManager wm;
    private WindowManager.LayoutParams params;
    private LinearLayout root;
    private LinearLayout expanded;
    private TextView collapsed;
    private TextView bigCount;
    private TextView subLine;
    private Button startBtn;
    private boolean isCollapsed = false;

    private ToneGenerator tone;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            tick();
            handler.postDelayed(this, TICK_MS);
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            stopEverything();
            return START_NOT_STICKY;
        }
        if (ACTION_GO.equals(action)) {
            pressStart();
            return START_NOT_STICKY;
        }
        if (ACTION_START.equals(action) && intent != null) {
            mode = intent.getStringExtra("mode");
            if (mode == null) mode = "utc";
            name = nz(intent.getStringExtra("name"));
            subtitle = nz(intent.getStringExtra("subtitle"));
            precision = nz(intent.getStringExtra("precision"));
            offsetMs = Math.max(0, intent.getLongExtra("offsetMs", 0));
            tStart = textExtra(intent, "start", tStart);
            tLaunchIn = textExtra(intent, "launchIn", tLaunchIn);
            tGo = textExtra(intent, "go", tGo);
            tGoNotif = textExtra(intent, "goNotif", tGoNotif);
            tTapStart = textExtra(intent, "tapStart", tTapStart);
            tStop = textExtra(intent, "stop", tStop);
            tMe = textExtra(intent, "me", tMe);
            tChannel = textExtra(intent, "channel", tChannel);
            tModeLabel = textExtra(intent, "modeLabel", "quick".equals(mode) ? "Quick Sync" : "Exact UTC");
            goFired = false;
            lastAlertSecond = Integer.MAX_VALUE;
            if ("quick".equals(mode)) {
                targetElapsed = -1;
            } else {
                targetElapsed = SystemClock.elapsedRealtime() + intent.getLongExtra("delayMs", 0);
            }

            startInForeground();
            running = true;

            boolean useOverlay = intent.getBooleanExtra("useOverlay", false);
            if (useOverlay) showOverlay();
            else removeOverlay();

            if (tone == null) {
                try {
                    tone = new ToneGenerator(AudioManager.STREAM_ALARM, 90);
                } catch (RuntimeException e) {
                    tone = null;
                }
            }
            handler.removeCallbacks(ticker);
            handler.post(ticker);
        }
        return START_NOT_STICKY;
    }

    // ---------- Compte à rebours ----------

    private void pressStart() {
        if (!"quick".equals(mode) || targetElapsed >= 0) return;
        targetElapsed = SystemClock.elapsedRealtime() + offsetMs;
        lastAlertSecond = Integer.MAX_VALUE;
        goFired = false;
        if (startBtn != null) startBtn.setVisibility(View.GONE);
        setCollapsed(true); // affichage réduit, gros chiffres
        tick();
    }

    private void tick() {
        String big;
        if (targetElapsed < 0) {
            big = formatSeconds(offsetMs / 1000.0);
        } else {
            long remaining = targetElapsed - SystemClock.elapsedRealtime();
            if (remaining > 0) {
                int secLeft = (int) Math.ceil(remaining / 1000.0);
                if (secLeft <= 3 && secLeft < lastAlertSecond) {
                    lastAlertSecond = secLeft;
                    alert(false);
                }
                big = formatSeconds(remaining / 1000.0);
            } else {
                if (!goFired) {
                    goFired = true;
                    alert(true);
                }
                big = tGo;
                if (-remaining > AUTO_STOP_AFTER_GO_MS) {
                    stopEverything();
                    return;
                }
            }
        }
        boolean go = goFired;
        if (bigCount != null) {
            bigCount.setText(big);
            bigCount.setTextColor(go ? Color.GREEN : Color.WHITE);
        }
        if (collapsed != null) {
            collapsed.setText(big);
            collapsed.setTextColor(go ? Color.GREEN : Color.WHITE);
        }
        long sec = targetElapsed < 0 ? -1 : (targetElapsed - SystemClock.elapsedRealtime()) / 1000;
        if (sec != lastNotifSecond) {
            lastNotifSecond = sec;
            updateNotification(big);
        }
    }

    private void alert(boolean go) {
        try {
            if (tone != null) {
                tone.startTone(go ? ToneGenerator.TONE_CDMA_HIGH_L : ToneGenerator.TONE_PROP_BEEP, go ? 700 : 150);
            }
        } catch (RuntimeException ignored) {}
        vibrate(go ? 700 : 150);
    }

    @SuppressWarnings("deprecation")
    private void vibrate(long ms) {
        try {
            Vibrator v;
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                v = vm != null ? vm.getDefaultVibrator() : null;
            } else {
                v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(ms);
        } catch (RuntimeException ignored) {}
    }

    private static String formatSeconds(double seconds) {
        long s = (long) Math.ceil(Math.max(0, seconds));
        long h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
        if (h > 0) return String.format(Locale.US, "%d:%02d:%02d", h, m, sec);
        return String.format(Locale.US, "%d:%02d", m, sec);
    }

    // ---------- Notification (toujours présente, repli sans bulle) ----------

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                // Recréer le canal met à jour son nom dans la langue choisie
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    tChannel,
                    NotificationManager.IMPORTANCE_LOW
                );
                ch.setDescription(tChannel);
                ch.setSound(null, null);
                ch.enableVibration(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    private Notification buildNotification(String big) {
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, piFlags);
        PendingIntent stopPi = PendingIntent.getService(
            this, 1, new Intent(this, RallyTimerService.class).setAction(ACTION_STOP), piFlags
        );

        String title = (name.isEmpty() ? tMe : name) + " · " + tModeLabel;
        String text;
        if ("quick".equals(mode) && targetElapsed < 0) {
            text = tTapStart + (subtitle.isEmpty() ? "" : " (" + subtitle + ")");
        } else if (goFired) {
            text = tGoNotif;
        } else {
            text = tLaunchIn + " " + big + (precision.isEmpty() ? "" : " · " + precision);
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openPi)
            .addAction(0, tStop, stopPi);

        if ("quick".equals(mode) && targetElapsed < 0) {
            PendingIntent goPi = PendingIntent.getService(
                this, 2, new Intent(this, RallyTimerService.class).setAction(ACTION_GO), piFlags
            );
            b.addAction(0, "Start", goPi);
        } else if (!goFired && targetElapsed >= 0) {
            long remaining = targetElapsed - SystemClock.elapsedRealtime();
            b.setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(System.currentTimeMillis() + remaining)
                .setShowWhen(true);
        }
        return b.build();
    }

    private void startInForeground() {
        ensureChannel();
        Notification n = buildNotification(formatSeconds(offsetMs / 1000.0));
        int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, NOTIF_ID, n, type);
    }

    private void updateNotification(String big) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            try {
                nm.notify(NOTIF_ID, buildNotification(big));
            } catch (SecurityException ignored) {}
        }
    }

    // ---------- Bulle flottante ----------

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @SuppressWarnings("deprecation")
    private void showOverlay() {
        if (root != null) {
            refreshOverlayTexts();
            return;
        }
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        int type = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = dp(16);
        params.y = dp(120);

        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(BG);
        bg.setCornerRadius(dp(18));
        bg.setStroke(dp(2), ORANGE);
        root.setBackground(bg);
        root.setPadding(dp(12), dp(8), dp(12), dp(10));

        // --- Vue repliée : gros chiffres seuls
        collapsed = new TextView(this);
        collapsed.setTextSize(TypedValue.COMPLEX_UNIT_SP, 34);
        collapsed.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        collapsed.setTextColor(Color.WHITE);
        collapsed.setGravity(Gravity.CENTER);
        collapsed.setPadding(dp(6), dp(2), dp(6), dp(2));
        collapsed.setVisibility(View.GONE);
        collapsed.setOnTouchListener(new DragListener(true));
        root.addView(collapsed);

        // --- Vue dépliée
        expanded = new LinearLayout(this);
        expanded.setOrientation(LinearLayout.VERTICAL);
        expanded.setMinimumWidth(dp(210));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setOnTouchListener(new DragListener(false));
        TextView title = new TextView(this);
        title.setTextColor(ORANGE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTag("title");
        header.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        header.addView(smallButton("–", v -> setCollapsed(true)));
        header.addView(smallButton("×", v -> stopEverything()));
        expanded.addView(header);

        bigCount = new TextView(this);
        bigCount.setTextSize(TypedValue.COMPLEX_UNIT_SP, 46);
        bigCount.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        bigCount.setTextColor(Color.WHITE);
        bigCount.setGravity(Gravity.CENTER);
        bigCount.setOnTouchListener(new DragListener(false));
        expanded.addView(bigCount);

        subLine = new TextView(this);
        subLine.setTextColor(0xFFBBBBBB);
        subLine.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        subLine.setGravity(Gravity.CENTER);
        expanded.addView(subLine);

        startBtn = new Button(this);
        startBtn.setText(tStart);
        startBtn.setAllCaps(false);
        startBtn.setTextColor(Color.WHITE);
        startBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        GradientDrawable sb = new GradientDrawable();
        sb.setColor(ORANGE);
        sb.setCornerRadius(dp(12));
        startBtn.setBackground(sb);
        startBtn.setOnClickListener(v -> pressStart());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(52)
        );
        lp.topMargin = dp(8);
        expanded.addView(startBtn, lp);

        root.addView(expanded);
        refreshOverlayTexts();

        try {
            wm.addView(root, params);
        } catch (RuntimeException e) {
            // Permission retirée entre-temps : repli sur la notification
            root = null;
        }
    }

    private void refreshOverlayTexts() {
        if (root == null) return;
        TextView title = root.findViewWithTag("title");
        if (title != null) {
            title.setText(tModeLabel + " · " + (name.isEmpty() ? tMe : name));
        }
        if (startBtn != null) {
            startBtn.setText(tStart);
        }
        String sub = subtitle;
        if (!precision.isEmpty()) sub = sub.isEmpty() ? precision : sub + "\n" + precision;
        subLine.setText(sub);
        boolean waitStart = "quick".equals(mode) && targetElapsed < 0;
        startBtn.setVisibility(waitStart ? View.VISIBLE : View.GONE);
        setCollapsed(false);
    }

    private Button smallButton(String label, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        b.setBackgroundColor(Color.TRANSPARENT);
        b.setMinWidth(0);
        b.setMinimumWidth(0);
        b.setPadding(dp(10), 0, dp(10), 0);
        b.setOnClickListener(l);
        return b;
    }

    private void setCollapsed(boolean c) {
        isCollapsed = c;
        if (expanded == null || collapsed == null) return;
        expanded.setVisibility(c ? View.GONE : View.VISIBLE);
        collapsed.setVisibility(c ? View.VISIBLE : View.GONE);
    }

    /** Déplacement de la bulle ; un simple appui sur la vue repliée la déplie. */
    private class DragListener implements View.OnTouchListener {
        private final boolean tapExpands;
        private int startX, startY;
        private float downX, downY;
        private boolean moved;

        DragListener(boolean tapExpands) {
            this.tapExpands = tapExpands;
        }

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            if (params == null || wm == null || root == null) return false;
            int slop = ViewConfiguration.get(v.getContext()).getScaledTouchSlop();
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
                    if (Math.abs(dx) > slop || Math.abs(dy) > slop) moved = true;
                    if (moved) {
                        params.x = startX + (int) dx;
                        params.y = startY + (int) dy;
                        try {
                            wm.updateViewLayout(root, params);
                        } catch (RuntimeException ignored) {}
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved && tapExpands) setCollapsed(false);
                    return true;
                default:
                    return false;
            }
        }
    }

    private void removeOverlay() {
        if (root != null && wm != null) {
            try {
                wm.removeView(root);
            } catch (RuntimeException ignored) {}
        }
        root = null;
        expanded = null;
        collapsed = null;
        bigCount = null;
        subLine = null;
        startBtn = null;
    }

    // ---------- Arrêt ----------

    private void stopEverything() {
        handler.removeCallbacks(ticker);
        removeOverlay();
        if (tone != null) {
            tone.release();
            tone = null;
        }
        running = false;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(ticker);
        removeOverlay();
        if (tone != null) {
            tone.release();
            tone = null;
        }
        running = false;
        super.onDestroy();
    }

    private static String textExtra(Intent i, String key, String fallback) {
        String v = i.getStringExtra("t_" + key);
        return v == null || v.isEmpty() ? fallback : v;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
