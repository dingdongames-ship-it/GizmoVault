package com.gizmovault.app.model

import java.util.UUID

enum class MediaType {
    IMAGE,
    VIDEO,
    NONE
}

enum class UploadStatus {
    PENDING,
    UPLOADING,
    COMPLETED,
    FAILED
}

data class MediaAttachment(
    val id: String = UUID.randomUUID().toString(),
    val itemId: String = "",
    val localUri: String,
    val remoteUrl: String? = null,
    val mediaType: MediaType = MediaType.IMAGE,
    val fileName: String = "",
    val fileSize: Long = 0L,
    val durationMs: Long? = null
) {
    val formattedFileSize: String
        get() {
            if (fileSize <= 0) return "0 B"
            val units = arrayOf("B", "KB", "MB", "GB")
            val digitGroups = (Math.log10(fileSize.toDouble()) / Math.log10(1024.0)).toInt().coerceIn(0, units.size - 1)
            val value = fileSize / Math.pow(1024.0, digitGroups.toDouble())
            return String.format("%.1f %s", value, units[digitGroups])
        }

    val formattedDuration: String?
        get() {
            if (durationMs == null || durationMs <= 0) return null
            val totalSeconds = durationMs / 1000
            val minutes = totalSeconds / 60
            val seconds = totalSeconds % 60
            return String.format("%02d:%02d", minutes, seconds)
        }
}

data class VaultItem(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val description: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val mediaType: MediaType = MediaType.NONE,
    val attachments: List<MediaAttachment> = emptyList(),
    val localUri: String? = null,
    val remoteUrl: String? = null,
    val uploadStatus: UploadStatus = UploadStatus.PENDING
)
