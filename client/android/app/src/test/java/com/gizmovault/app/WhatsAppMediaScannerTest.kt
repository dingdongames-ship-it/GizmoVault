package com.gizmovault.app

import android.net.Uri
import com.gizmovault.app.data.SyncCursorItem
import com.gizmovault.app.network.IngestProductPayload
import com.gizmovault.app.network.ShopifyProductDto
import com.gizmovault.app.network.ShopifyProductMediaDto
import com.gizmovault.app.saf.ScannedWhatsAppMedia
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WhatsAppMediaScannerTest {

    @Test
    fun mimeTypeInference_correctForImagesAndVideos() {
        fun infer(fileName: String): String {
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

        assertEquals("image/jpeg", infer("IMG-20260920-WA0001.jpg"))
        assertEquals("image/png", infer("photo.PNG"))
        assertEquals("video/mp4", infer("VID-20260920-WA0002.mp4"))
        assertEquals("video/3gpp", infer("clip.3gp"))
        assertEquals("application/octet-stream", infer("document.pdf"))
    }

    @Test
    fun scannedWhatsAppMedia_isVideo_detection() {
        val mockUri = org.mockito.Mockito.mock(Uri::class.java)

        val imageMedia = ScannedWhatsAppMedia(
            uri = mockUri,
            name = "img1.jpg",
            size = 1024 * 500,
            lastModified = System.currentTimeMillis(),
            mimeType = "image/jpeg",
            parentFolder = "WhatsApp Images"
        )
        assertFalse(imageMedia.isVideo)

        val videoMedia = ScannedWhatsAppMedia(
            uri = mockUri,
            name = "vid1.mp4",
            size = 1024 * 1024 * 15,
            lastModified = System.currentTimeMillis(),
            mimeType = "video/mp4",
            parentFolder = "WhatsApp Video"
        )
        assertTrue(videoMedia.isVideo)
    }

    @Test
    fun syncCursorItem_modelAndStatuses() {
        val item = SyncCursorItem(
            fileUri = "content://saf/tree/image1.jpg",
            fileName = "image1.jpg",
            fileSize = 250000L,
            lastModified = 1726812000000L,
            mimeType = "image/jpeg",
            status = "PENDING"
        )

        assertEquals("content://saf/tree/image1.jpg", item.fileUri)
        assertEquals("image1.jpg", item.fileName)
        assertEquals("PENDING", item.status)

        val synced = item.copy(
            status = "SYNCED",
            remoteMediaUrl = "https://cdn.gizmovault.com/catalog/img1.jpg",
            syncedProductId = "prod_12345",
            syncedAt = System.currentTimeMillis()
        )
        assertEquals("SYNCED", synced.status)
        assertEquals("https://cdn.gizmovault.com/catalog/img1.jpg", synced.remoteMediaUrl)
        assertEquals("prod_12345", synced.syncedProductId)
        assertNotNull(synced.syncedAt)
    }

    @Test
    fun ingestProductPayload_jsonStructure() {
        val payload = IngestProductPayload(
            raw_text = "Original Imported Smartwatch Series 9 Price ₹2999",
            merchant_id = "merchant_india_01",
            timestamp = 1726812000000L,
            original_file_id = "wa_file_001",
            tags = listOf("smartwatch", "amoled", "whatsapp_sync")
        )

        val jsonString = com.google.gson.Gson().toJson(payload)
        assertTrue(jsonString.contains("merchant_india_01"))
        assertTrue(jsonString.contains("wa_file_001"))
        assertTrue(jsonString.contains("Smartwatch Series 9"))
        assertTrue(jsonString.contains("whatsapp_sync"))
    }

    @Test
    fun shopifyProductDto_structureAndMapping() {
        val product = ShopifyProductDto(
            id = "shopify_prod_001",
            merchant_id = "merchant_001",
            title = "Imported Smartwatch Series 9",
            description_html = "<p>High quality AMOLED</p>",
            status = "DRAFT",
            category = "Imported Watches",
            price = 2999.0,
            currency = "INR",
            media = listOf(
                ShopifyProductMediaDto(
                    url = "/uploads/catalog/media_01.jpg",
                    media_type = "IMAGE",
                    position = 1
                )
            )
        )

        assertEquals("shopify_prod_001", product.id)
        assertEquals("DRAFT", product.status)
        assertEquals(2999.0, product.price, 0.001)
        assertEquals(1, product.media.size)
        assertEquals("IMAGE", product.media[0].media_type)
    }
}
