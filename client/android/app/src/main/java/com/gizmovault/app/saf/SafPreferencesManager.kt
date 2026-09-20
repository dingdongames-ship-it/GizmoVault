package com.gizmovault.app.saf

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.documentfile.provider.DocumentFile
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking

private val Context.dataStore by preferencesDataStore(name = "gizmovault_saf_prefs")

class SafPreferencesManager(private val context: Context) {

    companion object {
        private const val TAG = "SafPreferencesManager"
        private const val PREF_NAME_FALLBACK = "gizmovault_saf_legacy"
        private val KEY_TREE_URI = stringPreferencesKey("whatsapp_tree_uri")
        private val KEY_MERCHANT_ID = stringPreferencesKey("merchant_id")
        private val KEY_LAST_SCAN_TIME = stringPreferencesKey("last_scan_timestamp")
    }

    private val sharedPrefs by lazy {
        context.getSharedPreferences(PREF_NAME_FALLBACK, Context.MODE_PRIVATE)
    }

    val treeUriFlow: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[KEY_TREE_URI] ?: sharedPrefs.getString("whatsapp_tree_uri", null)
    }

    val merchantIdFlow: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[KEY_MERCHANT_ID] ?: sharedPrefs.getString("merchant_id", "merchant_001") ?: "merchant_001"
    }

    fun getTreeUriSync(): String? {
        return sharedPrefs.getString("whatsapp_tree_uri", null)
    }

    fun getMerchantIdSync(): String {
        return sharedPrefs.getString("merchant_id", "merchant_001") ?: "merchant_001"
    }

    suspend fun saveTreeUri(uriString: String) {
        sharedPrefs.edit().putString("whatsapp_tree_uri", uriString).apply()
        context.dataStore.edit { preferences ->
            preferences[KEY_TREE_URI] = uriString
        }
    }

    suspend fun saveMerchantId(merchantId: String) {
        sharedPrefs.edit().putString("merchant_id", merchantId).apply()
        context.dataStore.edit { preferences ->
            preferences[KEY_MERCHANT_ID] = merchantId
        }
    }

    suspend fun saveLastScanTime(timestamp: Long) {
        sharedPrefs.edit().putLong("last_scan_timestamp", timestamp).apply()
        context.dataStore.edit { preferences ->
            preferences[KEY_LAST_SCAN_TIME] = timestamp.toString()
        }
    }

    /**
     * Persist SAF directory tree read access across reboots and save URI
     */
    fun takePersistablePermission(treeUri: Uri): Boolean {
        return try {
            val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
            context.contentResolver.takePersistableUriPermission(treeUri, flags)
            sharedPrefs.edit().putString("whatsapp_tree_uri", treeUri.toString()).apply()
            Log.d(TAG, "Successfully took persistable URI permission for: $treeUri")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to take persistable URI permission for: $treeUri", e)
            false
        }
    }

    /**
     * Validates if persistable read access to the tree URI is still active across app restarts/reboots.
     */
    fun isPermissionActive(treeUriString: String? = getTreeUriSync()): Boolean {
        if (treeUriString.isNullOrBlank()) return false
        return try {
            val uri = Uri.parse(treeUriString)
            val hasPersistedPermission = context.contentResolver.persistedUriPermissions.any { perm ->
                perm.uri == uri && perm.isReadPermission
            }
            if (!hasPersistedPermission) {
                Log.w(TAG, "Tree URI permission not found in persisted permissions: $uri")
                return false
            }

            val docFile = DocumentFile.fromTreeUri(context, uri)
            val canRead = docFile != null && docFile.exists() && docFile.canRead()
            canRead
        } catch (e: Exception) {
            Log.e(TAG, "Error validating SAF permission for $treeUriString", e)
            false
        }
    }

    /**
     * Release persistable permission and reset saved directory tree
     */
    fun releasePermission() {
        val uriStr = getTreeUriSync() ?: return
        try {
            val uri = Uri.parse(uriStr)
            val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
            context.contentResolver.releasePersistableUriPermission(uri, flags)
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing persistable permission: ${e.message}")
        } finally {
            sharedPrefs.edit().remove("whatsapp_tree_uri").apply()
            runBlocking {
                context.dataStore.edit { it.remove(KEY_TREE_URI) }
            }
        }
    }
}
