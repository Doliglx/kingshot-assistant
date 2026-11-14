package com.doliglx.ksassist;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins must be registered before super.onCreate().
        registerPlugin(RallyOverlayPlugin.class);
        registerPlugin(AutoClickerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
