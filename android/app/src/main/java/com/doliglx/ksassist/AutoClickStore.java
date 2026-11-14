package com.doliglx.ksassist;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Saved auto-clicker macros.
 *
 * The list is stored as one JSON array in the app's private preferences. It is
 * written by the app's own UI, but every value is still clamped when read, so a
 * corrupted or hand-edited entry can never produce a runaway gesture loop.
 */
final class AutoClickStore {

    private static final String PREFS = "autoclicker";
    private static final String KEY = "configs";

    // Hard limits, mirrored in lib/auto-clicker.ts
    static final int MAX_TARGETS = 20;
    static final int MAX_JSON_CHARS = 200_000;
    static final long MIN_INTERVAL_MS = 1;
    static final long MAX_INTERVAL_MS = 3_600_000;
    static final long[] TAP_RANGE = { 1, 500 };
    static final long[] HOLD_RANGE = { 100, 10_000 };
    static final long[] SWIPE_RANGE = { 100, 5_000 };
    static final long[] DELAY_RANGE = { 0, 600_000 };
    static final long[] REPEAT_RANGE = { 1, 1000 };
    static final long[] START_DELAY_RANGE = { 0, 60 };
    static final long[] CYCLES_RANGE = { 1, 1_000_000 };
    static final long[] DURATION_RANGE = { 1, 86_400 };

    private AutoClickStore() {}

    static final class Target {
        String id = "";
        String type = "tap"; // tap | hold | swipe
        float x = -1, y = -1; // screen pixels, -1 = not placed yet
        float x2 = -1, y2 = -1; // swipe end
        long tapMs = 20;
        long holdMs = 600;
        long swipeMs = 300;
        long delayAfterMs = 500;
        int repeat = 1;

        boolean placed() {
            return x >= 0 && y >= 0;
        }

        boolean endPlaced() {
            return x2 >= 0 && y2 >= 0;
        }
    }

    static final class Config {
        String id = "";
        String name = "";
        String mode = "single"; // single | multi
        long intervalMs = 1000;
        int startDelaySec = 3;
        String stop = "infinite"; // infinite | cycles | duration
        int cycles = 10;
        int durationSec = 60;
        final List<Target> targets = new ArrayList<>();
    }

    static String readRaw(Context ctx) {
        return prefs(ctx).getString(KEY, "[]");
    }

    static boolean writeRaw(Context ctx, String json) {
        if (json == null || json.length() > MAX_JSON_CHARS) return false;
        try {
            new JSONArray(json); // must at least be a JSON array
        } catch (JSONException e) {
            return false;
        }
        prefs(ctx).edit().putString(KEY, json).apply();
        return true;
    }

    /** Loads one macro by id, or null when it does not exist. */
    static Config load(Context ctx, String id) {
        try {
            JSONArray all = new JSONArray(readRaw(ctx));
            for (int i = 0; i < all.length(); i++) {
                JSONObject o = all.optJSONObject(i);
                if (o != null && id.equals(o.optString("id"))) return parse(o);
            }
        } catch (JSONException ignored) {}
        return null;
    }

    /** Ids and names of every saved macro, in order. */
    static List<String[]> list(Context ctx) {
        List<String[]> out = new ArrayList<>();
        try {
            JSONArray all = new JSONArray(readRaw(ctx));
            for (int i = 0; i < all.length(); i++) {
                JSONObject o = all.optJSONObject(i);
                if (o != null && !o.optString("id").isEmpty()) {
                    out.add(new String[] { o.optString("id"), o.optString("name") });
                }
            }
        } catch (JSONException ignored) {}
        return out;
    }

    /** Creates a new single-target macro and returns it. */
    static Config create(Context ctx, String name) {
        Config c = new Config();
        c.id = "m" + System.currentTimeMillis();
        c.name = name;
        Target t = new Target();
        t.id = "t" + System.currentTimeMillis();
        c.targets.add(t);
        save(ctx, c);
        return c;
    }

