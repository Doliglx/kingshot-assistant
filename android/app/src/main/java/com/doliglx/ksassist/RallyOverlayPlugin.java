package com.doliglx.ksassist;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Pont JavaScript ↔ mode flottant.
 * Aucune interaction avec d'autres applications : seule la permission
 * « affichage par-dessus d'autres apps » est utilisée pour la bulle.
 */
@CapacitorPlugin(
    name = "RallyOverlay",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class RallyOverlayPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("overlay", canDrawOverlays());
        ret.put("notifications", notificationsGranted());
        ret.put("running", RallyTimerService.isRunning());
        call.resolve(ret);
    }

    /** Ouvre l'écran système « Affichage par-dessus d'autres apps » de l'app. */
    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + ctx.getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || notificationsGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsCallback");
    }

    @PermissionCallback
    private void notificationsCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    /**
     * Démarre (ou met à jour) le compte à rebours.
     * mode "utc"   : delayMs = temps restant avant le départ (horloge synchronisée côté JS)
     * mode "quick" : offsetMs = décalage à attendre après « Start »
     */
    @PluginMethod
    public void start(PluginCall call) {
        String mode = call.getString("mode", "utc");
        Intent i = new Intent(getContext(), RallyTimerService.class);
        i.setAction(RallyTimerService.ACTION_START);
        i.putExtra("mode", mode);
        i.putExtra("name", call.getString("name", ""));
        i.putExtra("subtitle", call.getString("subtitle", ""));
        i.putExtra("precision", call.getString("precision", ""));
        i.putExtra("delayMs", call.getDouble("delayMs", 0.0).longValue());
        i.putExtra("offsetMs", call.getDouble("offsetMs", 0.0).longValue());
        i.putExtra("useOverlay", canDrawOverlays());
        // Textes traduits (bulle + notification)
        JSObject texts = call.getObject("texts", new JSObject());
        for (String key : RallyTimerService.TEXT_KEYS) {
            String v = texts.getString(key);
            if (v != null) i.putExtra("t_" + key, v);
        }
        ContextCompat.startForegroundService(getContext(), i);
        JSObject ret = new JSObject();
        ret.put("overlay", canDrawOverlays());
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent i = new Intent(getContext(), RallyTimerService.class);
        i.setAction(RallyTimerService.ACTION_STOP);
        getContext().startService(i);
        call.resolve();
    }

    private boolean canDrawOverlays() {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext());
    }

    private boolean notificationsGranted() {
        return Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED;
    }
}
