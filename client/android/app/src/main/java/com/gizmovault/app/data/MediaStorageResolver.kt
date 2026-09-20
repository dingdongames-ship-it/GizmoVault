package com.gizmovault.app.data

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import com.gizmovault.app.model.MediaAttachment
import com.gizmovault.app.model.MediaType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.UUID

class MediaStorageResolver(private val context: Context) {

    private val mediaDir: File by lazy {
        File(context.filesDir, "vault_media").apply {
            if (!exists()) {
                mkdirs()
            }
        }
    }

    suspend fun resolveMediaUri(sourceUri: Uri): MediaAttachment? = withContext(Dispatchers.IO) {
        try {
            val contentResolver = context.contentResolver
            val mimeType = contentResolver.getType(sourceUri) ?: ""
            val isVideo = mimeType.startsWith("video/") || sourceUri.toString().contains(".mp4")
            val isImage = mimeType.startsWith("image/") || !isVideo

            val mediaType = when {
                isVideo -> MediaType.VIDEO
                isImage -> MediaType.IMAGE
                else -> MediaType.NONE
            }

            var originalFileName = "vault_${System.currentTimeMillis()}"
            var fileSize = 0L

            contentResolver.query(sourceUri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (nameIndex != -1) {
                        originalFileName = cursor.getString(nameIndex) ?: originalFileName
                    }
                    if (sizeIndex != -1 && !cursor.isNull(sizeIndex)) {
                        fileSize = cursor.getLong(sizeIndex)
                    }
                }
            }

            // Extension inference
            val extension = when {
                originalFileName.contains(".") -> originalFileName.substringAfterLast(".", "")
                isVideo -> "mp4"
                else -> "jpg"
            }

            val attachmentId = UUID.randomUUID().toString()
            val safeExtension = if (extension.isNotEmpty()) ".$extension" else ""
            val destFile = File(mediaDir, "media_${attachmentId}$safeExtension")

            // Safe stream copy from contentResolver to app-internal storage
            contentResolver.openInputStream(sourceUri)?.use { input: InputStream ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            } ?: run {
                Log.e("MediaStorageResolver", "Could not open InputStream for URI: $sourceUri")
                return@withContext null
            }

            if (fileSize == 0L && destFile.exists()) {
                fileSize = destFile.length()
            }

            var durationMs: Long? = null
            if (mediaType == MediaType.VIDEO) {
                try {
                    val retriever = MediaMetadataRetriever()
                    retriever.setDataSource(destFile.absolutePath)
                    val durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    durationMs = durationStr?.toLongOrNull()
                    retriever.release()
                } catch (e: Exception) {
                    Log.w("MediaStorageResolver", "Could not extract video duration: ${e.message}")
                }
            }

            val persistentLocalUri = Uri.fromFile(destFile).toString()

            MediaAttachment(
                id = attachmentId,
                localUri = persistentLocalUri,
                mediaType = mediaType,
                fileName = originalFileName,
                fileSize = fileSize,
                durationMs = durationMs
            )
        } catch (e: Exception) {
            Log.e("MediaStorageResolver", "Failed to resolve and persist media URI", e)
            null
        }
    }

    suspend fun deleteLocalAttachmentFile(localUriString: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val uri = Uri.parse(localUriString)
            if (uri.scheme == "file") {
                val file = File(uri.path ?: return@withContext false)
                if (file.exists() && file.parentFile?.absolutePath == mediaDir.absolutePath) {
                    return@withContext file.delete()
                }
            }
            false
        } catch (e: Exception) {
            Log.e("MediaStorageResolver", "Failed to delete local attachment: $localUriString", e)
            false
        }
    }
}
