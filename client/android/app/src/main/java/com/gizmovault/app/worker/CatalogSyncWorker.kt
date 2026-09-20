package com.gizmovault.app.worker

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.gizmovault.app.data.SyncDatabaseHelper
import com.gizmovault.app.network.CatalogIngestionApi
import com.gizmovault.app.network.ContentUriRequestBody
import com.gizmovault.app.saf.SafPreferencesManager
import com.gizmovault.app.saf.WhatsAppMediaScanner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.FileNotFoundException
import java.io.IOException
import java.util.concurrent.TimeUnit

class CatalogSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val TAG = "CatalogSyncWorker"
        const val UNIQUE_PERIODIC_WORK = "whatsapp_catalog_periodic_sync"
        const val UNIQUE_ONE_TIME_WORK = "whatsapp_catalog_onetime_sync"

        fun schedulePeriodicSync(context: Context, intervalHours: Long = 1) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<CatalogSyncWorker>(intervalHours, TimeUnit.HOURS)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context.applicationContext)
                .enqueueUniquePeriodicWork(
                    UNIQUE_PERIODIC_WORK,
                    ExistingPeriodicWorkPolicy.KEEP,
                    request
                )
        }

        fun triggerOneTimeSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<CatalogSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context.applicationContext)
                .enqueueUniqueWork(
                    UNIQUE_ONE_TIME_WORK,
                    ExistingWorkPolicy.REPLACE,
                    request
                )
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val safPrefs = SafPreferencesManager(applicationContext)
        val treeUriStr = safPrefs.getTreeUriSync()

        if (treeUriStr.isNullOrBlank() || !safPrefs.isPermissionActive(treeUriStr)) {
            Log.w(TAG, "Cannot run catalog sync: SAF tree permission is inactive or missing.")
            return@withContext Result.failure(workDataOf("error" to "Permission missing or inactive"))
        }

        val treeUri = Uri.parse(treeUriStr)
        val scanner = WhatsAppMediaScanner(applicationContext)
        val dbHelper = SyncDatabaseHelper(applicationContext)
        val api = CatalogIngestionApi.create()
        val merchantId = safPrefs.getMerchantIdSync()

        Log.d(TAG, "Starting WhatsApp catalog sync for merchant: $merchantId")

        val candidates = scanner.scanDirectory(treeUri, filterUnsyncedOnly = true)
        if (candidates.isEmpty()) {
            Log.d(TAG, "No new WhatsApp media found to ingest.")
            safPrefs.saveLastScanTime(System.currentTimeMillis())
            return@withContext Result.success(workDataOf("synced_count" to 0))
        }

        var syncedCount = 0
        var failedCount = 0

        for (item in candidates) {
            // Check if file was deleted on WhatsApp by the user
            if (!scanner.isMediaStreamAccessible(item.uri)) {
                Log.w(TAG, "Media deleted on device before sync: ${item.name}")
                dbHelper.markAsDeleted(item.uri.toString())
                continue
            }

            try {
                // Stream from contentResolver without buffering in RAM
                val streamBody = ContentUriRequestBody(
                    contentResolver = applicationContext.contentResolver,
                    uri = item.uri,
                    mimeType = item.mimeType,
                    length = item.size
                )

                val filePart = MultipartBody.Part.createFormData("file", item.name, streamBody)

                val payloadJson = JSONObject().apply {
                    put("raw_text", "WhatsApp Media Ingest: ${item.name}\nFolder: ${item.parentFolder}")
                    put("merchant_id", merchantId)
                    put("timestamp", item.lastModified)
                    put("original_file_id", item.uri.toString())
                    put("tags", JSONArray().apply {
                        put("whatsapp_media")
                        put(item.parentFolder)
                        if (item.isVideo) put("video") else put("image")
                    })
                }.toString()

                val payloadBody = payloadJson.toRequestBody("application/json".toMediaTypeOrNull())

                val response = api.ingestProduct(filePart, payloadBody)

                if (response.isSuccessful && response.body()?.success == true) {
                    val product = response.body()?.product
                    val remoteUrl = product?.media?.firstOrNull()?.url ?: ""
                    val productId = product?.id ?: ""
                    dbHelper.markAsSynced(item.uri.toString(), remoteUrl, productId)
                    syncedCount++
                    Log.d(TAG, "Synced item ${item.name} -> product ${product?.title} (ID: $productId)")
                } else {
                    val errorMsg = response.body()?.error ?: response.message()
                    dbHelper.markAsFailed(item.uri.toString(), errorMsg)
                    failedCount++
                    Log.e(TAG, "Failed to ingest item ${item.name}: $errorMsg")
                }
            } catch (e: FileNotFoundException) {
                Log.w(TAG, "File deleted during sync: ${item.name}")
                dbHelper.markAsDeleted(item.uri.toString())
            } catch (e: IOException) {
                Log.e(TAG, "Network I/O error syncing ${item.name}: ${e.message}")
                dbHelper.markAsFailed(item.uri.toString(), e.message ?: "Network error")
                failedCount++
                if (runAttemptCount < 3) {
                    return@withContext Result.retry()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Unexpected error syncing ${item.name}: ${e.message}", e)
                dbHelper.markAsFailed(item.uri.toString(), e.message ?: "Unknown error")
                failedCount++
            }
        }

        safPrefs.saveLastScanTime(System.currentTimeMillis())
        Log.d(TAG, "Sync complete. Synced: $syncedCount, Failed: $failedCount")

        Result.success(
            workDataOf(
                "synced_count" to syncedCount,
                "failed_count" to failedCount
            )
        )
    }
}