    /**
     * Writes a macro back after it was edited on the floating panel.
     * Fields the panel does not edit (target labels) are kept from the stored entry.
     */
    static void save(Context ctx, Config cfg) {
        try {
            JSONArray all = new JSONArray(readRaw(ctx));
            JSONObject o = null;
            for (int i = 0; i < all.length(); i++) {
                JSONObject c = all.optJSONObject(i);
                if (c != null && cfg.id.equals(c.optString("id"))) o = c;
            }
            if (o == null) {
                o = new JSONObject();
                o.put("id", cfg.id);
                all.put(o);
            }
            o.put("name", cfg.name);
            o.put("mode", cfg.mode);
            o.put("intervalMs", cfg.intervalMs);
            o.put("startDelaySec", cfg.startDelaySec);
            o.put("stop", cfg.stop);
            o.put("cycles", cfg.cycles);
            o.put("durationSec", cfg.durationSec);

            JSONArray old = o.optJSONArray("targets");
            JSONArray out = new JSONArray();
            for (Target t : cfg.targets) {
                JSONObject j = null;
                if (old != null) {
                    for (int m = 0; m < old.length(); m++) {
                        JSONObject c = old.optJSONObject(m);
                        if (c != null && t.id.equals(c.optString("id"))) j = c;
                    }
                }
                if (j == null) j = new JSONObject();
                j.put("id", t.id);
                j.put("type", t.type);
                j.put("x", t.placed() ? Math.round(t.x) : JSONObject.NULL);
                j.put("y", t.placed() ? Math.round(t.y) : JSONObject.NULL);
                j.put("x2", t.endPlaced() ? Math.round(t.x2) : JSONObject.NULL);
                j.put("y2", t.endPlaced() ? Math.round(t.y2) : JSONObject.NULL);
                j.put("tapMs", t.tapMs);
                j.put("holdMs", t.holdMs);
                j.put("swipeMs", t.swipeMs);
                j.put("delayAfterMs", t.delayAfterMs);
                j.put("repeat", t.repeat);
                if (!j.has("label")) j.put("label", "");
                out.put(j);
            }
            o.put("targets", out);
            String json = all.toString();
            if (json.length() <= MAX_JSON_CHARS) prefs(ctx).edit().putString(KEY, json).apply();
        } catch (JSONException ignored) {}
    }

    private static Config parse(JSONObject o) {
        Config c = new Config();
        c.id = o.optString("id");
        c.name = o.optString("name");
        c.mode = "multi".equals(o.optString("mode")) ? "multi" : "single";
        c.intervalMs = clamp(o.optLong("intervalMs", 1000), MIN_INTERVAL_MS, MAX_INTERVAL_MS);
        c.startDelaySec = (int) clamp(o.optLong("startDelaySec", 3), START_DELAY_RANGE[0], START_DELAY_RANGE[1]);
        String stop = o.optString("stop");
        c.stop = "cycles".equals(stop) || "duration".equals(stop) ? stop : "infinite";
        c.cycles = (int) clamp(o.optLong("cycles", 10), CYCLES_RANGE[0], CYCLES_RANGE[1]);
        c.durationSec = (int) clamp(o.optLong("durationSec", 60), DURATION_RANGE[0], DURATION_RANGE[1]);
        JSONArray ts = o.optJSONArray("targets");
        if (ts != null) {
            int max = "single".equals(c.mode) ? 1 : MAX_TARGETS;
            for (int i = 0; i < ts.length() && c.targets.size() < max; i++) {
                JSONObject j = ts.optJSONObject(i);
                if (j == null) continue;
                Target t = new Target();
                t.id = j.optString("id", "t" + i);
                String type = j.optString("type");
                t.type = "hold".equals(type) || "swipe".equals(type) ? type : "tap";
                t.x = coord(j, "x");
                t.y = coord(j, "y");
                t.x2 = coord(j, "x2");
                t.y2 = coord(j, "y2");
                t.tapMs = clamp(j.optLong("tapMs", 20), TAP_RANGE[0], TAP_RANGE[1]);
                t.holdMs = clamp(j.optLong("holdMs", 600), HOLD_RANGE[0], HOLD_RANGE[1]);
                t.swipeMs = clamp(j.optLong("swipeMs", 300), SWIPE_RANGE[0], SWIPE_RANGE[1]);
                t.delayAfterMs = clamp(j.optLong("delayAfterMs", 500), DELAY_RANGE[0], DELAY_RANGE[1]);
                t.repeat = (int) clamp(j.optLong("repeat", 1), REPEAT_RANGE[0], REPEAT_RANGE[1]);
                c.targets.add(t);
            }
        }
        if (c.targets.isEmpty()) {
            Target t = new Target();
            t.id = "t0";
            c.targets.add(t);
        }
        return c;
    }

    private static float coord(JSONObject j, String key) {
        if (j.isNull(key)) return -1;
        double v = j.optDouble(key, -1);
        return Double.isNaN(v) || v < 0 || v > 20_000 ? -1 : (float) v;
    }

    static long clamp(long v, long min, long max) {
        return Math.max(min, Math.min(max, v));
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
