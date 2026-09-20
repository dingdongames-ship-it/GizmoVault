package com.gizmovault.app.saf

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import com.gizmovault.app.data.SyncCursorItem
import com.gizmovault.app.data.SyncDatabaseHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStream

data class ScannedWhatsAppMedia(
    val uri: Uri,
    val name: String,
    val size: Long,
    val lastModified: Long,
    val mimeType: String,
    val parentFolder: String,
    val isAlreadySynced: Boolean = false
) {
    val isVideo: Boolean
        get() = mimeType.startsWith("video/") || name.endsWith(".mp4", ignoreCase = true)
}

class WhatsAppMediaScanner(
    private val context: Context,
    private val dbHelper: SyncDatabaseHelper = SyncDatabaseHelper(context.applicationContext)
) {

    companion object {
        private const val TAG = "WhatsAppMediaScanner"
        private val VALID_MIME_TYPES = setOf(
            "image/jpeg",
            "image/png",
            "image/webp",
            "video/mp4",
            "video/3gpp"
        )
        private val VALID_EXTENSIONS = setOf(
            "jpg", "jpeg", "png", "webp", "mp4", "3gp"
        )
    }

    /**
     * Scans the WhatsApp SAF tree URI on Dispatchers.IO.
     * Traverses 'WhatsApp Images' and 'WhatsApp Video' subfolders, filtering by MIME types and extensions.
     */
    suspend fun scanDirectory(
        treeUri: Uri,
        filterUnsyncedOnly: Boolean = true
    ): List<ScannedWhatsAppMedia> = withContext(Dispatchers.IO) {
        val results = mutableListOf<ScannedWhatsAppMedia>()
        try {
            val rootDoc = DocumentFile.fromTreeUri(context, treeUri)
            if (rootDoc == null || !rootDoc.exists() || !rootDoc.canRead()) {
                Log.e(TAG, "Cannot read SAF tree URI: $treeUri")
                return@withContext emptyList()
            }

            // Identify directories to traverse
            val directoriesToScan = mutableListOf<DocumentFile>()
            val rootName = rootDoc.name ?: ""

            if (isWhatsAppMediaTargetFolder(rootName)) {
                // User directly selected "WhatsApp Images" or "WhatsApp Video"
                directoriesToScan.add(rootDoc)
            } else {
                // Traverse top-level subdirectories to locate "WhatsApp Images", "WhatsApp Video", or media
                val children = rootDoc.listFiles()
                var foundTargetSubfolders = false

                for (child in children) {
                    if (child.isDirectory && isWhatsAppMediaTargetFolder(child.name ?: "")) {
                        directoriesToScan.add(child)
                        foundTargetSubfolders = true
                    }
                }

                if (!foundTargetSubfolders) {
                    // If no explicit "WhatsApp Images/Video" subfolder found, search one level deeper (e.g. Media/...)
                    for (child in children) {
                        if (child.isDirectory) {
                            for (grandChild in child.listFiles()) {
                                if (grandChild.isDirectory && isWhatsAppMediaTargetFolder(grandChild.name ?: "")) {
                                    directoriesToScan.add(grandChild)
                                    foundTargetSubfolders = true
                                }
                            }
                        }
                    }
                }

                // If still not found, scan root directly as fallback
                if (!foundTargetSubfolders) {
                    directoriesToScan.add(rootDoc)
                }
            }

            // Scan discovered media directories
            for (dir in directoriesToScan) {
                scanSingleFolder(dir, dir.name ?: "WhatsApp Media", filterUnsyncedOnly, results)
            }

            // Sort by most recently modified
            results.sortByDescending { it.lastModified }
            Log.d(TAG, "Discovered ${results.size} WhatsApp media candidates (filterUnsyncedOnly=$filterUnsyncedOnly)")
        } catch (e: Exception) {
            Log.e(TAG, "Error scanning WhatsApp media directory", e)
        }
        results
    }

    private fun scanSingleFolder(
        folder: DocumentFile,
        folderName: String,
        filterUnsyncedOnly: Boolean,
        outList: MutableList<ScannedWhatsAppMedia>
    ) {
        val files = folder.listFiles()
        for (file in files) {
            if (!file.isFile) continue

            val fileName = file.name ?: continue
            // Skip hidden or non-media files
            if (fileName.startsWith(".") || fileName.equals(".nomedia", ignoreCase = true)) continue

            val mimeType = file.type ?: inferMimeType(fileName)
            val extension = fileName.substringAfterLast('.', "").lowercase()

            val isAllowedMime = VALID_MIME_TYPES.contains(mimeType) || VALID_EXTENSIONS.contains(extension)
            if (!isAllowedMime) continue

            val fileSize = file.length()
            val lastModified = file.lastModified()
            val fileUriStr = file.uri.toString()

            val alreadySynced = dbHelper.isAlreadySynced(fileUriStr, fileSize, lastModified)

            if (alreadySynced && filterUnsyncedOnly) {
                continue
            }

            // Upsert into local cursor if new
            if (!alreadySynced) {
                dbHelper.upsertCursor(
                    SyncCursorItem(
                        fileUri = fileUriStr,
                        fileName = fileName,
                        fileSize = fileSize,
                        lastModified = lastModified,
                        mimeType = mimeType,
                        status = "PENDING"
                    )
                )
            }

            outList.add(
                ScannedWhatsAppMedia(
                    uri = file.uri,
                    name = fileName,
                    size = fileSize,
                    lastModified = lastModified,
                    mimeType = mimeType,
                    parentFolder = folderName,
                    isAlreadySynced = alreadySynced
                )
            )
        }
    }

    private fun isWhatsAppMediaTargetFolder(name: String): Boolean {
        val lower = name.lowercase()
        return lower.contains("whatsapp images") ||
               lower.contains("whatsapp video") ||
               lower.contains("whatsapp animated") ||
               lower == "images" ||
               lower == "video"
    }

    fun inferMimeType(fileName: String): String {
        val ext = fileName.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "webp" -> "image/webp"
            "mp4" -> "video/mp4"
            "3gp" -> "video/3gpp"
            else -> "application/octet-stream"
        }
    }

    /**
     * Checks if a media URI can be opened safely without throwing.
     * Prevents crash if merchant deleted media file inside WhatsApp.
     */
    fun isMediaStreamAccessible(uri: Uri): Boolean {
        return try {
            context.contentResolver.openInputStream(uri)?.use { stream: InputStream ->
                true
            } ?: false
        } catch (e: Exception) {
            Log.w(TAG, "Source media inaccessible or deleted: $uri", e)
            false
        }
    }
}
