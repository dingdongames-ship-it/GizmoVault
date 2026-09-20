package com.gizmovault.app.data

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.gizmovault.app.model.MediaAttachment
import com.gizmovault.app.model.UploadStatus
import com.gizmovault.app.model.VaultItem
import com.gizmovault.app.worker.VaultUploadWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

class VaultRepository(
    private val context: Context,
    private val dbHelper: VaultDatabaseHelper = VaultDatabaseHelper(context.applicationContext),
    private val storageResolver: MediaStorageResolver = MediaStorageResolver(context.applicationContext)
) {
    private val _vaultItemsFlow = MutableStateFlow<List<VaultItem>>(emptyList())
    val vaultItemsFlow: Flow<List<VaultItem>> = _vaultItemsFlow.asStateFlow()

    init {
        refreshItems()
    }

    fun refreshItems() {
        _vaultItemsFlow.value = dbHelper.getAllVaultItems()
    }

    suspend fun saveVaultItem(
        title: String,
        description: String,
        attachments: List<MediaAttachment>,
        enqueueBackgroundUpload: Boolean = true
    ): Result<VaultItem> = withContext(Dispatchers.IO) {
        try {
            val primaryMediaType = when {
                attachments.any { it.mediaType == com.gizmovault.app.model.MediaType.VIDEO } -> com.gizmovault.app.model.MediaType.VIDEO
                attachments.any { it.mediaType == com.gizmovault.app.model.MediaType.IMAGE } -> com.gizmovault.app.model.MediaType.IMAGE
                else -> com.gizmovault.app.model.MediaType.NONE
            }

            val primaryLocalUri = attachments.firstOrNull()?.localUri

            val vaultItem = VaultItem(
                title = title.trim(),
                description = description.trim(),
                createdAt = System.currentTimeMillis(),
                mediaType = primaryMediaType,
                attachments = attachments,
                localUri = primaryLocalUri,
                remoteUrl = null,
                uploadStatus = if (enqueueBackgroundUpload) UploadStatus.PENDING else UploadStatus.COMPLETED
            )

            val success = dbHelper.insertVaultItem(vaultItem, attachments)
            if (!success) {
                return@withContext Result.failure(Exception("Failed to insert VaultItem into local database"))
            }

            refreshItems()

            if (enqueueBackgroundUpload && attachments.isNotEmpty()) {
                scheduleBackgroundUpload(vaultItem.id)
            }

            Result.success(vaultItem)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun scheduleBackgroundUpload(itemId: String) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val uploadWorkRequest = OneTimeWorkRequestBuilder<VaultUploadWorker>()
            .setConstraints(constraints)
            .setInputData(workDataOf(VaultUploadWorker.KEY_VAULT_ITEM_ID to itemId))
            .addTag("vault_upload_$itemId")
            .build()

        WorkManager.getInstance(context.applicationContext)
            .enqueueUniqueWork(
                "work_vault_upload_$itemId",
                ExistingWorkPolicy.REPLACE,
                uploadWorkRequest
            )
    }

    suspend fun getVaultItemById(id: String): VaultItem? = withContext(Dispatchers.IO) {
        dbHelper.getVaultItem(id)
    }

    suspend fun updateUploadStatus(
        id: String,
        status: UploadStatus,
        remoteUrl: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val updated = dbHelper.updateUploadStatus(id, status, remoteUrl)
        if (updated) {
            refreshItems()
        }
        updated
    }

    suspend fun deleteVaultItem(id: String): Boolean = withContext(Dispatchers.IO) {
        val item = dbHelper.getVaultItem(id)
        item?.attachments?.forEach { att ->
            storageResolver.deleteLocalAttachmentFile(att.localUri)
        }
        val deleted = dbHelper.deleteVaultItem(id)
        if (deleted) {
            refreshItems()
        }
        deleted
    }
}
