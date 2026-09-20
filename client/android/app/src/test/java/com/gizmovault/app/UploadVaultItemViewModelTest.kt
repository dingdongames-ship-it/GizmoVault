package com.gizmovault.app

import android.app.Application
import com.gizmovault.app.data.MediaStorageResolver
import com.gizmovault.app.data.VaultRepository
import com.gizmovault.app.model.MediaAttachment
import com.gizmovault.app.model.MediaType
import com.gizmovault.app.model.UploadStatus
import com.gizmovault.app.model.VaultItem
import com.gizmovault.app.ui.UploadUiState
import com.gizmovault.app.ui.UploadVaultItemViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.lang.reflect.Proxy

@OptIn(ExperimentalCoroutinesApi::class)
class UploadVaultItemViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var mockApp: Application
    private lateinit var viewModel: UploadVaultItemViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        // Proxy or stub for Application
        mockApp = Application()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun initialState_isIdleAndEmpty() {
        val state = UploadUiState()
        assertEquals("", state.title)
        assertEquals("", state.description)
        assertTrue(state.attachments.isEmpty())
        assertEquals(5, state.maxAttachments)
        assertEquals(5, state.remainingMediaSlots)
        assertTrue(state.canAddMoreMedia)
        assertFalse(state.isUploading)
        assertFalse(state.isProcessingMedia)
        assertFalse(state.isSuccess)
        assertNull(state.errorMessage)
        assertNull(state.savedItem)
        assertFalse(state.isFormValid)
    }

    @Test
    fun formValidation_requiresTitleAndDescription() {
        val emptyState = UploadUiState(title = "", description = "")
        assertFalse(emptyState.isFormValid)

        val titleOnlyState = UploadUiState(title = "Gizmo Smartwatch", description = "")
        assertFalse(titleOnlyState.isFormValid)

        val descOnlyState = UploadUiState(title = "", description = "Brand new imported")
        assertFalse(descOnlyState.isFormValid)

        val validState = UploadUiState(title = "Gizmo Smartwatch", description = "Brand new imported")
        assertTrue(validState.isFormValid)
    }

    @Test
    fun mediaLimits_enforcesMax5Slots() {
        val attachments = (1..5).map { index ->
            MediaAttachment(
                id = "att_$index",
                localUri = "file:///data/media/item_$index.jpg",
                mediaType = MediaType.IMAGE,
                fileName = "item_$index.jpg",
                fileSize = 1024L * 1024L
            )
        }

        val fullState = UploadUiState(attachments = attachments)
        assertEquals(5, fullState.attachments.size)
        assertEquals(0, fullState.remainingMediaSlots)
        assertFalse(fullState.canAddMoreMedia)

        val partialState = UploadUiState(attachments = attachments.take(3))
        assertEquals(3, partialState.attachments.size)
        assertEquals(2, partialState.remainingMediaSlots)
        assertTrue(partialState.canAddMoreMedia)
    }

    @Test
    fun mediaAttachment_formattedSizeAndDuration() {
        val imageAttachment = MediaAttachment(
            id = "img1",
            localUri = "file:///vault/test.jpg",
            mediaType = MediaType.IMAGE,
            fileSize = 2_500_000L // ~2.4 MB
        )
        assertTrue(imageAttachment.formattedFileSize.contains("MB"))
        assertNull(imageAttachment.formattedDuration)

        val videoAttachment = MediaAttachment(
            id = "vid1",
            localUri = "file:///vault/test.mp4",
            mediaType = MediaType.VIDEO,
            fileSize = 15_000_000L,
            durationMs = 85_000L // 1 min 25 sec
        )
        assertEquals("01:25", videoAttachment.formattedDuration)
        assertTrue(videoAttachment.formattedFileSize.contains("MB"))
    }

    @Test
    fun vaultItem_creation_defaultProperties() {
        val item = VaultItem(
            title = "Noise ColorFit Pro",
            description = "Smartwatch with SpO2 and Heart Rate sensor",
            mediaType = MediaType.IMAGE
        )

        assertNotNull(item.id)
        assertEquals("Noise ColorFit Pro", item.title)
        assertEquals("Smartwatch with SpO2 and Heart Rate sensor", item.description)
        assertEquals(MediaType.IMAGE, item.mediaType)
        assertEquals(UploadStatus.PENDING, item.uploadStatus)
        assertTrue(item.createdAt > 0L)
    }

    @Test
    fun uploadUiState_copyAndUpdates() {
        var state = UploadUiState()
        state = state.copy(title = "Galaxy Watch 6")
        assertEquals("Galaxy Watch 6", state.title)

        state = state.copy(description = "Titanium edition with LTE")
        assertEquals("Titanium edition with LTE", state.description)

        val testAttachment = MediaAttachment(
            id = "att_test",
            localUri = "file:///media/test.jpg",
            mediaType = MediaType.IMAGE
        )

        state = state.copy(attachments = listOf(testAttachment))
        assertEquals(1, state.attachments.size)
        assertEquals(4, state.remainingMediaSlots)

        // Remove attachment
        state = state.copy(attachments = state.attachments.filter { it.id != "att_test" })
        assertTrue(state.attachments.isEmpty())
        assertEquals(5, state.remainingMediaSlots)
    }
}
