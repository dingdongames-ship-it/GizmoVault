package com.gizmovault.app.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class SyncCursorItem(
    val fileUri: String,
    val fileName: String,
    val fileSize: Long,
    val lastModified: Long,
    val mimeType: String,
    val status: String = "PENDING", // PENDING, SYNCED, FAILED, DELETED
    val remoteMediaUrl: String? = null,
    val syncedProductId: String? = null,
    val syncedAt: Long? = null,
    val errorMessage: String? = null
)

class SyncDatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        const val DATABASE_NAME = "gizmovault_sync.db"
        const val DATABASE_VERSION = 1

        const val TABLE_CURSOR = "whatsapp_sync_cursor"
        const val COL_FILE_URI = "file_uri"
        const val COL_FILE_NAME = "file_name"
        const val COL_FILE_SIZE = "file_size"
        const val COL_LAST_MODIFIED = "last_modified"
        const val COL_MIME_TYPE = "mime_type"
        const val COL_STATUS = "status"
        const val COL_REMOTE_URL = "remote_media_url"
        const val COL_PRODUCT_ID = "synced_product_id"
        const val COL_SYNCED_AT = "synced_at"
        const val COL_ERROR_MSG = "error_message"
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE $TABLE_CURSOR (
                $COL_FILE_URI TEXT PRIMARY KEY,
                $COL_FILE_NAME TEXT NOT NULL,
                $COL_FILE_SIZE INTEGER NOT NULL,
                $COL_LAST_MODIFIED INTEGER NOT NULL,
                $COL_MIME_TYPE TEXT NOT NULL,
                $COL_STATUS TEXT NOT NULL DEFAULT 'PENDING',
                $COL_REMOTE_URL TEXT,
                $COL_PRODUCT_ID TEXT,
                $COL_SYNCED_AT INTEGER,
                $COL_ERROR_MSG TEXT
            )
            """.trimIndent()
        )

        db.execSQL("CREATE INDEX idx_sync_status ON $TABLE_CURSOR($COL_STATUS)")
        db.execSQL("CREATE INDEX idx_sync_modified ON $TABLE_CURSOR($COL_LAST_MODIFIED DESC)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_CURSOR")
        onCreate(db)
    }

    fun isAlreadySynced(fileUri: String, fileSize: Long, lastModified: Long): Boolean {
        val db = readableDatabase
        val cursor = db.query(
            TABLE_CURSOR,
            arrayOf(COL_STATUS, COL_FILE_SIZE, COL_LAST_MODIFIED),
            "$COL_FILE_URI = ? AND $COL_STATUS = 'SYNCED'",
            arrayOf(fileUri),
            null,
            null,
            null
        )
        return cursor.use { c ->
            if (c.moveToFirst()) {
                val existingSize = c.getLong(c.getColumnIndexOrThrow(COL_FILE_SIZE))
                val existingModified = c.getLong(c.getColumnIndexOrThrow(COL_LAST_MODIFIED))
                // If size and last modified match, it's identical and already synced
                existingSize == fileSize && existingModified == lastModified
            } else {
                false
            }
        }
    }

    fun upsertCursor(item: SyncCursorItem): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_FILE_URI, item.fileUri)
            put(COL_FILE_NAME, item.fileName)
            put(COL_FILE_SIZE, item.fileSize)
            put(COL_LAST_MODIFIED, item.lastModified)
            put(COL_MIME_TYPE, item.mimeType)
            put(COL_STATUS, item.status)
            put(COL_REMOTE_URL, item.remoteMediaUrl)
            put(COL_PRODUCT_ID, item.syncedProductId)
            if (item.syncedAt != null) put(COL_SYNCED_AT, item.syncedAt) else putNull(COL_SYNCED_AT)
            put(COL_ERROR_MSG, item.errorMessage)
        }
        val rowId = db.insertWithOnConflict(TABLE_CURSOR, null, values, SQLiteDatabase.CONFLICT_REPLACE)
        return rowId != -1L
    }

    fun markAsSynced(fileUri: String, remoteMediaUrl: String, productId: String): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_STATUS, "SYNCED")
            put(COL_REMOTE_URL, remoteMediaUrl)
            put(COL_PRODUCT_ID, productId)
            put(COL_SYNCED_AT, System.currentTimeMillis())
            putNull(COL_ERROR_MSG)
        }
        val count = db.update(TABLE_CURSOR, values, "$COL_FILE_URI = ?", arrayOf(fileUri))
        return count > 0
    }

    fun markAsFailed(fileUri: String, error: String): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_STATUS, "FAILED")
            put(COL_ERROR_MSG, error)
        }
        val count = db.update(TABLE_CURSOR, values, "$COL_FILE_URI = ?", arrayOf(fileUri))
        return count > 0
    }

    fun markAsDeleted(fileUri: String): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_STATUS, "DELETED")
            put(COL_ERROR_MSG, "File was deleted from device before sync")
        }
        val count = db.update(TABLE_CURSOR, values, "$COL_FILE_URI = ?", arrayOf(fileUri))
        return count > 0
    }

    fun getAllItems(): List<SyncCursorItem> {
        val db = readableDatabase
        val list = mutableListOf<SyncCursorItem>()
        val cursor = db.query(
            TABLE_CURSOR,
            null,
            null,
            null,
            null,
            null,
            "$COL_LAST_MODIFIED DESC"
        )
        cursor.use { c ->
            while (c.moveToNext()) {
                val syncedAtIndex = c.getColumnIndexOrThrow(COL_SYNCED_AT)
                list.add(
                    SyncCursorItem(
                        fileUri = c.getString(c.getColumnIndexOrThrow(COL_FILE_URI)),
                        fileName = c.getString(c.getColumnIndexOrThrow(COL_FILE_NAME)),
                        fileSize = c.getLong(c.getColumnIndexOrThrow(COL_FILE_SIZE)),
                        lastModified = c.getLong(c.getColumnIndexOrThrow(COL_LAST_MODIFIED)),
                        mimeType = c.getString(c.getColumnIndexOrThrow(COL_MIME_TYPE)),
                        status = c.getString(c.getColumnIndexOrThrow(COL_STATUS)),
                        remoteMediaUrl = c.getString(c.getColumnIndexOrThrow(COL_REMOTE_URL)),
                        syncedProductId = c.getString(c.getColumnIndexOrThrow(COL_PRODUCT_ID)),
                        syncedAt = if (!c.isNull(syncedAtIndex)) c.getLong(syncedAtIndex) else null,
                        errorMessage = c.getString(c.getColumnIndexOrThrow(COL_ERROR_MSG))
                    )
                )
            }
        }
        return list
    }

    fun getSyncStats(): Map<String, Int> {
        val db = readableDatabase
        val map = mutableMapOf("PENDING" to 0, "SYNCED" to 0, "FAILED" to 0, "DELETED" to 0, "TOTAL" to 0)
        val cursor = db.rawQuery(
            "SELECT status, COUNT(*) as cnt FROM $TABLE_CURSOR GROUP BY status",
            null
        )
        cursor.use { c ->
            var total = 0
            while (c.moveToNext()) {
                val status = c.getString(0)
                val count = c.getInt(1)
                map[status] = count
                total += count
            }
            map["TOTAL"] = total
        }
        return map
    }
}
