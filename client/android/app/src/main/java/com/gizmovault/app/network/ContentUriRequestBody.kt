package com.gizmovault.app.network

import android.content.ContentResolver
import android.net.Uri
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.FileNotFoundException
import java.io.IOException

/**
 * Memory-safe streaming RequestBody that streams chunks directly from
 * ContentResolver.openInputStream(uri) to OkHttp's BufferedSink without buffering
 * large media/video files into RAM.
 */
class ContentUriRequestBody(
    private val contentResolver: ContentResolver,
    private val uri: Uri,
    private val mimeType: String,
    private val length: Long = -1L
) : RequestBody() {

    override fun contentType(): MediaType? {
        return mimeType.toMediaTypeOrNull()
    }

    override fun contentLength(): Long {
        return length
    }

    @Throws(IOException::class)
    override fun writeTo(sink: BufferedSink) {
        val inputStream = contentResolver.openInputStream(uri)
            ?: throw FileNotFoundException("Could not open InputStream for URI: $uri. File may have been deleted.")

        inputStream.use { input ->
            val buffer = ByteArray(16 * 1024) // 16 KB streaming buffer
            var bytesRead: Int
            while (input.read(buffer).also { bytesRead = it } != -1) {
                sink.write(buffer, 0, bytesRead)
            }
            sink.flush()
        }
    }
}
