package com.gizmovault.app.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.gizmovault.app.model.MediaAttachment
import com.gizmovault.app.model.MediaType
import com.gizmovault.app.model.UploadStatus
import com.gizmovault.app.model.VaultItem

class VaultDatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        const val DATABASE_NAME = "gizmovault.db"
        const val DATABASE_VERSION = 1

        const val TABLE_ITEMS = "vault_items"
        const val COL_ITEM_ID = "id"
        const val COL_ITEM_TITLE = "title"
        const val COL_ITEM_DESCRIPTION = "description"
        const val COL_ITEM_CREATED_AT = "created_at"
        const val COL_ITEM_MEDIA_TYPE = "media_type"
        const val COL_ITEM_LOCAL_URI = "local_uri"
        const val COL_ITEM_REMOTE_URL = "remote_url"
        const val COL_ITEM_UPLOAD_STATUS = "upload_status"

        const val TABLE_ATTACHMENTS = "vault_attachments"
        const val COL_ATT_ID = "id"
        const val COL_ATT_ITEM_ID = "item_id"
        const val COL_ATT_LOCAL_URI = "local_uri"
        const val COL_ATT_REMOTE_URL = "remote_url"
        const val COL_ATT_MEDIA_TYPE = "media_type"
        const val COL_ATT_FILE_NAME = "file_name"
        const val COL_ATT_FILE_SIZE = "file_size"
        const val COL_ATT_DURATION_MS = "duration_ms"
    }

    override fun onConfigure(db: SQLiteDatabase) {
        super.onConfigure(db)
        db.setForeignKeyConstraintsEnabled(true)
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE $TABLE_ITEMS (
                $COL_ITEM_ID TEXT PRIMARY KEY,
                $COL_ITEM_TITLE TEXT NOT NULL,
                $COL_ITEM_DESCRIPTION TEXT,
                $COL_ITEM_CREATED_AT INTEGER NOT NULL,
                $COL_ITEM_MEDIA_TYPE TEXT NOT NULL,
                $COL_ITEM_LOCAL_URI TEXT,
                $COL_ITEM_REMOTE_URL TEXT,
                $COL_ITEM_UPLOAD_STATUS TEXT NOT NULL
            )
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE $TABLE_ATTACHMENTS (
                $COL_ATT_ID TEXT PRIMARY KEY,
                $COL_ATT_ITEM_ID TEXT NOT NULL,
                $COL_ATT_LOCAL_URI TEXT NOT NULL,
                $COL_ATT_REMOTE_URL TEXT,
                $COL_ATT_MEDIA_TYPE TEXT NOT NULL,
                $COL_ATT_FILE_NAME TEXT,
                $COL_ATT_FILE_SIZE INTEGER,
                $COL_ATT_DURATION_MS INTEGER,
                FOREIGN KEY ($COL_ATT_ITEM_ID) REFERENCES $TABLE_ITEMS($COL_ITEM_ID) ON DELETE CASCADE
            )
            """.trimIndent()
        )

        db.execSQL("CREATE INDEX idx_vault_attachments_item_id ON $TABLE_ATTACHMENTS($COL_ATT_ITEM_ID)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_ATTACHMENTS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_ITEMS")
        onCreate(db)
    }

    fun insertVaultItem(item: VaultItem, attachments: List<MediaAttachment>): Boolean {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val itemValues = ContentValues().apply {
                put(COL_ITEM_ID, item.id)
                put(COL_ITEM_TITLE, item.title)
                put(COL_ITEM_DESCRIPTION, item.description)
                put(COL_ITEM_CREATED_AT, item.createdAt)
                put(COL_ITEM_MEDIA_TYPE, item.mediaType.name)
                put(COL_ITEM_LOCAL_URI, item.localUri)
                put(COL_ITEM_REMOTE_URL, item.remoteUrl)
                put(COL_ITEM_UPLOAD_STATUS, item.uploadStatus.name)
            }
            db.insertWithOnConflict(TABLE_ITEMS, null, itemValues, SQLiteDatabase.CONFLICT_REPLACE)

            for (att in attachments) {
                val attValues = ContentValues().apply {
                    put(COL_ATT_ID, att.id)
                    put(COL_ATT_ITEM_ID, item.id)
                    put(COL_ATT_LOCAL_URI, att.localUri)
                    put(COL_ATT_REMOTE_URL, att.remoteUrl)
                    put(COL_ATT_MEDIA_TYPE, att.mediaType.name)
                    put(COL_ATT_FILE_NAME, att.fileName)
                    put(COL_ATT_FILE_SIZE, att.fileSize)
                    if (att.durationMs != null) {
                        put(COL_ATT_DURATION_MS, att.durationMs)
                    } else {
                        putNull(COL_ATT_DURATION_MS)
                    }
                }
                db.insertWithOnConflict(TABLE_ATTACHMENTS, null, attValues, SQLiteDatabase.CONFLICT_REPLACE)
            }

            db.setTransactionSuccessful()
            return true
        } finally {
            db.endTransaction()
        }
    }

    fun updateUploadStatus(itemId: String, status: UploadStatus, remoteUrl: String? = null): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_ITEM_UPLOAD_STATUS, status.name)
            if (remoteUrl != null) {
                put(COL_ITEM_REMOTE_URL, remoteUrl)
            }
        }
        val rows = db.update(TABLE_ITEMS, values, "$COL_ITEM_ID = ?", arrayOf(itemId))
        return rows > 0
    }

    fun getVaultItem(itemId: String): VaultItem? {
        val db = readableDatabase
        val cursor = db.query(
            TABLE_ITEMS,
            null,
            "$COL_ITEM_ID = ?",
            arrayOf(itemId),
            null,
            null,
            null
        )

        return cursor.use { c ->
            if (c.moveToFirst()) {
                val attachments = getAttachmentsForItem(itemId)
                VaultItem(
                    id = c.getString(c.getColumnIndexOrThrow(COL_ITEM_ID)),
                    title = c.getString(c.getColumnIndexOrThrow(COL_ITEM_TITLE)),
                    description = c.getString(c.getColumnIndexOrThrow(COL_ITEM_DESCRIPTION)) ?: "",
                    createdAt = c.getLong(c.getColumnIndexOrThrow(COL_ITEM_CREATED_AT)),
                    mediaType = runCatching { MediaType.valueOf(c.getString(c.getColumnIndexOrThrow(COL_ITEM_MEDIA_TYPE))) }.getOrDefault(MediaType.NONE),
                    attachments = attachments,
                    localUri = c.getString(c.getColumnIndexOrThrow(COL_ITEM_LOCAL_URI)),
                    remoteUrl = c.getString(c.getColumnIndexOrThrow(COL_ITEM_REMOTE_URL)),
                    uploadStatus = runCatching { UploadStatus.valueOf(c.getString(c.getColumnIndexOrThrow(COL_ITEM_UPLOAD_STATUS))) }.getOrDefault(UploadStatus.PENDING)
                )
            } else {
                null
            }
        }
    }

    fun getAttachmentsForItem(itemId: String): List<MediaAttachment> {
        val db = readableDatabase
        val list = mutableListOf<MediaAttachment>()
        val cursor = db.query(
            TABLE_ATTACHMENTS,
            null,
            "$COL_ATT_ITEM_ID = ?",
            arrayOf(itemId),
            null,
            null,
            null
        )

        cursor.use { c ->
            while (c.moveToNext()) {
                val durationIndex = c.getColumnIndexOrThrow(COL_ATT_DURATION_MS)
                val duration = if (!c.isNull(durationIndex)) c.getLong(durationIndex) else null

                list.add(
                    MediaAttachment(
                        id = c.getString(c.getColumnIndexOrThrow(COL_ATT_ID)),
                        itemId = c.getString(c.getColumnIndexOrThrow(COL_ATT_ITEM_ID)),
                        localUri = c.getString(c.getColumnIndexOrThrow(COL_ATT_LOCAL_URI)),
                        remoteUrl = c.getString(c.getColumnIndexOrThrow(COL_ATT_REMOTE_URL)),
                        mediaType = runCatching { MediaType.valueOf(c.getString(c.getColumnIndexOrThrow(COL_ATT_MEDIA_TYPE))) }.getOrDefault(MediaType.IMAGE),
                        fileName = c.getString(c.getColumnIndexOrThrow(COL_ATT_FILE_NAME)) ?: "",
                        fileSize = c.getLong(c.getColumnIndexOrThrow(COL_ATT_FILE_SIZE)),
                        durationMs = duration
                    )
                )
            }
        }
        return list
    }

    fun getAllVaultItems(): List<VaultItem> {
        val db = readableDatabase
        val list = mutableListOf<VaultItem>()
        val cursor = db.query(
            TABLE_ITEMS,
            null,
            null,
            null,
            null,
            null,
            "$COL_ITEM_CREATED_AT DESC"
        )

        cursor.use { c ->
            while (c.moveToNext()) {
                val itemId = c.getString(c.getColumnIndexOrThrow(COL_ITEM_ID))
                val attachments = getAttachmentsForItem(itemId)
                list.add(
                    VaultItem(
                        id = itemId,
                        title = c.getString(c.getColumnIndexOrThrow(COL_ITEM_TITLE)),
                        description = c.getString(c.getColumnIndexOrThrow(COL_ITEM_DESCRIPTION)) ?: "",
                        createdAt = c.getLong(c.getColumnIndexOrThrow(COL_ITEM_CREATED_AT)),
                        mediaType = runCatching { MediaType.valueOf(c.getString(c.getColumnIndexOrThrow(COL_ITEM_MEDIA_TYPE))) }.getOrDefault(MediaType.NONE),
                        attachments = attachments,
                        localUri = c.getString(c.getColumnIndexOrThrow(COL_ITEM_LOCAL_URI)),
                        remoteUrl = c.getString(c.getColumnIndexOrThrow(COL_ITEM_REMOTE_URL)),
                        uploadStatus = runCatching { UploadStatus.valueOf(c.getString(c.getColumnIndexOrThrow(COL_ITEM_UPLOAD_STATUS))) }.getOrDefault(UploadStatus.PENDING)
                    )
                )
            }
        }
        return list
    }

    fun deleteVaultItem(itemId: String): Boolean {
        val db = writableDatabase
        val rows = db.delete(TABLE_ITEMS, "$COL_ITEM_ID = ?", arrayOf(itemId))
        return rows > 0
    }
}
