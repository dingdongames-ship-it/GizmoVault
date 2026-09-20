package com.gizmovault.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VaultUpload")
public class VaultUploadPlugin extends Plugin {

    @PluginMethod
    public void openUploadScreen(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), UploadVaultItemActivity.class);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open upload screen: " + e.getMessage(), e);
        }
    }
}
