package com.doliglx.ksassist;

import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JavaScript bridge of the auto clicker. */
@CapacitorPlugin(name = "AutoClicker")
public class AutoClickerPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            AutoClickService s = AutoClickService.get();
            JSObject ret = new JSObject();
            ret.put("enabled", s != null);
            ret.put("panelShown", s != null && s.isPanelShown());
            ret.put("running", s != null && s.isRunning());
            ret.put("configId", s != null ? s.shownConfigId() : "");
            call.resolve(ret);
        });
    }

    /** Opens the system screen where the user turns the service on. */
    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void loadConfigs(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("json", AutoClickStore.readRaw(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void saveConfigs(PluginCall call) {
        String json = call.getString("json");
        if (!AutoClickStore.writeRaw(getContext(), json)) {
            call.reject("Invalid macro list");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void showPanel(PluginCall call) {
        String id = call.getString("configId", "");
        JSObject texts = call.getObject("texts", new JSObject());
        getActivity().runOnUiThread(() -> {
            AutoClickService s = AutoClickService.get();
            if (s == null) {
                call.reject("SERVICE_OFF");
                return;
            }
            boolean ok = s.showPanel(
                id,
                texts.getString("ready"),
                texts.getString("running"),
                texts.getString("startsIn"),
                texts.getString("done")
            );
            if (ok) call.resolve();
            else call.reject("UNKNOWN_CONFIG");
        });
    }

    @PluginMethod
    public void hidePanel(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            AutoClickService s = AutoClickService.get();
            if (s != null) s.hidePanel();
            call.resolve();
        });
    }
}
